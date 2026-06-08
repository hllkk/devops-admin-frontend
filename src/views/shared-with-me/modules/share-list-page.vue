<script setup lang="ts">
import { h, ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue';
import type { DropdownOption } from 'naive-ui';
import { NTag } from 'naive-ui';
import { useRoute, useRouter } from 'vue-router';
import { useLoading } from '@sa/hooks';
import { useSvgIcon } from '@/hooks/common/icon';
import { $t } from '@/locales';
import { useDiskStore } from '@/store/modules/disk';
import { onSSEMessage } from '@/hooks/common/sse';
import {
  fetchGetSharedWithMeList,
  fetchGetSharedFolderContents,
  fetchCancelInternalShare,
  fetchBatchSaveToDrive,
  fetchRemoveSaveMount,
  fetchIsAllowDownload,
  fetchIsAllowPackageDownload,
  fetchRenameFile,
  fetchDeleteFile,
  fetchGetShareInfo,
  fetchAddRecent,
  fetchUploadToShareFolder,
  fetchCreateShareFolder
} from '@/service/api/disk';
import { formatFileSize } from '@/utils/format';
import { getServiceBaseURL } from '@/utils/service';
import { useFilePreview } from '@/hooks/business/disk/use-file-preview';
import ImagePreview from '@/components/preview/image-preview.vue';
import FilePreviewOverlays from '@/components/disk/file-preview-overlays.vue';
import FileIcon from '../../disk/modules/file-icon.vue';
import MoveCopyDialog from '../../disk/modules/move-copy-dialog.vue';
import ShareDialog from '../../disk/modules/share-dialog.vue';
import FileEmpty from '@/components/disk/file-empty.vue';
import SaveToDriveDialog from '../../disk/modules/save-to-drive-dialog.vue';
import ArchiveActionDialog from '@/components/disk/archive-action-dialog.vue';
import ArchivePreview from '@/components/preview/archive-preview.vue';

defineOptions({ name: 'ShareListPage' });

const props = withDefaults(
  defineProps<{
    shareType: 'user' | 'dept';
    showFilter?: boolean;
  }>(),
  { showFilter: false }
);

const isUserShare = computed(() => props.shareType === 'user');

const route = useRoute();
const router = useRouter();
const diskStore = useDiskStore();
const { loading, startLoading, endLoading } = useLoading();
const { SvgIconVNode } = useSvgIcon();

// --- State ---
const shareList = ref<Api.Disk.SharedWithMeItem[]>([]);
const total = ref(0);
const pagination = ref({ pageNum: 1, pageSize: 20 });
const checkedRowKeys = ref<number[]>([]);

const searchKeyword = ref('');
const contentTypeFilter = ref<string | null>(null);
const contentTypeOptions = [
  { label: $t('page.disk.sharedWithMe.image'), value: 'image/' },
  { label: $t('page.disk.sharedWithMe.video'), value: 'video/' },
  { label: $t('page.disk.sharedWithMe.audio'), value: 'audio/' },
  { label: $t('page.disk.sharedWithMe.document'), value: 'application/' }
];

const browsingFolder = ref<Api.Disk.SharedWithMeItem | null>(null);
const folderContents = ref<Api.Disk.FileItem[]>([]);
const folderTotal = ref(0);
const folderPagination = ref({ pageNum: 1, pageSize: 50 });
const folderPath = ref('');

const renamingFile = ref<Api.Disk.FileItem | null>(null);

const ctxMenuVisible = ref(false);
const ctxMenuX = ref(0);
const ctxMenuY = ref(0);
const ctxMenuFile = ref<Api.Disk.SharedWithMeItem | null>(null);
const ctxMenuFolderFile = ref<Api.Disk.FileItem | null>(null);

const imagePreviewRef = ref<InstanceType<typeof ImagePreview>>();

const existingShareInfo = ref<Api.Disk.ShareResult | null>(null);

// --- Save to drive dialog state ---
const saveToDriveVisible = ref(false);
const pendingSaveItems = ref<Array<{ shareId: number; fileId: number; fileName: string }>>([]);

// --- Upload state ---
const uploadFileInputRef = ref<HTMLInputElement>();
const uploading = ref(false);
const createFolderDialogVisible = ref(false);
const newFolderName = ref('');

// --- Computed ---
const checkedCount = computed(() => checkedRowKeys.value.length);
const isBrowsingFolder = computed(() => browsingFolder.value !== null);

// 响应式表格最大高度
const windowHeight = ref(window.innerHeight);
function updateWindowHeight() { windowHeight.value = window.innerHeight; }
const tableMaxHeight = computed(() => Math.max(300, windowHeight.value - 220));

// 检查当前浏览的共享文件夹是否有上传权限
const hasUploadPermission = computed(() => {
  if (!browsingFolder.value) return false;
  return browsingFolder.value.permissions.includes('UPLOAD');
});

const fileList = computed(() => shareList.value.map(convertToFileItem));

// 文件预览 hook
const preview = reactive(useFilePreview({ fileList, imagePreviewRef }));

const showEmpty = computed(() => {
  if (isBrowsingFolder.value) return folderContents.value.length === 0 && !loading.value;
  return shareList.value.length === 0 && !loading.value;
});

const breadcrumbItems = computed(() => {
  if (!browsingFolder.value) return [];
  const items: { name: string; path: string }[] = [{ name: browsingFolder.value.fileName, path: '' }];
  if (folderPath.value) {
    const parts = folderPath.value.split('/').filter(Boolean);
    for (let i = 1; i < parts.length; i++) {
      items.push({ name: parts[i], path: parts.slice(0, i + 1).join('/') });
    }
  }
  return items;
});

// --- Utility functions ---
function contentTypeToFileType(contentType: string, isFolder: boolean): string {
  if (isFolder) return 'folder';
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('image')) return 'image';
  if (ct.includes('video')) return 'video';
  if (ct.includes('audio')) return 'audio';
  if (ct.includes('pdf') || ct.includes('document') || ct.includes('word') || ct.includes('text')) return 'document';
  if (ct.includes('spreadsheet') || ct.includes('excel') || ct.includes('xls')) return 'document';
  if (ct.includes('presentation') || ct.includes('ppt') || ct.includes('powerpoint')) return 'document';
  if (ct.includes('zip') || ct.includes('rar') || ct.includes('7z') || ct.includes('tar') || ct.includes('compressed'))
    return 'other';
  return 'other';
}

