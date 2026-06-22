<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { $t } from '@/locales';
import { useDiskStore } from '@/store/modules/disk';
import { resolveNameConflict } from '../utils/resolve-name-conflict';
import { getSelectId } from '../utils/file-select';
import FileCard from './file-card.vue';
import FileEmpty from '@/components/disk/file-empty.vue';
import DiskContextMenu from './context-menu.vue';
import FileIcon from './file-icon.vue';

defineOptions({
  name: 'FileGrid'
});

interface Props {
  files: Api.Disk.FileItem[];
  loading?: boolean;
  /** 禁用内联创建功能（特殊页面使用） */
  disableCreate?: boolean;
  /** 外部选中的文件ID列表（特殊页面使用，覆盖 diskStore） */
  selectedFiles?: CommonType.IdType[];
  /** 页面类型，用于区分收藏/取消收藏菜单 */
  pageType?: 'disk' | 'favorite' | 'recent' | 'my-share' | 'trash';
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  disableCreate: false,
  selectedFiles: undefined,
  pageType: 'disk'
});

interface Emits {
  (e: 'fileClick', file: Api.Disk.FileItem): void;
  (e: 'fileDblClick', file: Api.Disk.FileItem): void;
  (e: 'fileShare', file: Api.Disk.FileItem): void;
  (e: 'fileDownload', file: Api.Disk.FileItem): void;
  (e: 'fileDelete', file: Api.Disk.FileItem): void;
  (e: 'fileRename', file: Api.Disk.FileItem): void;
  (e: 'fileCopy', file: Api.Disk.FileItem): void;
  (e: 'fileMove', file: Api.Disk.FileItem): void;
  // eslint-disable-next-line vue/no-unused-emit-declarations
  (e: 'fileFavorite', file: Api.Disk.FileItem): void;
  (e: 'fileAddFavorite', file: Api.Disk.FileItem): void;
  (e: 'fileRemoveFavorite', file: Api.Disk.FileItem): void;
  (e: 'fileDetail', file: Api.Disk.FileItem): void;
  (e: 'fileRestore', file: Api.Disk.FileItem): void;
  (e: 'refresh'): void;
  (e: 'emptyTrash'): void;
  (e: 'fileCreated', name: string): void;
  (e: 'folderCreated', name: string): void;
  (e: 'fileRenameConfirm', newName: string): void;
  (e: 'fileRenameCancel'): void;
  /** 选中状态变化（特殊页面使用） */
  (e: 'selectionChange', selectedFiles: CommonType.IdType[]): void;
}

const emit = defineEmits<Emits>();

const diskStore = useDiskStore();

const gridScrollRef = ref<HTMLDivElement>();
const scrollStyle = ref<Record<string, string>>({});

// 获取当前选中列表（优先使用 props，否则使用 diskStore）
const currentSelectedFiles = computed(() => {
  return props.selectedFiles ?? diskStore.selectedFiles;
});

const isSelected = computed(() => (fileId: CommonType.IdType) => {
  return currentSelectedFiles.value.includes(fileId);
});

const showEmpty = computed(() => props.files.length === 0 && !props.loading);

function updateScrollHeight() {
  const el = gridScrollRef.value;
  if (!el) return;

  const top = el.getBoundingClientRect().top;
  const maxH = window.innerHeight - top - 24;
  scrollStyle.value = { maxHeight: `${maxH}px` };
}

function handleFileClick(file: Api.Disk.FileItem) {
  emit('fileClick', file);
}

function handleFileDblClick(file: Api.Disk.FileItem) {
  // 回收站页面禁用双击预览
  if (props.pageType === 'trash') return;

  if (file.isFolder) {
    diskStore.enterFolder(file);
  } else {
    emit('fileDblClick', file);
  }
}

// 更新选中状态（统一处理本地和全局选中）
function updateSelection(selectId: CommonType.IdType, add: boolean) {
  if (props.selectedFiles !== undefined) {
    // 使用本地选中状态
    if (add) {
      emit('selectionChange', [...props.selectedFiles, selectId]);
    } else {
      emit('selectionChange', props.selectedFiles.filter(id => id !== selectId));
    }
  } else {
    // 使用全局 diskStore
    if (add) {
      diskStore.setSelectedFiles([...diskStore.selectedFiles, selectId]);
    } else {
      diskStore.setSelectedFiles(diskStore.selectedFiles.filter(id => id !== selectId));
    }
  }
}

function handleSelect(file: Api.Disk.FileItem) {
  const selectId = getSelectId(file);
  const isCurrentlySelected = currentSelectedFiles.value.includes(selectId);
  updateSelection(selectId, !isCurrentlySelected);
}

