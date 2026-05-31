<script setup lang="ts">
import { ref, watch } from 'vue';
import type { TreeOption } from 'naive-ui';
import { fetchListArchive, fetchListSubArchive } from '@/service/api/disk/archive';
import type { ArchiveEntry } from '@/service/api/disk/archive';

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

const treeData = ref<TreeOption[]>([]);
const loading = ref(false);

function buildTreeNode(entry: ArchiveEntry): TreeOption {
  return {
    key: entry.path,
    label: entry.name,
    isLeaf: !entry.isFolder,
    children: entry.isFolder ? undefined : undefined
  };
}

async function loadData() {
  if (treeData.value.length > 0) return;
  loading.value = true;
  try {
    const res = await fetchListArchive(String(props.fileId));
    const data = (res as any).data || res;
    const entries: ArchiveEntry[] = Array.isArray(data) ? data : [];
    treeData.value = entries.map(buildTreeNode);
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

watch(() => props.visible, val => {
  if (val) {
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
      <NTree
        :data="treeData"
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