function getFileExtension(fileName: string): string | undefined {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === fileName.length - 1) return undefined;
  return fileName.slice(dotIndex + 1).toLowerCase();
}

function convertToFileItem(item: Api.Disk.SharedWithMeItem): Api.Disk.FileItem {
  const ext = getFileExtension(item.fileName);
  return {
    fileId: item.fileId,
    fileName: item.fileName,
    fileType: contentTypeToFileType(item.contentType, item.isFolder),
    fileExtension: ext,
    fileSize: item.size,
    filePath: '',
    parentId: null,
    isFolder: item.isFolder,
    modifyTime: item.createdAt,
    createTime: item.createdAt,
    updateTime: item.createdAt,
    createBy: '',
    updateBy: '',
    mediaCover: item.mediaCover || false,
    // 兼容性别名
    id: item.fileId,
    name: item.fileName,
    size: item.size,
    isDir: item.isFolder,
    extendName: ext,
    contentType: item.contentType
  };
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getPermLabel(p: string): string {
  const map: Record<string, string> = {
    DOWNLOAD: $t('page.disk.sharedWithMe.permDownload'),
    UPLOAD: $t('page.disk.sharedWithMe.permUpload'),
    PUT: $t('page.disk.sharedWithMe.permEdit'),
    DELETE: $t('page.disk.sharedWithMe.permDelete'),
    SHARE: $t('page.disk.sharedWithMe.permShare')
  };
  return map[p] || p;
}

const permissionTagTypeMap: Record<string, 'success' | 'info' | 'warning' | 'error'> = {
  DOWNLOAD: 'success',
  UPLOAD: 'info',
  PUT: 'warning',
  DELETE: 'error',
  SHARE: 'info'
};

// --- Cancel share (unified by shareType) ---
async function cancelShare(id: number) {
  return isUserShare.value ? await fetchCancelInternalShare(id) : await fetchCancelInternalShare(id);
}

// --- Data fetching ---
async function getData() {
  startLoading();
  checkedRowKeys.value = [];
  const params: Record<string, unknown> = { ...pagination.value, shareType: props.shareType };
  if (props.showFilter) {
    if (searchKeyword.value) params.keyword = searchKeyword.value;
    if (contentTypeFilter.value) params.contentType = contentTypeFilter.value;
  }
  const { data, error } = await fetchGetSharedWithMeList(params as Parameters<typeof fetchGetSharedWithMeList>[0]);
  endLoading();
  if (!error && data) {
    shareList.value = data.rows || [];
    total.value = data.total;
  }
}

async function getFolderContents(path?: string) {
  if (!browsingFolder.value) return;
  startLoading();
  const newPath = path ?? folderPath.value;
  const { data, error } = await fetchGetSharedFolderContents({
    fileId: browsingFolder.value.fileId,
    path: newPath,
    pageNum: folderPagination.value.pageNum,
    pageSize: folderPagination.value.pageSize
  });
  endLoading();
  if (!error && data) {
    folderContents.value = data.rows || [];
    folderTotal.value = data.total;
    folderPath.value = newPath;
    syncUrlState();
  }
}

// --- Navigation ---
function enterSharedFolder(item: Api.Disk.SharedWithMeItem) {
  browsingFolder.value = item;
  folderPath.value = '';
  folderPagination.value.pageNum = 1;
  syncUrlState();
  getFolderContents();
}

function exitSharedFolder() {
  browsingFolder.value = null;
  folderContents.value = [];
  folderPath.value = '';
  syncUrlState();
}

function handleBreadcrumbClick(path: string) {
  folderPagination.value.pageNum = 1;
  getFolderContents(path || '');
}

// --- URL state sync ---
function syncUrlState() {
  const query: Record<string, string> = {};
  if (browsingFolder.value) {
    query.shareId = String(browsingFolder.value.fileShareId);
    if (folderPath.value) {
      query.path = folderPath.value;
    }
  }
  router.replace({ name: route.name as string, query });
}

async function restoreFromUrl() {
  const shareId = route.query.shareId as string;
  if (!shareId) return;

  const params: Record<string, unknown> = { pageNum: 1, pageSize: 200, shareType: props.shareType };
  const { data } = await fetchGetSharedWithMeList(params as Parameters<typeof fetchGetSharedWithMeList>[0]);
  if (!data?.rows) return;

  const item = data.rows.find((r: Api.Disk.SharedWithMeItem) => String(r.fileShareId) === shareId);
  if (!item) return;

  browsingFolder.value = item;
  const urlPath = (route.query.path as string) || '';
  folderPath.value = urlPath;
  folderPagination.value.pageNum = 1;
  if (urlPath) {
    getFolderContents(urlPath);
  } else {
    getFolderContents();
  }
}

// Watch for browser back/forward
watch(() => route.query.shareId, async (newShareId, oldShareId) => {
  if (newShareId === oldShareId) return;
  // Skip during initial mount (handled by onMounted)
  if (!oldShareId && newShareId) return;

  if (!newShareId) {
    browsingFolder.value = null;
    folderContents.value = [];
    folderPath.value = '';
  } else {
    const shareId = newShareId as string;
    const path = (route.query.path as string) || '';
    const params: Record<string, unknown> = { pageNum: 1, pageSize: 200, shareType: props.shareType };
    const { data } = await fetchGetSharedWithMeList(params as Parameters<typeof fetchGetSharedWithMeList>[0]);
    if (data?.rows) {
      const item = data.rows.find((r: Api.Disk.SharedWithMeItem) => String(r.fileShareId) === shareId);
      if (item) {
        browsingFolder.value = item;
        folderPath.value = path;
        getFolderContents(path || undefined);
      }
    }
  }
});

// --- Upload to share folder ---
function handleUploadClick() {
  if (!hasUploadPermission.value) {
    window.$message?.warning($t('page.disk.sharedWithMe.noUploadPermission'));
    return;
  }
  uploadFileInputRef.value?.click();
}

async function handleUploadFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !browsingFolder.value) return;

  uploading.value = true;
  try {
    const { error } = await fetchUploadToShareFolder({
      shareFileId: browsingFolder.value.fileId,
      relativePath: folderPath.value,
      file
    });
    if (!error) {
      window.$message?.success($t('page.disk.sharedWithMe.uploadSuccess'));
      getFolderContents();
    }
  } finally {
    uploading.value = false;
    input.value = '';
  }
}

