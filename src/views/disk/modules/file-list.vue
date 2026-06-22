<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui';
import { NInput } from 'naive-ui';
import { h, computed, ref, watch, nextTick } from 'vue';
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';
import { $t } from '@/locales';
import { useDiskStore } from '@/store/modules/disk';
import { formatFileSize } from '@/utils/format';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { resolveNameConflict } from '../utils/resolve-name-conflict';
import { getSelectId } from '../utils/file-select';
import FileIcon from './file-icon.vue';
import FileEmpty from '@/components/disk/file-empty.vue';
import DiskContextMenu from './context-menu.vue';

defineOptions({
  name: 'FileList'
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
  (e: 'fileCreated', name: string): void;
  (e: 'folderCreated', name: string): void;
  (e: 'refresh'): void;
  (e: 'emptyTrash'): void;
  (e: 'fileRenameConfirm', newName: string): void;
  (e: 'fileRenameCancel'): void;
  /** 选中状态变化（特殊页面使用） */
  (e: 'selectionChange', selectedFiles: CommonType.IdType[]): void;
}

const emit = defineEmits<Emits>();

const diskStore = useDiskStore();
const breakpoints = useBreakpoints(breakpointsTailwind);
const isMobile = breakpoints.smaller('sm');

// 是否显示空状态
const showEmpty = computed(() => props.files.length === 0 && !props.loading);

// 虚拟创建行ID
const CREATION_ROW_ID = -1;

/** 表格数据（创建时在顶部插入虚拟行） */
const tableData = computed(() => {
  if (!diskStore.creatingType || props.disableCreate) return props.files;
  const creationItem = {
    fileId: CREATION_ROW_ID,
    fileName: '',
    fileType: diskStore.creatingType === 'folder' ? 'folder' : 'other',
    fileSize: 0,
    parentId: null,
    filePath: '',
    modifyTime: '',
    isFolder: diskStore.creatingType === 'folder',
    _isCreating: true
  } as Api.Disk.FileItem & { _isCreating: boolean };
  return [creationItem, ...props.files];
});

// --- 内联重命名 ---
const renameName = ref('');
const isRenaming = ref(false);
const renameInputRef = ref<InstanceType<typeof NInput>>();

watch(() => diskStore.renamingFileId, val => {
  if (!val) {
    isRenaming.value = false;
    return;
  }
  const file = props.files.find(f => f.fileId === val);
  if (file) {
    renameName.value = file.fileName;
    isRenaming.value = false;
    nextTick(() => {
      nextTick(() => {
        renameInputRef.value?.focus();
      });
    });
  }
});

function handleRenameConfirm() {
  if (isRenaming.value) return;
  const name = renameName.value.trim();
  if (!name) {
    diskStore.cancelRenaming();
    emit('fileRenameCancel');
    return;
  }
  isRenaming.value = true;
  emit('fileRenameConfirm', name);
}

function handleRenameCancel() {
  if (isRenaming.value) return;
  diskStore.cancelRenaming();
  emit('fileRenameCancel');
}

function handleRenameKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleRenameConfirm();
  } else if (e.key === 'Escape') {
    handleRenameCancel();
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
  setTimeout(() => {
    if (isConfirming.value) return;
    if (!diskStore.creatingType) return;
    handleCreateConfirm();
  }, 150);
}

