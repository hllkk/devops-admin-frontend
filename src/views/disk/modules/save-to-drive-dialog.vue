<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { $t } from '@/locales';
import { useLoading } from '@sa/hooks';
import { fetchGetFolderList } from '@/service/api/disk/file';

defineOptions({
  name: 'SaveToDriveDialog'
});

interface Props {
  visible: boolean;
  items: Array<{
    shareId: number;
    fileId: number;
    fileName: string;
  }>;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', targetFolderId: CommonType.IdType): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { loading, startLoading, endLoading } = useLoading();

const folderTree = ref<Api.Disk.FolderItem[]>([]);
const selectedFolderId = ref<CommonType.IdType | null>(null);
const expandedKeys = ref<CommonType.IdType[]>([]);
const currentPath = ref<Api.Disk.FolderItem[]>([]);

const dialogVisible = computed({
  get: () => props.visible,
  set: (val: boolean) => emit('update:visible', val)
});

const canConfirm = computed(() => selectedFolderId.value !== null);

const treeData = computed(() => {
  function buildTree(nodes: Api.Disk.FolderItem[], parentId: CommonType.IdType | null = null): any[] {
    return nodes
      .filter(node => node.parentId === parentId)
      .map(node => ({
        key: node.id,
        label: node.name,
        children: buildTree(nodes, node.id)
      }));
  }

  return buildTree(folderTree.value);
});

async function loadFolders() {
  startLoading();
  try {
    const { data } = await fetchGetFolderList('/');
    if (data) {
      folderTree.value = data.list;
      // 默认展开根目录
      expandedKeys.value = data.list
        .filter(folder => folder.parentId === null)
        .map(folder => folder.id);
    }
  } finally {
    endLoading();
  }
}

function handleSelectFolder(keys: any[]) {
  if (keys.length > 0) {
    selectedFolderId.value = keys[0];
  } else {
    selectedFolderId.value = null;
  }
}

function handleExpandFolder(keys: any[]) {
  expandedKeys.value = keys;
}

function handleConfirm() {
  if (selectedFolderId.value !== null) {
    emit('confirm', selectedFolderId.value);
  }
}

function handleCancel() {
  dialogVisible.value = false;
}

function handleNodeClick(node: any) {
  selectedFolderId.value = node.key;
}

watch(() => props.visible, visible => {
  if (visible) {
    loadFolders();
    selectedFolderId.value = null;
    expandedKeys.value = [];
    currentPath.value = [];
  }
});
</script>

<template>
  <NModal
    v-model:show="dialogVisible"
    preset="card"
    :title="$t('page.disk.sharedWithMe.saveToDrive')"
    style="width: 90%; max-width: 560px"
    :mask-closable="false"
    :bordered="false"
  >
    <div class="flex flex-col gap-16px">
      <!-- Items to save -->
      <div v-if="items.length > 0" class="flex flex-col gap-8px">
        <div class="text-13px opacity-70">{{ $t('page.disk.sharedWithMe.itemsToSave') }}</div>
        <div class="flex flex-col gap-6px">
          <div
            v-for="item in items"
            :key="item.shareId"
            class="flex items-center gap-8px px-12px py-8px rounded bg-gray-50 dark:bg-gray-800 text-13px"
          >
            <SvgIcon icon="material-symbols:description" :size="18" class="opacity-60" />
            <span class="truncate">{{ item.fileName }}</span>
          </div>
        </div>
      </div>

      <!-- Folder Tree -->
      <div class="flex flex-col gap-8px">
        <div class="text-13px opacity-70">{{ $t('page.disk.sharedWithMe.selectTargetFolder') }}</div>
        <div class="h-320px overflow-y-auto border rounded dark:border-gray-700 p-8px">
          <NTree
            :data="treeData"
            :selected-keys="selectedFolderId ? [selectedFolderId] : []"
            :expanded-keys="expandedKeys"
            :loading="loading"
            key-field="key"
            label-field="label"
            selectable
            block-line
            @update:selected-keys="handleSelectFolder"
            @update:expanded-keys="handleExpandFolder"
            @node-click="handleNodeClick"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-8px">
        <NButton @click="handleCancel">{{ $t('common.cancel') }}</NButton>
        <NButton type="primary" :disabled="!canConfirm" :loading="loading" @click="handleConfirm">
          {{ $t('common.confirm') }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>