// --- Create folder in share folder ---
function handleCreateFolderClick() {
  if (!hasUploadPermission.value) {
    window.$message?.warning($t('page.disk.sharedWithMe.noUploadPermission'));
    return;
  }
  newFolderName.value = '';
  createFolderDialogVisible.value = true;
}

async function handleCreateFolderConfirm() {
  if (!newFolderName.value.trim() || !browsingFolder.value) return;

  const { error } = await fetchCreateShareFolder({
    shareFileId: browsingFolder.value.fileId,
    folderName: newFolderName.value.trim(),
    parentPath: folderPath.value
  });
  if (!error) {
    window.$message?.success($t('page.disk.sharedWithMe.createFolderSuccess'));
    createFolderDialogVisible.value = false;
    getFolderContents();
  }
}

// --- Context menu ---
function getShareCtxMenu(item: Api.Disk.SharedWithMeItem): DropdownOption[] {
  const permissions = item.permissions;
  const options: DropdownOption[] = [
    { label: $t('page.disk.contextMenu.open'), key: 'open', icon: SvgIconVNode({ icon: 'mdi:open-in-new', fontSize: 18 }) }
  ];
  if (permissions.includes('DOWNLOAD')) {
    options.push({ label: $t('page.disk.contextMenu.download'), key: 'download', icon: SvgIconVNode({ icon: 'mdi:download-outline', fontSize: 18 }) });
    if (isUserShare.value) {
      if (item.isMounted) {
        options.push({ label: $t('page.disk.sharedWithMe.removeFromDrive'), key: 'removeFromDrive', icon: SvgIconVNode({ icon: 'mdi:link-off', fontSize: 18 }) });
      } else {
        options.push({ label: $t('page.disk.sharedWithMe.saveToDrive'), key: 'saveToDrive', icon: SvgIconVNode({ icon: 'mdi:content-save-outline', fontSize: 18 }) });
      }
    }
  }
  if (permissions.includes('PUT')) {
    options.push({ label: $t('page.disk.contextMenu.rename'), key: 'rename', icon: SvgIconVNode({ icon: 'mdi:pencil-outline', fontSize: 18 }) });
    options.push({ label: $t('page.disk.contextMenu.copy'), key: 'copy', icon: SvgIconVNode({ icon: 'mdi:content-copy', fontSize: 18 }) });
    options.push({ label: $t('page.disk.contextMenu.move'), key: 'move', icon: SvgIconVNode({ icon: 'mdi:folder-move-outline', fontSize: 18 }) });
  }
  if (permissions.includes('SHARE')) {
    options.push({ label: $t('page.disk.contextMenu.share'), key: 'share', icon: SvgIconVNode({ icon: 'mdi:share-outline', fontSize: 18 }) });
  }
  options.push({ type: 'divider', key: 'd1' });
  options.push({ label: $t('page.disk.sharedWithMe.exitShare'), key: 'exitShare', icon: SvgIconVNode({ icon: 'mdi:link-off', fontSize: 18 }) });
  return options;
}

function getFolderCtxMenu(parentPermissions: string[]): DropdownOption[] {
  const options: DropdownOption[] = [
    { label: $t('page.disk.contextMenu.open'), key: 'open', icon: SvgIconVNode({ icon: 'mdi:open-in-new', fontSize: 18 }) }
  ];
  if (parentPermissions.includes('DOWNLOAD')) {
    options.push({ label: $t('page.disk.contextMenu.download'), key: 'download', icon: SvgIconVNode({ icon: 'mdi:download-outline', fontSize: 18 }) });
  }
  if (parentPermissions.includes('PUT')) {
    options.push({ label: $t('page.disk.contextMenu.rename'), key: 'rename', icon: SvgIconVNode({ icon: 'mdi:pencil-outline', fontSize: 18 }) });
    options.push({ label: $t('page.disk.contextMenu.copy'), key: 'copy', icon: SvgIconVNode({ icon: 'mdi:content-copy', fontSize: 18 }) });
    options.push({ label: $t('page.disk.contextMenu.move'), key: 'move', icon: SvgIconVNode({ icon: 'mdi:folder-move-outline', fontSize: 18 }) });
  }
  if (parentPermissions.includes('DELETE')) {
    options.push({ label: $t('page.disk.contextMenu.delete'), key: 'delete', icon: SvgIconVNode({ icon: 'mdi:delete-outline', fontSize: 18 }) });
  }
  return options;
}

function handleContextMenu(e: MouseEvent, row: Api.Disk.SharedWithMeItem) {
  e.preventDefault();
  ctxMenuX.value = e.clientX;
  ctxMenuY.value = e.clientY;
  ctxMenuFile.value = row;
  ctxMenuFolderFile.value = null;
  ctxMenuVisible.value = true;
}

function handleFolderContextMenu(e: MouseEvent, row: Api.Disk.FileItem) {
  e.preventDefault();
  ctxMenuX.value = e.clientX;
  ctxMenuY.value = e.clientY;
  ctxMenuFile.value = null;
  ctxMenuFolderFile.value = row;
  ctxMenuVisible.value = true;
}