const columns = computed<DataTableColumns<Api.Disk.FileItem>>(() => {
  const cols: DataTableColumns<Api.Disk.FileItem> = [
    {
      type: 'selection',
      align: 'center',
      width: 48
    },
    {
      key: 'fileName',
      title: $t('page.disk.file.name'),
      align: 'left',
      ellipsis: true,
      render: row => {
        const isCreatingThis = (row as any)._isCreating;
        if (isCreatingThis) {
          return h('div', { class: 'flex items-center gap-8px w-full' }, [
            h(FileIcon, {
              fileType: row.isFolder ? 'folder' : 'other',
              size: 'small'
            }),
            h(NInput, {
              ref: (el: any) => { createInputRef.value = el; },
              value: createName.value,
              'onUpdate:value': (val: string) => { createName.value = val; },
              size: 'small',
              class: 'max-w-300px',
              onClick: (e: Event) => e.stopPropagation(),
              onKeydown: handleCreateKeydown,
              onBlur: handleCreateBlur
            }),
            h('button', {
              class: 'flex items-center justify-center w-22px h-22px rd-4px cursor-pointer border-none bg-primary/10 hover:bg-primary/20 text-primary dark:bg-primary/20 dark:hover:bg-primary/30',
              onClick: (e: Event) => { e.stopPropagation(); handleCreateConfirm(); },
              onMousedown: (e: Event) => e.preventDefault()
            }, [
              h(SvgIcon, { icon: 'mdi:check', size: 14 })
            ]),
            h('button', {
              class: 'flex items-center justify-center w-22px h-22px rd-4px cursor-pointer border-none bg-primary/10 hover:bg-primary/20 text-gray-500 dark:bg-primary/20 dark:hover:bg-primary/30',
              onClick: (e: Event) => { e.stopPropagation(); handleCreateCancel(); },
              onMousedown: (e: Event) => e.preventDefault()
            }, [
              h(SvgIcon, { icon: 'mdi:close', size: 14 })
            ])
          ]);
        }
        const isRenamingThis = diskStore.renamingFileId === row.fileId;
        if (isRenamingThis) {
          return h('div', { class: 'flex items-center gap-8px w-full' }, [
            h(FileIcon, {
              fileType: row.isFolder ? 'folder' : row.fileType,
              extension: row.fileExtension,
              size: 'small',
              fileId: row.fileId,
              mediaCover: row.mediaCover
            }),
            h(NInput, {
              ref: (el: any) => { renameInputRef.value = el; },
              value: renameName.value,
              'onUpdate:value': (val: string) => { renameName.value = val; },
              size: 'small',
              class: 'max-w-300px',
              onClick: (e: Event) => e.stopPropagation(),
              onKeydown: handleRenameKeydown
            }),
            h('button', {
              class: 'flex items-center justify-center w-22px h-22px rd-4px cursor-pointer border-none bg-primary/10 hover:bg-primary/20 text-primary dark:bg-primary/20 dark:hover:bg-primary/30',
              onClick: (e: Event) => { e.stopPropagation(); handleRenameConfirm(); },
              onMousedown: (e: Event) => e.preventDefault()
            }, [
              h(SvgIcon, { icon: 'mdi:check', size: 14 })
            ]),
            h('button', {
              class: 'flex items-center justify-center w-22px h-22px rd-4px cursor-pointer border-none bg-primary/10 hover:bg-primary/20 text-gray-500 dark:bg-primary/20 dark:hover:bg-primary/30',
              onClick: (e: Event) => { e.stopPropagation(); handleRenameCancel(); },
              onMousedown: (e: Event) => e.preventDefault()
            }, [
              h(SvgIcon, { icon: 'mdi:close', size: 14 })
            ])
          ]);
        }
        return h('div', { class: 'flex items-center gap-8px' }, [
          h('div', { class: 'relative shrink-0' }, [
            row.isFavorite ? h('div', {
              class: 'absolute top-0 left-0 z-10 bg-yellow-400 dark:bg-yellow-500 rd-full p-1px shadow-sm'
            }, [
              h(SvgIcon, { icon: 'mdi:star', size: 10, class: 'text-white' })
            ]) : null,
            h(FileIcon, {
              fileType: row.isFolder ? 'folder' : row.fileType,
              extension: row.fileExtension,
              size: 'small',
              fileId: row.fileId,
              mediaCover: row.mediaCover
            }),
            row.isShare ? h('div', {
              class: 'absolute top-0 right-0 z-10 bg-green-500 dark:bg-green-600 rd-full p-1px shadow-sm'
            }, [
              h(SvgIcon, { icon: 'mdi:share-variant', size: 10, class: 'text-white' })
            ]) : null,
            row.sharedUserCount ? h('div', {
              class: 'absolute bottom-0 left-0 z-10 bg-blue-500 dark:bg-blue-600 rd-full p-1px shadow-sm'
            }, [
              h(SvgIcon, { icon: 'mdi:account', size: 10, class: 'text-white' })
            ]) : null,
            row.sharedDeptCount ? h('div', {
              class: 'absolute bottom-0 right-0 z-10 bg-purple-500 dark:bg-purple-600 rd-full p-1px shadow-sm'
            }, [
              h(SvgIcon, { icon: 'mdi:office-building', size: 10, class: 'text-white' })
            ]) : null
          ]),
          h('div', { class: 'flex flex-col min-w-0' }, [
            h('span', { class: 'truncate' }, row.fileName),
            isMobile.value
              ? h(
                  'span',
                  { class: 'text-12px text-gray-400 dark:text-gray-500 truncate mt-1' },
                  row.isFolder
                    ? `${$t('page.disk.file.folder')} · ${row.modifyTime}`
                    : `${formatFileSize(row.fileSize)} · ${row.fileExtension?.toUpperCase() || '-'} · ${row.modifyTime}`
                )
              : null
          ])
        ]);
      }
    }
  ];

  if (!isMobile.value) {
    cols.push(
      {
        key: 'fileSize',
        title: $t('page.disk.file.size'),
        align: 'right',
        width: 150,
        render: row => {
          if (row.isFolder) return '-';
          return formatFileSize(row.fileSize);
        }
      },
      {
        key: 'fileType',
        title: $t('page.disk.file.type'),
        align: 'center',
        width: 150,
        render: row => {
          if (row.isFolder) return $t('page.disk.file.folder');
          return row.fileExtension?.toUpperCase() || '-';
        }
      },
      {
        key: 'modifyTime',
        title: $t('page.disk.file.modifyTime'),
        align: 'center',
        width: 200
      }
    );
  }

  return cols;
});