function handleAction(action: string, file: Api.Disk.FileItem) {
  if (action === 'share') emit('fileShare', file);
  else if (action === 'download') emit('fileDownload', file);
  else if (action === 'delete') emit('fileDelete', file);
  else if (action === 'rename') emit('fileRename', file);
  else if (action === 'copy') emit('fileCopy', file);
  else if (action === 'move') emit('fileMove', file);
}

// --- 右键菜单 ---
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: 'file' | 'area';
  targetFile: Api.Disk.FileItem | null;
}

const ctxState = ref<ContextMenuState>({
  visible: false,
  x: 0,
  y: 0,
  type: 'file',
  targetFile: null
});

function handleContextMenu(e: MouseEvent) {
  if (props.loading) return;

  const target = (e.target as HTMLElement).closest('[data-file-id]');
  if (target) {
    const fileId = (target as HTMLElement).dataset.fileId!;
    const file = props.files.find(f => String(getSelectId(f)) === fileId);
    if (file) {
      const selectId = getSelectId(file);
      if (!currentSelectedFiles.value.includes(selectId)) {
        // 根据是否使用本地选中状态来更新
        if (props.selectedFiles !== undefined) {
          emit('selectionChange', [selectId]);
        } else {
          diskStore.setSelectedFiles([selectId]);
        }
      }
      ctxState.value = { visible: true, x: e.clientX, y: e.clientY, type: 'file', targetFile: file };
      return;
    }
  }
  ctxState.value = { visible: true, x: e.clientX, y: e.clientY, type: 'area', targetFile: null };
}

function applySort(field: 'name' | 'size' | 'modifyTime') {
  const { field: currentField, order } = diskStore.sortSettings;
  diskStore.setSort(field, currentField === field ? (order === 'asc' ? 'desc' : 'asc') : 'asc');
}

function handleContextSelect(key: string) {
  const file = ctxState.value.targetFile;
  switch (key) {
    case 'open':
      if (file) {
        if (file.isFolder) {
          diskStore.enterFolder(file);
        } else {
          emit('fileDblClick', file);
        }
      }
      break;
    case 'download': if (file) emit('fileDownload', file); break;
    case 'share': if (file) emit('fileShare', file); break;
    case 'copy': if (file) emit('fileCopy', file); break;
    case 'move': if (file) emit('fileMove', file); break;
    case 'rename': if (file) emit('fileRename', file); break;
    case 'delete': if (file) emit('fileDelete', file); break;
    case 'detail': if (file) emit('fileDetail', file); break;
    case 'addFavorite': if (file) emit('fileAddFavorite', file); break;
    case 'removeFavorite': if (file) emit('fileRemoveFavorite', file); break;
    case 'restore': if (file) emit('fileRestore', file); break;
    case 'emptyTrash': emit('emptyTrash'); break;
    case 'view-grid': diskStore.setViewMode('grid'); break;
    case 'view-list': diskStore.setViewMode('list'); break;
    case 'sort-name': applySort('name'); break;
    case 'sort-size': applySort('size'); break;
    case 'sort-modifyTime': applySort('modifyTime'); break;
    case 'refresh': emit('refresh'); break;
    case 'reload': window.location.reload(); break;
  }
}

// --- 内联创建 ---
const createName = ref('');
const isConfirming = ref(false);
const createInputRef = ref<InstanceType<typeof NInput>>();

watch(() => diskStore.creatingType, type => {
  if (!type) {
    isConfirming.value = false;
    return;
  }
  isConfirming.value = false;
  if (type === 'file') {
    createName.value = $t('page.disk.createInline.defaultFileName');
  } else if (type === 'folder') {
    createName.value = $t('page.disk.createInline.defaultFolderName');
  }
  nextTick(() => {
    createInputRef.value?.focus();
  });
});

function handleCreateConfirm() {
  if (isConfirming.value) return;
  const name = createName.value.trim();
  if (!name) {
    window.$message?.warning($t('page.disk.createInline.emptyName'));
    return;
  }

  const existingNames = props.files.map(f => f.fileName);
  if (existingNames.includes(name)) {
    isConfirming.value = true;
    window.$dialog?.warning({
      title: $t('page.disk.createInline.confirmCreate'),
      content: $t('page.disk.createInline.nameExists', { name }),
      positiveText: $t('page.disk.createInline.confirmCreate'),
      negativeText: $t('page.disk.createInline.cancelCreate'),
      onPositiveClick: () => {
        const resolvedName = resolveNameConflict(name, existingNames);
        emitCreate(resolvedName);
      },
      onNegativeClick: () => {
        isConfirming.value = false;
        diskStore.cancelCreating();
        createName.value = '';
      },
      onClose: () => {
        isConfirming.value = false;
        diskStore.cancelCreating();
        createName.value = '';
      }
    });
    return;
  }

  isConfirming.value = true;
  emitCreate(name);
}