function handleCtxMenuSelect(key: string) {
  ctxMenuVisible.value = false;

  if (ctxMenuFolderFile.value) {
    const file = ctxMenuFolderFile.value;
    switch (key) {
      case 'open': handleFolderFileDblClick(file); break;
      case 'download': if (!file.isDir) handleFolderFileDownload(file); break;
      case 'rename':
        diskStore.startRenaming(file.fileId, file.fileName || file.name || '');
        renamingFile.value = file;
        break;
      case 'copy': diskStore.openMoveCopyDialog('copy', [file]); break;
      case 'move': diskStore.openMoveCopyDialog('move', [file]); break;
      case 'delete': handleFolderFileDelete(file); break;
    }
    return;
  }

  const item = ctxMenuFile.value;
  if (!item) return;

  const file = convertToFileItem(item);
  switch (key) {
    case 'open': handleShareFileDblClick(item); break;
    case 'download': handleDownload([file]); break;
    case 'saveToDrive': if (isUserShare.value) handleSaveToMyDrive(item); break;
    case 'removeFromDrive': if (isUserShare.value) handleRemoveFromDrive(item); break;
    case 'rename':
      diskStore.startRenaming(item.fileId, item.fileName);
      renamingFile.value = file;
      break;
    case 'copy': diskStore.openMoveCopyDialog('copy', [file]); break;
    case 'move': diskStore.openMoveCopyDialog('move', [file]); break;
    case 'share': handleShareFile(file); break;
    case 'exitShare': handleCancelSingle(item.fileShareId, item.fileName); break;
  }
}

// --- File double-click ---
async function handleShareFileDblClick(item: Api.Disk.SharedWithMeItem) {
  if (item.isFolder) {
    enterSharedFolder(item);
    return;
  }

  if (isUserShare.value && !item.permissions.includes('DOWNLOAD')) {
    window.$notification?.warning({ content: $t('page.disk.sharedWithMe.noPreviewPermission'), duration: 3000 });
    return;
  }

  const file = convertToFileItem(item);
  fetchAddRecent(file.fileId);
  preview.previewByCategory(file);
}

async function handleFolderFileDblClick(file: Api.Disk.FileItem) {
  if (file.isDir || file.isFolder) {
    // 计算正确的子文件夹路径
    // 当 folderPath 为空时，表示在共享文件夹根目录，需要拼接共享文件夹名 + 子文件夹名
    // 当 folderPath 不为空时，直接拼接当前路径 + 子文件夹名
    let newPath: string;
    if (folderPath.value) {
      newPath = `${folderPath.value}/${file.fileName || file.name}`;
    } else {
      // 在共享文件夹根目录，子文件夹的完整路径是: /共享文件夹名/子文件夹名
      const shareFolderName = browsingFolder.value?.fileName || '';
      newPath = shareFolderName ? `${shareFolderName}/${file.fileName || file.name}` : (file.fileName || file.name || '');
    }
    folderPagination.value.pageNum = 1;
    getFolderContents(newPath);
    return;
  }

  fetchAddRecent(file.fileId);
  preview.previewByCategory(file, { folderFiles: folderContents.value });
}

// --- Download ---
function triggerBrowserDownload(downloadUrl: string) {
  const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
  const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);
  const link = document.createElement('a');
  link.href = `${baseURL}${downloadUrl}`;
  link.style.display = 'none';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function handleDownload(files: Api.Disk.FileItem[]) {
  if (files.length === 0) return;
  if (files.length === 1 && !files[0].isFolder) {
    const { data, error } = await fetchIsAllowDownload([files[0].fileId]);
    if (error || !data?.allowDownload) {
      window.$message?.error($t('page.disk.sharedWithMe.downloadFailed'));
      return;
    }
    triggerBrowserDownload(data.downloadUrl);
    return;
  }
  const fileIds = files.map(f => f.fileId);
  const { data, error } = await fetchIsAllowPackageDownload(fileIds);
  if (error || !data?.allowDownload) {
    window.$message?.error($t('page.disk.sharedWithMe.downloadFailed'));
    return;
  }
  triggerBrowserDownload(data.downloadUrl);
}

async function handleFolderFileDownload(file: Api.Disk.FileItem) {
  const { data, error } = await fetchIsAllowDownload([file.fileId]);
  if (error || !data?.allowDownload) {
    window.$message?.error($t('page.disk.sharedWithMe.downloadFailed'));
    return;
  }
  triggerBrowserDownload(data.downloadUrl);
}

async function handleFolderFileDelete(file: Api.Disk.FileItem) {
  const fileName = file.fileName || file.name || '';
  window.$dialog?.warning({
    title: $t('page.disk.contextMenu.delete'),
    content: `${fileName}`,
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      const { error } = await fetchDeleteFile([file.fileId]);
      if (!error) {
        window.$message?.success($t('common.deleteSuccess'));
        getFolderContents();
      }
    }
  });
}

// --- File operations ---
async function handleRenameConfirm(newName: string) {
  if (!renamingFile.value || !newName.trim()) return;
  if (newName.trim() === renamingFile.value.fileName) {
    diskStore.cancelRenaming();
    renamingFile.value = null;
    return;
  }
  const { error } = await fetchRenameFile(renamingFile.value.fileId, newName.trim());
  if (!error) {
    window.$message?.success($t('page.disk.moveCopy.renameSuccess'));
    diskStore.cancelRenaming();
    renamingFile.value = null;
    if (isBrowsingFolder.value) {
      getFolderContents();
    } else {
      getData();
    }
  }
}

async function handleShareFile(file: Api.Disk.FileItem) {
  existingShareInfo.value = null;
  const { data } = await fetchGetShareInfo(file.fileId);
  if (data) existingShareInfo.value = data;
  diskStore.openShareDialog(file);
}