// 获取当前选中列表（优先使用 props，否则使用 diskStore）
const currentSelectedFiles = computed(() => {
  return props.selectedFiles ?? diskStore.selectedFiles;
});

function handleCheckedRowKeysChange(keys: CommonType.IdType[]) {
  const filtered = keys.filter(id => id !== CREATION_ROW_ID);
  if (props.selectedFiles !== undefined) {
    emit('selectionChange', filtered);
  } else {
    diskStore.setSelectedFiles(filtered);
  }
}

function handleRowDblClick(row: Api.Disk.FileItem) {
  // 回收站页面禁用双击预览
  if (props.pageType === 'trash') return;

  if (row.isFolder) {
    diskStore.enterFolder(row);
  } else {
    emit('fileDblClick', row);
  }
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

function getRowProps(row: Api.Disk.FileItem) {
  if ((row as any)._isCreating) return { style: 'cursor: default' };
  const selectId = getSelectId(row);
  return {
    style: 'cursor: pointer',
    ondblclick: () => handleRowDblClick(row),
    oncontextmenu: (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!currentSelectedFiles.value.includes(selectId)) {
        // 根据是否使用本地选中状态来更新
        if (props.selectedFiles !== undefined) {
          emit('selectionChange', [selectId]);
        } else {
          diskStore.setSelectedFiles([selectId]);
        }
      }
      ctxState.value = { visible: true, x: e.clientX, y: e.clientY, type: 'file', targetFile: row };
    }
  };
}

function getRowKey(row: Api.Disk.FileItem) {
  return (row as any)._isCreating ? CREATION_ROW_ID : getSelectId(row);
}

// 暴露滚动容器 ref 供父组件设置 IntersectionObserver root
// NDataTable 使用 virtual-scroll 时，内部有 .n-virtual-list 的滚动容器
const listWrapperRef = ref<HTMLElement | null>(null);

function getScrollContainer(): HTMLElement | null {
  if (!listWrapperRef.value) return null;
  // NDataTable virtual-scroll 的滚动容器是 .n-virtual-list 内部元素
  return listWrapperRef.value.querySelector('.n-virtual-list') ?? listWrapperRef.value.querySelector('.n-data-table-wrapper');
}

defineExpose({ scrollContainer: computed(getScrollContainer) });


</script>

<template>
  <div ref="listWrapperRef" class="h-full flex flex-col" @contextmenu.prevent="handleContextMenu">
    <!-- 空状态（正在创建时不展示） -->
    <FileEmpty v-if="showEmpty && !diskStore.creatingType" />

    <!-- 文件列表 -->
    <NDataTable
      v-if="!showEmpty || (!disableCreate && diskStore.creatingType)"
      :columns="columns"
      :data="tableData"
      :loading="loading"
      :checked-row-keys="currentSelectedFiles.filter(id => id !== CREATION_ROW_ID)"
      :row-key="getRowKey"
      :row-props="getRowProps"
      size="small"
      :flex-height="true"
      :virtual-scroll="true"
      class="flex-1"
      @update:checked-row-keys="handleCheckedRowKeysChange"
    />

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
</style>
