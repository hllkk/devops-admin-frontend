<script setup lang="tsx">
import { ref, watch, h } from 'vue';
import type { TreeOption } from 'naive-ui';
import { fetchListArchive, fetchListSubArchive } from '@/service/api/disk/archive';
import type { ArchiveEntry } from '@/service/api/disk/archive';
import FileIcon from '@/views/disk/modules/file-icon.vue';

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
const isEmpty = ref(false);
const hasError = ref(false);
const errorMsg = ref('');

const sizeMap = new Map<string, number>();
const suffixMap = new Map<string, string>();

function buildTreeNode(entry: ArchiveEntry): TreeOption {
  sizeMap.set(entry.path, entry.size);
  suffixMap.set(entry.path, entry.suffix || '');
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

function mapSuffixToFileType(suffix: string): string {
  if (!suffix) return 'other';
  const ext = suffix.toLowerCase().replace(/^\./, '');
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
  const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv'];
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'ape'];
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'md', 'log'];
  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (docExts.includes(ext)) return 'document';
  return 'other';
}

function renderLabel({ option }: { option: TreeOption }) {
  const isFolder = !option.isLeaf;
  const key = option.key as string;
  const fileSize = sizeMap.get(key);
  const suffix = suffixMap.get(key) || '';
  const fileType = isFolder ? 'folder' : mapSuffixToFileType(suffix);

  return (
    <div class="flex items-center gap-2 py-1 w-full min-w-0">
      <div class="flex-shrink-0">
        {h(FileIcon, { fileType, extension: suffix, size: 'small' })}
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
  suffixMap.clear();
  isEmpty.value = false;
  hasError.value = false;
});

watch(() => props.visible, val => {
  if (val) {
    treeData.value = [];
    sizeMap.clear();
    suffixMap.clear();
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