function handleBatchSaveToDrive() {
  const selectedItems = shareList.value.filter(item => checkedRowKeys.value.includes(item.fileShareId));
  if (selectedItems.length === 0) return;
  pendingSaveItems.value = selectedItems.map(item => ({
    shareId: item.fileShareId,
    fileId: item.fileId,
    fileName: item.fileName
  }));
  saveToDriveVisible.value = true;
}

async function handleRemoveFromDrive(item: Api.Disk.SharedWithMeItem) {
  window.$dialog?.warning({
    title: $t('page.disk.sharedWithMe.removeFromDrive'),
    content: $t('page.disk.sharedWithMe.removeFromDriveConfirm', { name: item.fileName }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      const { error } = await fetchRemoveSaveMount(item.fileId);
      if (!error) {
        window.$message?.success($t('page.disk.sharedWithMe.removeFromDriveSuccess'));
        getData();
      }
    }
  });
}

async function handleSaveToMyDrive(item: Api.Disk.SharedWithMeItem) {
  pendingSaveItems.value = [{
    shareId: item.fileShareId,
    fileId: item.fileId,
    fileName: item.fileName
  }];
  saveToDriveVisible.value = true;
}

async function handleSaveToDriveConfirm(targetFolderId: CommonType.IdType) {
  const { data, error } = await fetchBatchSaveToDrive(pendingSaveItems.value, Number(targetFolderId));
  if (!error && data) {
    if (data.renamedCount > 0) {
      const renamedList = data.results.filter(r => r.isRenamed).map(r => `"${r.originalName}" → "${r.savedName}"`).join(', ');
      window.$message?.warning($t('page.disk.sharedWithMe.saveSuccessRenamed', { list: renamedList }));
    } else {
      window.$message?.success($t('page.disk.sharedWithMe.saveToDriveSuccess'));
    }
    saveToDriveVisible.value = false;
    getData();
  }
}

async function handleBatchCancel() {
  if (checkedRowKeys.value.length === 0) return;
  window.$dialog?.warning({
    title: $t('page.disk.sharedWithMe.exitShare'),
    content: $t('page.disk.sharedWithMe.batchExitConfirm', { count: checkedRowKeys.value.length }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      startLoading();
      let failCount = 0;
      for (const id of checkedRowKeys.value) {
        const { error } = await cancelShare(id);
        if (error) failCount++;
      }
      endLoading();
      if (failCount === 0) {
        window.$message?.success($t('page.disk.sharedWithMe.exitSuccess'));
      } else {
        window.$message?.warning($t('page.disk.sharedWithMe.exitFailCount', { count: failCount }));
      }
      getData();
    }
  });
}

async function handleCancelSingle(id: number, fileName: string) {
  window.$dialog?.warning({
    title: $t('page.disk.sharedWithMe.exitShare'),
    content: $t('page.disk.sharedWithMe.exitConfirm', { name: fileName }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      const { error } = await cancelShare(id);
      if (!error) {
        window.$message?.success($t('page.disk.sharedWithMe.exitSuccess'));
        getData();
      }
    }
  });
}

// --- Table columns ---
const shareColumns = computed(() => {
  const cols: any[] = [
    { type: 'selection' as const, width: 48 },
    {
      key: 'fileName',
      title: $t('page.disk.sharedWithMe.fileName'),
      width: 280,
      render(row: Api.Disk.SharedWithMeItem) {
        const isRenaming = diskStore.renamingFileId === row.fileId;
        if (isRenaming) {
          return h('div', { class: 'flex items-center gap-8px' }, [
            h(FileIcon, { fileType: contentTypeToFileType(row.contentType, row.isFolder), extension: getFileExtension(row.fileName), size: 'medium', fileId: row.fileId, mediaCover: row.mediaCover }),
            h('input', {
              class: 'flex-1 min-w-0 h-28px px-8px text-14px border border-primary rounded outline-none bg-transparent',
              value: row.fileName,
              onKeyup: (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                  handleRenameConfirm((e.target as HTMLInputElement).value);
                } else if (e.key === 'Escape') {
                  diskStore.cancelRenaming();
                  renamingFile.value = null;
                }
              },
              onBlur: (e: FocusEvent) => {
                const val = (e.target as HTMLInputElement).value.trim();
                if (val && val !== row.fileName) handleRenameConfirm(val);
                else { diskStore.cancelRenaming(); renamingFile.value = null; }
              },
              autofocus: true
            })
          ]);
        }

        const children: any[] = [
          h(FileIcon, { fileType: contentTypeToFileType(row.contentType, row.isFolder), extension: getFileExtension(row.fileName), size: 'medium', fileId: row.fileId, mediaCover: row.mediaCover }),
          h('span', { class: 'flex-1 truncate', style: 'min-width:0' }, row.fileName)
        ];

        // Show mounted status or exit button
        if (isUserShare.value && row.isMounted) {
          children.push(
            h(NTag, { size: 'small', type: 'success' }, () => $t('page.disk.sharedWithMe.mounted'))
          );
        } else {
          children.push(
            h('button', {
              class: 'opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:opacity-80 p-0 bg-transparent border-none shrink-0',
              title: $t('page.disk.sharedWithMe.exitShare'),
              onClick: (e: MouseEvent) => { e.stopPropagation(); handleCancelSingle(row.fileShareId, row.fileName); }
            }, h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', width: '16', height: '16', class: 'text-error' }, [
              h('path', { d: 'M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', fill: 'none' })
            ]))
          );
        }

        return h('div', { class: 'flex items-center gap-8px group' }, children);
      }
    },
    {
      key: 'shareUserName',
      title: $t('page.disk.sharedWithMe.sharedBy'),
      width: 120,
      render(row: Api.Disk.SharedWithMeItem) {
        return h('span', { class: 'text-13px opacity-70' }, row.shareUserName);
      }
    }
  ];

  if (isUserShare.value) {
    cols.splice(3, 0, {
      key: 'sourceLabel',
      title: $t('page.disk.sharedWithMe.source'),
      width: 120,
      render(row: Api.Disk.SharedWithMeItem) {
        return h('span', { class: 'text-13px opacity-60' }, row.sourceLabel || '-');
      }
    });
  }

  cols.push(
    {
      key: 'permissions',
      title: $t('page.disk.sharedWithMe.permissions'),
      width: 180,
      render(row: Api.Disk.SharedWithMeItem) {
        return h('div', { class: 'flex flex-wrap gap-4px' },
          row.permissions.map(p => h(NTag, { size: 'small', type: permissionTagTypeMap[p] || 'default' }, () => getPermLabel(p)))
        );
      }
    },
    {
      key: 'size',
      title: $t('page.disk.sharedWithMe.size'),
      width: 100,
      align: 'right' as const,
      render(row: Api.Disk.SharedWithMeItem) {
        if (row.isFolder) return '-';
        return h('span', { class: 'text-13px opacity-70' }, formatFileSize(row.size));
      }
    },
    {
      key: 'createdAt',
      title: $t('page.disk.sharedWithMe.shareTime'),
      width: 130,
      render(row: Api.Disk.SharedWithMeItem) {
        return h('span', { class: 'text-13px opacity-70' }, formatDateTime(row.createdAt));
      }
    }
  );

  return cols;
});

