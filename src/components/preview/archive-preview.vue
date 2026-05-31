<script setup lang="tsx">
import { ref, watch } from 'vue';
import type { TreeOption } from 'naive-ui';
import { fetchListArchive, fetchListSubArchive } from '@/service/api/disk/archive';
import type { ArchiveEntry } from '@/service/api/disk/archive';
import { useSvgIcon } from '@/hooks/common/icon';

defineOptions({
  name: 'ArchivePreview'
});

interface Props {
  visible: boolean;
  fileId: string | number;
  fileName: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
}>();

const { SvgIconVNode } = useSvgIcon();

const treeData = ref<TreeOption[]>([]);
const loading = ref(false);
const isEmpty = ref(false);
const hasError = ref(false);
const errorMsg = ref('');

const sizeMap = new Map<string, number>();

function buildTreeNode(entry: ArchiveEntry): TreeOption {
  sizeMap.set(entry.path, entry.size);
  return {
    key: entry.path,
    label: entry.name,
    isLeaf: !entry.isFolder,
    children: entry.isFolder ? undefined : undefined
  };
}

async function loadData() {
  loading.value = true;
  hasError.value = false;
  isEmpty.value = false;
  errorMsg.value = '';
  try {
    const res = await fetchListArchive(String(props.fileId));
    const data = (res as any).data || res;
    const entries: ArchiveEntry[] = Array.isArray(data) ? data : [];
    isEmpty.value = entries.length === 0;
    treeData.value = entries.map(buildTreeNode);
  } catch (e: any) {
    hasError.value = true;
    errorMsg.value = e?.message || '加载失败';
    treeData.value = [];
  } finally {
    loading.value = false;
  }
}

async function handleLoad(node: TreeOption) {
  const res = await fetchListSubArchive(String(props.fileId), node.key as string);
  const data = (res as any).data || res;
  const entries: ArchiveEntry[] = Array.isArray(data) ? data : [];
  return entries.map(buildTreeNode);
}

function renderLabel({ option }: { option: TreeOption }) {
  const isFolder = !option.isLeaf;
  const iconName = isFolder ? 'mdi:folder-outline' : 'mdi:file-outline';
  const fileSize = sizeMap.get(option.key as string);

  return (
    <div class="flex items-center gap-2 py-1 w-full min-w-0">
      <div class="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {SvgIconVNode({ icon: iconName, fontSize: 18 })}
      </div>
      <span class="flex-1 truncate text-14px">{option.label}</span>
      {!isFolder && fileSize !== undefined && fileSize > 0 && (
        <span class="text-12px text-gray-400 flex-shrink-0">
          {fileSize >= 1024
            ? `${(fileSize / 1024).toFixed(1)} KB`
            : `${fileSize} B`}
        </span>
      )}
    </div>
  );
}

watch(() => props.fileId, () => {
  treeData.value = [];
  sizeMap.clear();
  isEmpty.value = false;
  hasError.value = false;
});

watch(() => props.visible, val => {
  if (val) {
    treeData.value = [];
    sizeMap.clear();
    isEmpty.value = false;
    hasError.value = false;
    loadData();
  }
});
</script>

<template>
  <NModal
    :show="visible"
    preset="card"
    :title="`预览: ${fileName}`"
    style="width: 600px; max-height: 70vh"
    :closable="true"
    @update:show="emit('update:visible', $event)"
    @after-enter="loadData"
  >
    <NSpin :show="loading">
      <div v-if="!loading && isEmpty" class="flex-center py-12 text-gray-400 text-14px">
        压缩包为空
      </div>
      <div v-else-if="!loading && hasError" class="flex-center py-12 text-red-400 text-14px">
        {{ errorMsg }}
      </div>
      <NTree
        v-else
        :data="treeData"
        :render-label="renderLabel"
        :virtual-scroll="true"
        style="max-height: 50vh"
        block-line
        :on-load="handleLoad"
        key-field="key"
        label-field="label"
        children-field="children"
      />
    </NSpin>
  </NModal>
</template>
