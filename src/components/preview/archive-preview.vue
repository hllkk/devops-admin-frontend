<script setup lang="tsx">
import { ref, watch, h } from 'vue';
import type { TreeOption } from 'naive-ui';
import { NTooltip } from 'naive-ui';
import { fetchListArchive } from '@/service/api/disk/archive';
import type { ArchiveEntry } from '@/service/api/disk/archive';
import { formatFileSize } from '@/utils/format';
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

function sortEntries(entries: ArchiveEntry[]) {
  entries.sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  // 递归排序子节点
  for (const entry of entries) {
    if (entry.children && entry.children.length > 0) {
      sortEntries(entry.children);
    }
  }
}

function buildTreeNode(entry: ArchiveEntry): TreeOption {
  sizeMap.set(entry.path, entry.size);
  suffixMap.set(entry.path, entry.suffix || '');

  const node: TreeOption = {
    key: entry.path,
    label: entry.name,
    isLeaf: !entry.isFolder
  };

  if (entry.isFolder && entry.children && entry.children.length > 0) {
    node.children = entry.children.map(child => buildTreeNode(child));
  }

  return node;
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
    sortEntries(entries);
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
      <NTooltip placement="top" disabled={!option.label}>
        {{
          trigger: () => (
            <span class="flex-1 truncate text-14px">{option.label}</span>
          ),
          default: () => option.label as string
        }}
      </NTooltip>
      {!isFolder && fileSize !== undefined && fileSize > 0 && (
        <span class="text-12px text-gray-400 flex-shrink-0">
          {formatFileSize(fileSize)}
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
    style="width: 600px; max-height: 70vh"
    :closable="true"
    @update:show="emit('update:visible', $event)"
    @after-enter="loadData"
  >
    <template #header>
      <div class="flex items-center min-w-0">
        <span class="flex-shrink-0">预览:</span>
        <NTooltip placement="top">
          <template #trigger>
            <span class="truncate ml-1">{{ fileName }}</span>
          </template>
          {{ fileName }}
        </NTooltip>
      </div>
    </template>
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
        key-field="key"
        label-field="label"
        children-field="children"
      />
    </NSpin>
  </NModal>
</template>