const folderColumns = [
  {
    key: 'fileName',
    title: $t('page.disk.sharedWithMe.fileName'),
    width: 300,
    render(row: Api.Disk.FileItem) {
      const isRenaming = diskStore.renamingFileId === row.fileId;
      if (isRenaming) {
        return h('div', { class: 'flex items-center gap-8px' }, [
          h(FileIcon, { fileType: row.isDir ? 'folder' : contentTypeToFileType(row.contentType || '', false), extension: row.fileExtension || row.extendName, size: 'medium', fileId: row.fileId, mediaCover: row.mediaCover }),
          h('input', {
            class: 'flex-1 min-w-0 h-28px px-8px text-14px border border-primary rounded outline-none bg-transparent',
            value: row.fileName || row.name,
            onKeyup: (e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                handleRenameConfirm((e.target as HTMLInputElement).value);
              } else if (e.key === 'Escape') {
                diskStore.cancelRenaming();
                renamingFile.value = null;
              }
            },
            onBlur: (e: FocusEvent) => {
              const val = (e.target as HTMLInputElement).value.trim();
              const originalName = row.fileName || row.name || '';
              if (val && val !== originalName) handleRenameConfirm(val);
              else { diskStore.cancelRenaming(); renamingFile.value = null; }
            },
            autofocus: true
          })
        ]);
      }
      return h('div', { class: 'flex items-center gap-8px' }, [
        h(FileIcon, { fileType: row.isDir ? 'folder' : contentTypeToFileType(row.contentType || '', false), extension: row.fileExtension || row.extendName, size: 'medium', fileId: row.fileId, mediaCover: row.mediaCover }),
        h('span', { class: 'flex-1 truncate', style: 'min-width:0' }, row.fileName || row.name)
      ]);
    }
  },
  {
    key: 'fileSize',
    title: $t('page.disk.sharedWithMe.size'),
    width: 100,
    align: 'right' as const,
    render(row: Api.Disk.FileItem) {
      if (row.isDir || row.isFolder) return '-';
      return formatFileSize(row.fileSize || row.size || 0);
    }
  },
  {
    key: 'updateTime',
    title: $t('page.disk.sharedWithMe.modifyTime'),
    width: 150,
    render(row: Api.Disk.FileItem) {
      return h('span', { class: 'text-13px opacity-70' }, row.updateTime || row.modifyTime);
    }
  }
];

const rowKey = (row: Api.Disk.SharedWithMeItem) => row.fileShareId;
const folderRowKey = (row: Api.Disk.FileItem) => row.fileId;

function getShareRowProps(row: Api.Disk.SharedWithMeItem) {
  return {
    style: 'cursor: pointer',
    ondblclick: () => handleShareFileDblClick(row),
    oncontextmenu: (e: MouseEvent) => { e.preventDefault(); handleContextMenu(e, row); }
  };
}

function getFolderRowProps(row: Api.Disk.FileItem) {
  return {
    style: 'cursor: pointer',
    ondblclick: () => handleFolderFileDblClick(row),
    oncontextmenu: (e: MouseEvent) => { e.preventDefault(); handleFolderContextMenu(e, row); }
  };
}

// --- Pagination ---
function handlePageChange(page: number) {
  if (isBrowsingFolder.value) {
    folderPagination.value.pageNum = page;
    getFolderContents();
  } else {
    pagination.value.pageNum = page;
    getData();
  }
}

// --- Init ---
// SSE 订阅：监听新共享事件，自动刷新列表
const unsubscribe = onSSEMessage('share_created', () => {
  if (!isBrowsingFolder.value) {
    getData();
  }
});

