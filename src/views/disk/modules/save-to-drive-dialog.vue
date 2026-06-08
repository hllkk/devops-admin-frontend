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
const searchKeyword = ref('');

const dialogVisible = computed({
  get: () => props.visible,
  set: (val: boolean) => emit('update:visible', val)
});

const canConfirm = computed(() => selectedFolderId.value !== null);

// 根据ID查找文件夹路径
function getFolderPathById(id: CommonType.IdType): Api.Disk.FolderItem[] {
  const path: Api.Disk.FolderItem[] = [];
  let current = folderTree.value.find(f => f.id === id);
  while (current) {
    path.unshift(current);
    current = current.parentId !== null ? folderTree.value.find(f => f.id === current!.parentId) : undefined;
  }
  return path;
}

const selectedPath = computed(() => {
  if (selectedFolderId.value === null) return [];
  return getFolderPathById(selectedFolderId.value);
});

const filteredTree = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();

  function filterNodes(nodes: Api.Disk.FolderItem[]): any[] {
    const result: any[] = [];
    for (const node of nodes) {
      const nameMatch = !keyword || node.name.toLowerCase().includes(keyword);
      const children = folderTree.value.filter(f => f.parentId === node.id);
      let childResults: any[] = [];
      if (children.length > 0) {
        childResults = filterNodes(children);
      }
      if (nameMatch || childResults.length > 0) {
        result.push({
          key: node.id,
          label: node.name,
          children: childResults
        });
      }
    }
    return result;
  }

  const roots = folderTree.value.filter(f => f.parentId === null);
  if (!keyword) {
    function buildTree(nodes: Api.Disk.FolderItem[]): any[] {
      return nodes.map(node => ({
        key: node.id,
        label: node.name,
        children: buildTree(folderTree.value.filter(f => f.parentId === node.id))
      }));
    }
    return buildTree(roots);
  }
  return filterNodes(roots);
});

async function loadFolders() {
  startLoading();
  try {
    const { data } = await fetchGetFolderList('/');
    if (data) {
      folderTree.value = data.list;
      expandedKeys.value = data.list
        .filter(folder => folder.parentId === null)
        .map(folder => folder.id);
    }
  } finally {
    endLoading();
  }
}

function handleSelectFolder(keys: any[]) {
  selectedFolderId.value = keys.length > 0 ? keys[0] : null;
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

// 面包屑点击
function handleBreadcrumbClick(id: CommonType.IdType) {
  selectedFolderId.value = id;
  if (!expandedKeys.value.includes(id)) {
    expandedKeys.value.push(id);
  }
}

watch(() => props.visible, visible => {
  if (visible) {
    loadFolders();
    selectedFolderId.value = null;
    expandedKeys.value = [];
    searchKeyword.value = '';
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
        <div class="text-13px opacity-70">{{ $t('page.disk.sharedWithMe.itemsToSave') }} ({{ items.length }})</div>
        <div class="flex flex-col gap-6px max-h-120px overflow-y-auto">
          <div
            v-for="item in items"
            :key="item.shareId"
            class="flex items-center gap-8px px-12px py-8px rounded bg-gray-50 dark:bg-gray-800 text-13px"
          >
            <SvgIcon icon="material-symbols:description" :size="18" class="opacity-60 shrink-0" />
            <span class="truncate">{{ item.fileName }}</span>
          </div>
        </div>
      </div>

      <!-- Folder Tree -->
      <div class="flex flex-col gap-8px">
        <div class="flex items-center justify-between">
          <span class="text-13px opacity-70">{{ $t('page.disk.sharedWithMe.selectTargetFolder') }}</span>
        </div>

        <!-- Search input -->
        <NInput
          v-model:value="searchKeyword"
          :placeholder="$t('page.disk.sharedWithMe.searchPlaceholder')"
          size="small"
          clearable
        />

        <!-- Breadcrumb -->
        <div v-if="selectedPath.length > 0" class="flex items-center gap-4px text-12px overflow-hidden">
          <template v-for="(folder, index) in selectedPath" :key="folder.id">
            <span v-if="index > 0" class="opacity-40">/</span>
            <NButton
              size="tiny"
              quaternary
              :disabled="index === selectedPath.length - 1"
              @click="handleBreadcrumbClick(folder.id)"
            >
              {{ folder.name }}
            </NButton>
          </template>
        </div>

        <div class="h-280px overflow-y-auto border rounded dark:border-gray-700 p-8px">
          <NTree
            :data="filteredTree"
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