function emitCreate(name: string) {
  if (diskStore.creatingType === 'file') {
    emit('fileCreated', name);
  } else if (diskStore.creatingType === 'folder') {
    emit('folderCreated', name);
  }
}

function handleCreateCancel() {
  if (isConfirming.value) return;
  isConfirming.value = true;
  diskStore.cancelCreating();
  createName.value = '';
}

function handleCreateKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleCreateConfirm();
  } else if (e.key === 'Escape') {
    handleCreateCancel();
  }
}

function handleCreateBlur() {
  // 延迟检查，让按钮的 mousedown 先设置 isConfirming 标志
  setTimeout(() => {
    if (isConfirming.value) return;
    if (!diskStore.creatingType) return;
    handleCreateConfirm();
  }, 150);
}

let resizeObserver: ResizeObserver | undefined;

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    updateScrollHeight();
  });
  resizeObserver.observe(document.documentElement);
  window.addEventListener('resize', updateScrollHeight);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('resize', updateScrollHeight);
});

watch(
  () => props.files,
  () => nextTick(updateScrollHeight),
  { immediate: true }
);

// 暴露滚动容器 ref 供父组件绑定 scroll 事件
defineExpose({ scrollContainer: gridScrollRef });
</script>

<template>
  <div class="h-full">
    <!-- 空状态（正在创建时不展示，让网格布局展示创建卡片） -->
    <FileEmpty v-if="showEmpty && !diskStore.creatingType" />

    <!-- 文件网格 - 滚动容器 -->
    <NSpin v-if="!showEmpty || (!disableCreate && diskStore.creatingType)" :show="loading">
      <div
        ref="gridScrollRef"
        class="file-grid-scroll overflow-y-auto pr-4px"
        :style="scrollStyle"
        @contextmenu.prevent="handleContextMenu"
      >
        <div class="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-16px px-16px pt-16px pb-48px">
          <!-- 内联创建占位卡片 -->
          <div
            v-if="!disableCreate && diskStore.creatingType"
            class="relative flex flex-col items-center px-8px py-16px rd-8px bg-primary/5 dark:bg-primary/10"
          >
            <!-- 确认/取消按钮 -->
            <div
              class="absolute top-4px left-4px right-4px z-1 flex items-center justify-end gap-2px"
              @click.stop
            >
              <button
                class="p-4px rd-4px cursor-pointer hover:bg-primary/15 dark:hover:bg-primary/25 text-primary border-none bg-transparent"
                @mousedown.prevent="handleCreateConfirm"
              >
                <SvgIcon icon="mdi:check" :size="14" />
              </button>
              <button
                class="p-4px rd-4px cursor-pointer hover:bg-primary/15 dark:hover:bg-primary/25 text-gray-500 border-none bg-transparent"
                @mousedown.prevent="handleCreateCancel"
              >
                <SvgIcon icon="mdi:close" :size="14" />
              </button>
            </div>
            <div class="mb-8px mt-16px">
              <FileIcon
                :file-type="diskStore.creatingType === 'folder' ? 'folder' : 'other'"
                size="large"
              />
            </div>
            <div class="w-full px-4px">
              <NInput
                ref="createInputRef"
                v-model:value="createName"
                size="small"
                @keydown="handleCreateKeydown"
                @blur="handleCreateBlur"
              />
            </div>
          </div>

          <FileCard
            v-for="file in files"
            :key="file.fileId"
            :file="file"
            :selected="isSelected(getSelectId(file))"
            :data-file-id="String(getSelectId(file))"
            @click="handleFileClick(file)"
            @dblclick="handleFileDblClick(file)"
            @select="handleSelect(file)"
            @share="handleAction('share', file)"
            @download="handleAction('download', file)"
            @delete="handleAction('delete', file)"
            @rename="handleAction('rename', file)"
            @rename-confirm="(_fileId, newName) => emit('fileRenameConfirm', newName)"
            @rename-cancel="emit('fileRenameCancel')"
            @copy="handleAction('copy', file)"
            @move="handleAction('move', file)"
          />
        </div>
      </div>
    </NSpin>

    <DiskContextMenu
      v-model:visible="ctxState.visible"
      :x="ctxState.x"
      :y="ctxState.y"
      :type="ctxState.type"
      :page-type="pageType"
      :file-is-favorite="ctxState.targetFile?.isFavorite"
      @select="handleContextSelect"
    />
  </div>
</template>

<style scoped lang="scss">
.file-grid-scroll {
  @include scrollbar();
}
</style>