onMounted(async () => {
  window.addEventListener('resize', updateWindowHeight);
  await getData();
  if (route.query.shareId) {
    await restoreFromUrl();
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', updateWindowHeight);
  unsubscribe();
});
</script>

<template>
  <div class="h-full flex-col-stretch gap-0 overflow-hidden lt-lg:overflow-auto">
    <NCard :bordered="false" size="small" class="card-wrapper h-full flex-1-hidden">
      <div class="h-full flex flex-col">
        <!-- Search & filter bar (user share only) -->
        <div v-if="showFilter && !isBrowsingFolder" class="flex items-center gap-8px px-4px py-8px lt-sm:flex-wrap">
          <NInput
            v-model:value="searchKeyword"
            :placeholder="$t('page.disk.sharedWithMe.searchPlaceholder')"
            clearable
            class="max-w-240px lt-sm:max-w-full"
            @keyup.enter="getData"
            @clear="getData"
          />
          <NSelect
            v-model:value="contentTypeFilter"
            :options="contentTypeOptions"
            clearable
            :placeholder="$t('page.disk.sharedWithMe.fileType')"
            class="w-120px lt-sm:w-full"
            @update:value="getData"
          />
          <NButton size="small" quaternary @click="getData">
            <template #icon><icon-mdi-refresh class="text-16px" /></template>
            {{ $t('page.disk.sharedWithMe.refresh') }}
          </NButton>
        </div>

        <!-- Breadcrumb navigation (folder browsing mode) -->
        <div v-if="isBrowsingFolder" class="flex items-center gap-8px px-4px py-8px">
          <NButton size="small" quaternary @click="exitSharedFolder">
            <template #icon><icon-mdi-arrow-left class="text-16px" /></template>
            {{ $t('page.disk.sharedWithMe.back') }}
          </NButton>
          <div class="flex items-center gap-4px flex-1 overflow-hidden">
            <template v-for="(item, index) in breadcrumbItems" :key="index">
              <span v-if="index > 0" class="opacity-50">/</span>
              <NButton size="tiny" quaternary :disabled="index === breadcrumbItems.length - 1" @click="handleBreadcrumbClick(item.path)">
                {{ item.name }}
              </NButton>
            </template>
          </div>
          <!-- Upload and Create folder buttons (when has permission) -->
          <NButton v-if="hasUploadPermission" size="small" type="primary" :loading="uploading" @click="handleUploadClick">
            <template #icon><icon-mdi-upload class="text-16px" /></template>
            {{ $t('page.disk.sharedWithMe.upload') }}
          </NButton>
          <NButton v-if="hasUploadPermission" size="small" quaternary @click="handleCreateFolderClick">
            <template #icon><icon-mdi-folder-plus class="text-16px" /></template>
            {{ $t('page.disk.sharedWithMe.newFolder') }}
          </NButton>
          <!-- Hidden file input for upload -->
          <input ref="uploadFileInputRef" type="file" class="hidden" @change="handleUploadFileChange" />
        </div>

        <!-- Selection action bar -->
        <div v-if="!isBrowsingFolder && checkedCount > 0" class="flex items-center gap-12px px-4px py-8px">
          <span class="text-13px opacity-70">{{ $t('page.disk.sharedWithMe.selectedCount', { count: checkedCount }) }}</span>
          <NButton v-if="isUserShare" size="small" type="primary" @click="handleBatchSaveToDrive">{{ $t('page.disk.sharedWithMe.batchSaveToDrive') }}</NButton>
          <NButton size="small" type="error" @click="handleBatchCancel">{{ $t('page.disk.sharedWithMe.exitShare') }}</NButton>
        </div>

        <!-- Content area -->
        <div class="flex-1 min-h-0 overflow-auto">
          <FileEmpty v-if="showEmpty" :description="isBrowsingFolder ? $t('page.disk.sharedWithMe.folderEmpty') : (isUserShare ? $t('page.disk.sharedWithMe.empty') : $t('page.disk.groupShare.empty'))" />

          <!-- PC: table view -->
          <template v-if="!showEmpty">
            <NDataTable
              v-if="!isBrowsingFolder"
              class="lt-sm:hidden"
              :columns="shareColumns"
              :data="shareList"
              :row-key="rowKey"
              :row-props="getShareRowProps"
              :loading="loading"
              :checked-row-keys="checkedRowKeys"
              :max-height="tableMaxHeight"
              :scroll-x="1000"
              @update:checked-row-keys="checkedRowKeys = $event as number[]"
            />
            <NDataTable
              v-if="isBrowsingFolder"
              class="lt-sm:hidden"
              :columns="folderColumns"
              :data="folderContents"
              :row-key="folderRowKey"
              :row-props="getFolderRowProps"
              :loading="loading"
              :max-height="tableMaxHeight"
              :scroll-x="600"
            />
          </template>

          <!-- Mobile: card view -->
          <NSpin v-if="!showEmpty" :show="loading" class="sm:hidden lt-sm:block">
            <!-- Share list cards -->
            <div v-if="!isBrowsingFolder && shareList.length > 0" class="flex flex-col gap-12px p-12px">
              <div
                v-for="item in shareList"
                :key="item.fileShareId"
                class="flex flex-col gap-8px p-12px rd-8px bg-gray-50 dark:bg-gray-800 cursor-pointer"
                @click="handleShareFileDblClick(item)"
              >
                <div class="flex items-center gap-8px">
                  <FileIcon :file-type="contentTypeToFileType(item.contentType, item.isFolder)" :extension="getFileExtension(item.fileName)" size="medium" :file-id="item.fileId" :media-cover="item.mediaCover" />
                  <span class="flex-1 truncate text-14px font-medium">{{ item.fileName }}</span>
                </div>

                <div class="flex items-center gap-8px text-12px">
                  <span class="opacity-50">{{ $t('page.disk.sharedWithMe.from') }}：</span>
                  <span class="opacity-70">{{ item.shareUserName }}</span>
                  <div class="flex flex-wrap gap-4px ml-auto">
                    <NTag v-for="p in item.permissions" :key="p" size="small" :type="permissionTagTypeMap[p] || 'default'">{{ getPermLabel(p) }}</NTag>
                  </div>
                </div>

                <div class="flex items-center text-12px opacity-60">
                  <span>{{ formatDateShort(item.createdAt) }} {{ $t('page.disk.sharedWithMe.shareTime') }}</span>
                </div>

                <div class="flex items-center justify-end gap-8px pt-4px">
                  <NButton size="tiny" quaternary @click.stop="handleDownload([convertToFileItem(item)])">{{ $t('page.disk.sharedWithMe.permDownload') }}</NButton>
                  <NButton v-if="isUserShare && item.isMounted" size="tiny" quaternary type="warning" @click.stop="handleRemoveFromDrive(item)">
                    {{ $t('page.disk.sharedWithMe.removeFromDrive') }}
                  </NButton>
                  <NButton v-else-if="isUserShare && !item.isMounted" size="tiny" quaternary @click.stop="handleSaveToMyDrive(item)">
                    {{ $t('page.disk.sharedWithMe.saveToDrive') }}
                  </NButton>
                  <NButton size="tiny" quaternary @click.stop="handleShareFile(convertToFileItem(item))">{{ $t('page.disk.sharedWithMe.permShare') }}</NButton>
                  <NButton size="tiny" type="error" quaternary @click.stop="handleCancelSingle(item.fileShareId, item.fileName)">{{ $t('page.disk.sharedWithMe.exitShare') }}</NButton>
                </div>
              </div>
            </div>

            <!-- Folder content cards -->
            <div v-if="isBrowsingFolder && folderContents.length > 0" class="flex flex-col gap-12px p-12px">
              <NButton size="small" quaternary block @click="exitSharedFolder">
                <template #icon><icon-mdi-arrow-left class="text-16px" /></template>
                {{ $t('page.disk.sharedWithMe.backToShareList') }}
              </NButton>
              <div
                v-for="file in folderContents"
                :key="file.fileId"
                class="flex items-center gap-8px p-12px rd-8px bg-gray-50 dark:bg-gray-800 cursor-pointer"
                @click="handleFolderFileDblClick(file)"
              >
                <FileIcon :file-type="file.isDir ? 'folder' : contentTypeToFileType(file.contentType || '', false)" :extension="file.fileExtension || file.extendName" size="medium" :file-id="file.fileId" :media-cover="file.mediaCover" />
                <span class="flex-1 truncate text-14px font-medium">{{ file.fileName || file.name }}</span>
                <span v-if="!file.isDir" class="text-12px opacity-60">{{ formatFileSize(file.fileSize || file.size || 0) }}</span>
                <NButton v-if="!file.isDir" size="tiny" quaternary @click.stop="handleFolderFileDownload(file)">{{ $t('page.disk.sharedWithMe.permDownload') }}</NButton>
              </div>
            </div>
          </NSpin>
        </div>

        <!-- Pagination -->
        <div v-if="!isBrowsingFolder && total > pagination.pageSize" class="flex justify-end px-4px py-12px">
          <NPagination :page="pagination.pageNum" :page-count="Math.ceil(total / pagination.pageSize)" :page-size="pagination.pageSize" simple @update:page="handlePageChange" />
        </div>
        <div v-if="isBrowsingFolder && folderTotal > folderPagination.pageSize" class="flex justify-end px-4px py-12px">
          <NPagination :page="folderPagination.pageNum" :page-count="Math.ceil(folderTotal / folderPagination.pageSize)" :page-size="folderPagination.pageSize" simple @update:page="handlePageChange" />
        </div>
      </div>
    </NCard>

    <!-- Context menu -->
    <NDropdown
      :show="ctxMenuVisible"
      placement="bottom-start"
      trigger="manual"
      :x="ctxMenuX"
      :y="ctxMenuY"
      :options="isBrowsingFolder ? getFolderCtxMenu(browsingFolder?.permissions || []) : (ctxMenuFile ? getShareCtxMenu(ctxMenuFile) : [])"
      :menu-props="() => ({ class: 'disk-ctx-glass' })"
      @clickoutside="ctxMenuVisible = false"
      @select="handleCtxMenuSelect"
    />

    <MoveCopyDialog @success="getData" />
    <ShareDialog :existing-share="existingShareInfo" @success="getData" />
    <SaveToDriveDialog
      v-model:visible="saveToDriveVisible"
      :items="pendingSaveItems"
      @confirm="handleSaveToDriveConfirm"
    />
    <ImagePreview ref="imagePreviewRef" />
    <FilePreviewOverlays
      :video-preview-file="preview.videoPreviewFile"
      :video-preview-visible="preview.videoPreviewVisible"
      :video-stream-token="preview.videoStreamToken"
      :video-stream-base-url="preview.videoStreamBaseUrl"
      :audio-preview-file="preview.audioPreviewFile"
      :audio-preview-visible="preview.audioPreviewVisible"
      :audio-playlist="preview.audioPlaylist"
      :current-audio-index="preview.currentAudioIndex"
      :is-audio-compact="preview.isAudioCompact"
      :preview-visible="preview.previewVisible"
      :preview-file="preview.previewFile"
      @close-video="preview.closeVideoPreview"
      @video-token-update="preview.handleVideoTokenUpdate"
      @close-audio="preview.closeAudioPreview"
      @audio-overlay-click="preview.handleAudioOverlayClick"
      @update:is-audio-compact="preview.isAudioCompact = $event"
      @update:preview-visible="preview.previewVisible = $event"
    />
    <ArchiveActionDialog
      v-model:visible="preview.showArchiveAction"
      :file-name="preview.archiveFile?.fileName || preview.archiveFile?.name || ''"
      @preview="preview.showArchivePreview = true; preview.showArchiveAction = false"
      @extract-here="preview.showArchiveAction = false"
      @extract-to="preview.showArchiveAction = false"
    />
    <ArchivePreview
      v-model:visible="preview.showArchivePreview"
      :file-id="preview.archiveFile?.fileId || ''"
      :file-name="preview.archiveFile?.fileName || preview.archiveFile?.name || ''"
    />
    <!-- Create folder dialog -->
    <NModal v-model:show="createFolderDialogVisible" preset="dialog" :title="$t('page.disk.sharedWithMe.newFolder')">
      <NInput v-model:value="newFolderName" :placeholder="$t('page.disk.sharedWithMe.folderNamePlaceholder')" clearable />
      <template #action>
        <NButton @click="createFolderDialogVisible = false">{{ $t('common.cancel') }}</NButton>
        <NButton type="primary" @click="handleCreateFolderConfirm">{{ $t('common.confirm') }}</NButton>
      </template>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
:deep(.n-card__content) {
  padding: 0 !important;
  height: 100%;
  display: flex;
  flex-direction: column;
}

</style>
