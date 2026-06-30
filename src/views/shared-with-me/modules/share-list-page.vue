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
  fetchBatchSaveToDrive,
  fetchIsAllowDownload,
  fetchIsAllowPackageDownload,
  fetchRenameFile,
  fetchDeleteFile,
  fetchGetShareInfo,
  fetchAddRecent,
  fetchUploadToShareFolder,
  fetchCreateShareFolder,
  fetchGetShareById
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

// 最近搜索记录（与 disk Toolbar 一致，最多保存10条）
const RECENT_SEARCH_KEY = `shared_recent_search_${props.shareType}`;
const recentSearches = ref<string[]>([]);
const showMobileSearch = ref(false);

function loadRecentSearches() {
  const saved = localStorage.getItem(RECENT_SEARCH_KEY);
  if (saved) {
    try {
      recentSearches.value = JSON.parse(saved);
    } catch {
      recentSearches.value = [];
    }
  }
}

function saveRecentSearch(keyword: string) {
  if (!keyword.trim() || keyword.trim().length < 2) return;
  const trimmed = keyword.trim();
  const exists = recentSearches.value.includes(trimmed);
  if (exists) {
    recentSearches.value = [trimmed, ...recentSearches.value.filter(k => k !== trimmed)];
  } else {
    recentSearches.value = [trimmed, ...recentSearches.value.slice(0, 9)];
  }
  localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recentSearches.value));
}

function clearRecentSearches() {
  recentSearches.value = [];
  localStorage.removeItem(RECENT_SEARCH_KEY);
}

function handleRecentSearchClick(keyword: string) {
  searchKeyword.value = keyword;
  handleSearch();
}

function handleSearch() {
  const keyword = searchKeyword.value.trim();
  if (keyword) {
    saveRecentSearch(keyword);
  }
  getData();
}

function handleMobileSearch() {
  const keyword = searchKeyword.value.trim();
  if (keyword) {
    saveRecentSearch(keyword);
  }
  showMobileSearch.value = false;
  getData();
}

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
const pendingSaveItems = ref<Array<{ shareId: number; fileId: number; fileName: string; contentType: string; isFolder: boolean; mediaCover?: boolean }>>([]);

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

// 角色 -> 权限集合映射（viewer 仅下载；editor 可上传/编辑；owner 全权限含删除/分享）
function roleToPermissions(role: Api.Disk.ShareRole): string[] {
  switch (role) {
    case 'owner':
      return ['DOWNLOAD', 'UPLOAD', 'PUT', 'DELETE', 'SHARE'];
    case 'editor':
      return ['DOWNLOAD', 'UPLOAD', 'PUT'];
    case 'viewer':
    default:
      return ['DOWNLOAD'];
  }
}

// 检查当前浏览的共享文件夹是否有上传权限
const hasUploadPermission = computed(() => {
  if (!browsingFolder.value) return false;
  return roleToPermissions(browsingFolder.value.role).includes('UPLOAD');
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

const roleLabelMap: Record<Api.Disk.ShareRole, string> = {
  viewer: $t('page.disk.sharedWithMe.roleViewer'),
  editor: $t('page.disk.sharedWithMe.roleEditor'),
  owner: $t('page.disk.sharedWithMe.roleOwner')
};

const roleTagTypeMap: Record<Api.Disk.ShareRole, 'success' | 'warning' | 'error'> = {
  viewer: 'success',
  editor: 'warning',
  owner: 'error'
};

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

  const { data } = await fetchGetShareById(Number(shareId));
  if (!data) return;

  browsingFolder.value = data;
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
  if (!oldShareId && newShareId) return;

  if (!newShareId) {
    browsingFolder.value = null;
    folderContents.value = [];
    folderPath.value = '';
  } else {
    const shareId = newShareId as string;
    const path = (route.query.path as string) || '';
    const { data } = await fetchGetShareById(Number(shareId));
    if (data) {
      browsingFolder.value = data;
      folderPath.value = path;
      getFolderContents(path || undefined);
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
  const permissions = roleToPermissions(item.role);
  const options: DropdownOption[] = [
    { label: $t('page.disk.contextMenu.open'), key: 'open', icon: SvgIconVNode({ icon: 'mdi:open-in-new', fontSize: 18 }) }
  ];
  if (permissions.includes('DOWNLOAD')) {
    options.push({ label: $t('page.disk.contextMenu.download'), key: 'download', icon: SvgIconVNode({ icon: 'mdi:download-outline', fontSize: 18 }) });
    if (isUserShare.value) {
      options.push({ label: $t('page.disk.sharedWithMe.saveToDrive'), key: 'saveToDrive', icon: SvgIconVNode({ icon: 'mdi:content-save-outline', fontSize: 18 }) });
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
    case 'rename':
      diskStore.startRenaming(item.fileId, item.fileName);
      renamingFile.value = file;
      break;
    case 'copy': diskStore.openMoveCopyDialog('copy', [file]); break;
    case 'move': diskStore.openMoveCopyDialog('move', [file]); break;
    case 'share': handleShareFile(file); break;
  }
}

// --- File double-click ---
async function handleShareFileDblClick(item: Api.Disk.SharedWithMeItem) {
  if (item.isFolder) {
    enterSharedFolder(item);
    return;
  }

  if (isUserShare.value && !roleToPermissions(item.role).includes('DOWNLOAD')) {
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
  if (!downloadUrl.startsWith('/') || downloadUrl.includes('//')) {
    window.$message?.error('Invalid download URL');
    return;
  }
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
    fileName: item.fileName,
    contentType: item.contentType,
    isFolder: item.isFolder,
    mediaCover: item.mediaCover
  }));
  saveToDriveVisible.value = true;
}

async function handleSaveToMyDrive(item: Api.Disk.SharedWithMeItem) {
  pendingSaveItems.value = [{
    shareId: item.fileShareId,
    fileId: item.fileId,
    fileName: item.fileName,
    contentType: item.contentType,
    isFolder: item.isFolder,
    mediaCover: item.mediaCover
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
      key: 'role',
      title: $t('page.disk.sharedWithMe.role'),
      width: 100,
      render(row: Api.Disk.SharedWithMeItem) {
        return h(NTag, { size: 'small', bordered: false, type: roleTagTypeMap[row.role] }, () => roleLabelMap[row.role]);
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
  loadRecentSearches();
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
  <div class="h-full lt-sm:h-[calc(100dvh-56px)] flex flex-col overflow-hidden">
    <NCard :bordered="false" size="small" class="card-wrapper flex-1 min-h-0">
      <div class="h-full flex flex-col">
        <!-- Toolbar 搜索栏（与 disk 页面风格一致） -->
        <div v-if="showFilter && !isBrowsingFolder" class="flex items-center justify-between px-4px py-8px lt-sm:flex-wrap lt-sm:justify-start">
          <!-- 左侧：文件类型 + 搜索输入框 + 搜索按钮（按钮组一体） -->
          <div class="flex items-center gap-8px">
            <NInputGroup class="hidden sm:flex" style="width: auto">
              <!-- 文件类型筛选（在搜索框前面） -->
              <NSelect
                v-model:value="contentTypeFilter"
                :options="contentTypeOptions"
                clearable
                :placeholder="$t('page.disk.sharedWithMe.fileType')"
                style="width: 120px"
                @update:value="getData"
              />
              <NPopover
                trigger="focus"
                placement="bottom-start"
                :show-arrow="false"
                :disabled="recentSearches.length === 0"
                :style="{ width: '100%' }"
                content-style="padding: 8px 0;"
              >
                <template #trigger>
                  <NInput
                    v-model:value="searchKeyword"
                    :placeholder="$t('page.disk.sharedWithMe.searchPlaceholder')"
                    clearable
                    style="width: 180px"
                    class="lg:w-240px"
                    @keydown.enter="handleSearch"
                    @clear="getData"
                  />
                </template>
                <div class="flex flex-col gap-4px min-w-150px">
                  <div class="flex items-center justify-between px-8px mb-4px text-12px text-gray-500">
                    <span>{{ $t('page.disk.toolbar.recentSearch') }}</span>
                    <NButton text size="tiny" @click.stop="clearRecentSearches">
                      {{ $t('common.clear') }}
                    </NButton>
                  </div>
                  <div
                    v-for="item in recentSearches"
                    :key="item"
                    class="flex items-center gap-8px px-8px py-6px cursor-pointer hover:bg-primary/10 rd-4px text-13px"
                    @click="handleRecentSearchClick(item)"
                  >
                    <SvgIcon icon="mdi:clock-outline" :size="14" class="text-gray-400" />
                    <span class="flex-1 truncate">{{ item }}</span>
                  </div>
                </div>
              </NPopover>
              <NButton type="primary" @click="handleSearch">
                <template #icon>
                  <SvgIcon icon="mdi:magnify" :size="18" class="dark:text-white" />
                </template>
              </NButton>
            </NInputGroup>
            <!-- 搜索框：移动端（点击图标弹窗） -->
            <NButton class="sm:hidden" quaternary @click="showMobileSearch = true">
              <template #icon><SvgIcon icon="mdi:magnify" :size="18" /></template>
            </NButton>
          </div>

          <!-- 右侧：刷新按钮 -->
          <NButtonGroup class="hidden sm:flex">
            <NTooltip trigger="hover">
              <template #trigger>
                <NButton @click="getData">
                  <template #icon>
                    <SvgIcon icon="mdi:refresh" :size="18" />
                  </template>
                </NButton>
              </template>
              {{ $t('page.disk.toolbar.refresh') }}
            </NTooltip>
          </NButtonGroup>
          <!-- 移动端刷新按钮 -->
          <NButton class="sm:hidden" quaternary @click="getData">
            <template #icon><SvgIcon icon="mdi:refresh" :size="18" /></template>
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
                    <NTag size="small" :type="roleTagTypeMap[item.role]">{{ roleLabelMap[item.role] }}</NTag>
                  </div>
                </div>

                <div class="flex items-center text-12px opacity-60">
                  <span>{{ formatDateShort(item.createdAt) }} {{ $t('page.disk.sharedWithMe.shareTime') }}</span>
                </div>

                <div class="flex items-center justify-end gap-8px pt-4px">
                  <NButton size="tiny" quaternary @click.stop="handleDownload([convertToFileItem(item)])">{{ $t('page.disk.sharedWithMe.permDownload') }}</NButton>
                  <NButton v-if="isUserShare" size="tiny" quaternary @click.stop="handleSaveToMyDrive(item)">
                    {{ $t('page.disk.sharedWithMe.saveToDrive') }}
                  </NButton>
                  <NButton size="tiny" quaternary @click.stop="handleShareFile(convertToFileItem(item))">{{ $t('page.disk.sharedWithMe.permShare') }}</NButton>
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
      :options="isBrowsingFolder ? getFolderCtxMenu(browsingFolder ? roleToPermissions(browsingFolder.role) : []) : (ctxMenuFile ? getShareCtxMenu(ctxMenuFile) : [])"
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

    <!-- 移动端搜索弹窗（与 disk Toolbar 一致） -->
    <NModal v-model:show="showMobileSearch" preset="card" style="width: 90%; max-width: 400px" :bordered="false">
      <div class="flex flex-col gap-12px">
        <NInputGroup>
          <NInput v-model:value="searchKeyword" :placeholder="$t('page.disk.sharedWithMe.searchPlaceholder')" clearable autofocus @keydown.enter="handleMobileSearch" @clear="getData" />
          <NButton type="primary" @click="handleMobileSearch">
            <template #icon>
              <SvgIcon icon="mdi:magnify" :size="18" />
            </template>
          </NButton>
        </NInputGroup>
        <!-- 文件类型筛选 -->
        <NSelect
          v-model:value="contentTypeFilter"
          :options="contentTypeOptions"
          clearable
          :placeholder="$t('page.disk.sharedWithMe.fileType')"
          @update:value="getData"
        />
        <!-- 最近搜索 -->
        <div v-if="recentSearches.length > 0" class="flex flex-col gap-8px">
          <div class="flex items-center justify-between text-12px text-gray-500">
            <span>{{ $t('page.disk.toolbar.recentSearch') }}</span>
            <NButton text size="tiny" @click.stop="clearRecentSearches">
              {{ $t('common.clear') }}
            </NButton>
          </div>
          <div class="flex flex-wrap gap-8px">
            <NTag
              v-for="item in recentSearches"
              :key="item"
              size="small"
              round
              cursor-pointer
              @click="handleRecentSearchClick(item); showMobileSearch = false;"
            >
              <template #avatar>
                <SvgIcon icon="mdi:clock-outline" :size="12" class="text-gray-400" />
              </template>
              {{ item }}
            </NTag>
          </div>
        </div>
      </div>
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
