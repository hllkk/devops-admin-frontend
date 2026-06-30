<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLoading } from '@sa/hooks';
import { $t } from '@/locales';
import { useDiskStore } from '@/store/modules/disk';
import { useAppStore } from '@/store/modules/app';
import { fetchGetFileList, fetchCreateFolder, fetchCreateFile, fetchRenameFile, mapBackendFileList, fetchGetQuota, fetchAddFavorite, fetchRemoveFavorite } from '@/service/api/disk';
import { fetchIsAllowDownload, fetchIsAllowPackageDownload } from '@/service/api/disk/file';
import { fetchGetShareInfo } from '@/service/api/disk/share';
import { fetchAddRecent } from '@/service/api/disk/recent';
import { getServiceBaseURL } from '@/utils/service';
import { useFilePreview } from '@/hooks/business/disk/use-file-preview';
import { useFullScreenLoading } from '@/hooks/business/use-full-screen-loading';
import { useInfiniteScroll } from '@/hooks/business/use-infinite-scroll';
import ImagePreview from '@/components/preview/image-preview.vue';
import FilePreviewOverlays from '@/components/disk/file-preview-overlays.vue';
import FileTypeMenu from './modules/file-type-menu.vue';
import Toolbar from './modules/toolbar.vue';
import Breadcrumb from './modules/breadcrumb.vue';
import FileGrid from './modules/file-grid.vue';
import FileList from './modules/file-list.vue';
import TransferPanel from './modules/transfer-panel.vue';
import MoveCopyDialog from './modules/move-copy-dialog.vue';
import ShareDialog from './modules/share-dialog.vue';
import FileDetailModal from './modules/file-detail-modal.vue';
import ArchiveActionDialog from '@/components/disk/archive-action-dialog.vue';
import ArchivePreview from '@/components/preview/archive-preview.vue';
import { fetchExtractArchive } from '@/service/api/disk/archive';
import { useAsyncTask } from '@/hooks/business/use-async-task';
import ExtractToDialog from './modules/extract-to-dialog.vue';

defineOptions({
  name: 'DiskPage'
});

const diskStore = useDiskStore();
const appStore = useAppStore();
const route = useRoute();
const router = useRouter();
const { loading, startLoading, endLoading } = useLoading();

const transferPanelRef = ref<InstanceType<typeof TransferPanel>>();
const imagePreviewRef = ref<InstanceType<typeof ImagePreview>>();
const fileGridRef = ref<InstanceType<typeof FileGrid>>();
const fileListRef = ref<InstanceType<typeof FileList>>();
const totalCount = ref(0);
/** 是否处于挂载文件夹只读视图（浏览"保存到我的网盘"的源文件夹内容） */
const isMountView = ref(false);

// === 无限滚动：滚动容器动态获取 ===
/** 根据当前视图模式，获取实际的滚动容器 HTMLElement */
const scrollContainer = computed<HTMLElement | null>(() => {
  if (diskStore.viewMode === 'grid') {
    return fileGridRef.value?.scrollContainer ?? null;
  }
  if (diskStore.viewMode === 'list') {
    return fileListRef.value?.scrollContainer ?? null;
  }
  return null;
});

// === 无限滚动：挂载项缓存 + 真实文件累计缓存 ===
const PAGE_SIZE = 50;

/** 挂载项缓存（首次请求后缓存，后续不再重新加载） */
const mountCache = ref<Api.Disk.FileItem[]>([]);
const mountTotal = ref(0);

/** 真实文件累计缓存（无限滚动追加） */
const realFilesCache = ref<Api.Disk.FileItem[]>([]);
const realTotal = ref(0);
const currentRealPage = ref(1);
const hasMore = ref(true);

/** 合并后的显示列表（排序：文件夹优先 → sortBy → name ASC） */
const fileList = computed(() => mergeAndSort(mountCache.value, realFilesCache.value, diskStore.sortSettings));

// 文件预览 hook
const preview = reactive(useFilePreview({ fileList, imagePreviewRef, audioFilterMode: 'fileType' }));

// 解压状态
const extractLoading = ref(false);
const showExtractTo = ref(false);
const extractTask = useAsyncTask({ interval: 2000, maxRetries: 600 });

// 重命名状态
const renamingFile = ref<Api.Disk.FileItem | null>(null);

// 文件详情
const detailVisible = ref(false);
const detailFile = ref<Api.Disk.FileItem | null>(null);

// 已有链接分享信息（传入 share-dialog 供展示）
const existingShareInfo = ref<Api.Disk.ShareResult | null>(null);

// 显示容量开关
const showCapacity = ref(true);

// 配额信息（从 disk store 共享）
const quotaInfo = computed(() => diskStore.quotaInfo);
const quotaLoading = ref(false);

// 测试数据 - 用于无后端时测试前端效果



async function loadQuotaInfo() {
  quotaLoading.value = true;
  const { data, error } = await fetchGetQuota();
  if (!error && data) {
    diskStore.updateQuotaInfo(data); // 更新到 disk store
  }
  quotaLoading.value = false;
}

/** 合并并排序挂载项 + 真实文件（与后端 sortFileListEntries 逻辑一致） */
function mergeAndSort(mounts: Api.Disk.FileItem[], realFiles: Api.Disk.FileItem[], sortSettings: { field: string | null; order: string | null }): Api.Disk.FileItem[] {
  const merged = [...mounts, ...realFiles];
  const { field, order } = sortSettings;
  const sortOrder = order === 'desc' ? -1 : 1;

  return merged.sort((a, b) => {
    // 第一排序键：文件夹优先
    if (a.isFolder !== b.isFolder) {
      return a.isFolder ? -1 : 1; // 文件夹始终在前
    }
    // 第二排序键
    switch (field) {
      case 'name':
        return sortOrder * a.fileName.localeCompare(b.fileName);
      case 'size':
        return sortOrder * (a.fileSize - b.fileSize);
      case 'modifyTime':
        return sortOrder * (new Date(a.modifyTime || a.updateTime || '').getTime() - new Date(b.modifyTime || b.updateTime || '').getTime());
      default:
        return a.fileName.localeCompare(b.fileName); // 默认 name ASC
    }
  });
}

/** 搜索关键词缓存（传递到 getFileList / loadMoreFiles 的 keyword 参数） */
const searchKeyword = ref<string | null>(null);

/** 文件列表请求序号：连续搜索/切换目录时丢弃过期响应，防止旧请求覆盖新结果 */
let listRequestId = 0;

/** 首次加载：清空缓存，请求第一页（含挂载项） */
async function getFileList() {
  // 请求序号：丢弃过期响应（连续搜索/切换目录时，旧请求返回不再覆盖新数据）
  const reqId = ++listRequestId;
  startLoading();

  // 清空缓存
  mountCache.value = [];
  realFilesCache.value = [];
  currentRealPage.value = 1;
  hasMore.value = true;

  const fileType = diskStore.currentFileType === 'all' ? null : diskStore.currentFileType;
  const sortField = diskStore.sortSettings.field;
  const sortOrder = diskStore.sortSettings.order;

  const { data, error } = await fetchGetFileList({
    pageNum: 1,
    pageSize: PAGE_SIZE,
    fileType,
    keyword: searchKeyword.value,
    parentId: null,
    sortField,
    sortOrder,
    includeMounts: true
  });

  // 丢弃过期响应（搜索词或目录已变化）
  if (reqId !== listRequestId) {
    endLoading();
    return;
  }

  if (!error && data) {
    const mapped = mapBackendFileList(data);
    realFilesCache.value = mapped.rows;
    totalCount.value = mapped.total;

    // 缓存挂载项
    if (data.hasMountData && data.mountItems) {
      mountCache.value = data.mountItems.map(item => {
        const mappedItem = mapBackendFileList({ list: [item], total: 0 });
        return mappedItem.rows[0];
      });
      mountTotal.value = data.mountTotal || 0;
    }

    realTotal.value = mapped.total - mountTotal.value;
    isMountView.value = mapped.isMountView || false;
    hasMore.value = realFilesCache.value.length < realTotal.value;
  } else {
    realFilesCache.value = [];
    totalCount.value = 0;
    isMountView.value = false;
    hasMore.value = false;
  }

  endLoading();
}

/** 加载更多：追加下一页真实文件 */
async function loadMoreFiles() {
  if (!hasMore.value) return;

  // 记录当前列表序号，若期间 getFileList 重置了列表则丢弃本次分页响应
  const reqId = listRequestId;
  currentRealPage.value++;

  const fileType = diskStore.currentFileType === 'all' ? null : diskStore.currentFileType;
  const sortField = diskStore.sortSettings.field;
  const sortOrder = diskStore.sortSettings.order;

  const { data, error } = await fetchGetFileList({
    pageNum: currentRealPage.value,
    pageSize: PAGE_SIZE,
    fileType,
    keyword: searchKeyword.value,
    parentId: null,
    sortField,
    sortOrder,
    includeMounts: false
  });

  // 列表已被 getFileList 重置（搜索/切目录），丢弃本次分页响应
  if (reqId !== listRequestId) return;

  if (!error && data) {
    const mapped = mapBackendFileList(data);
    realFilesCache.value.push(...mapped.rows);
    hasMore.value = realFilesCache.value.length < realTotal.value;
  }
}

// 无限滚动 hook — 监听滚动容器 scroll 事件
const { loadingMore } = useInfiniteScroll({
  onLoadMore: loadMoreFiles,
  hasMore,
  scrollContainerRef: scrollContainer
});

async function runExtract(destPath: string, intoSubfolder: boolean) {
  const file = preview.archiveFile;
  if (!file) return;
  const fileId = file.fileId;
  if (fileId === undefined || fileId === null || fileId === '') return;

  extractLoading.value = true;
  window.$message?.loading($t('page.disk.extract.extracting'), { duration: 0 });

  const { data, error } = await fetchExtractArchive({ fileId, destPath, intoSubfolder });

  if (error || !data?.taskId) {
    extractLoading.value = false;
    window.$message?.destroyAll?.();
    window.$message?.error($t('page.disk.extract.failed'));
    return;
  }

  // 异步轮询进度
  extractTask.start(
    data.taskId,
    () => {
      extractLoading.value = false;
      window.$message?.destroyAll?.();
      window.$message?.success($t('page.disk.extract.success'));
      preview.showArchiveAction = false;
      preview.showArchivePreview = false;
      showExtractTo.value = false;
      getFileList();
    },
    (errMsg: string) => {
      extractLoading.value = false;
      window.$message?.destroyAll?.();
      window.$message?.error(errMsg || $t('page.disk.extract.failed'));
    }
  );
}

function handleExtractHere() {
  preview.showArchiveAction = false;
  runExtract(diskStore.getCurrentPathString(), true);
}

function handleExtractToOpen() {
  preview.showArchiveAction = false;
  showExtractTo.value = true;
}

function handleExtractToConfirm(destPath: string) {
  showExtractTo.value = false;
  runExtract(destPath, false);
}

async function handleFileCreated(name: string) {
  const { error } = await fetchCreateFile({
    fileName: name,
    folderPath: diskStore.getCurrentPathString()
  });

  if (!error) {
    window.$message?.success($t('common.addSuccess'));
  }
  diskStore.cancelCreating();
  getFileList();
}

async function handleFolderCreated(name: string) {
  const { error } = await fetchCreateFolder({
    fileName: name,
    folderPath: diskStore.getCurrentPathString()
  });

  if (!error) {
    window.$message?.success($t('common.addSuccess'));
  }
  diskStore.cancelCreating();
  getFileList();
}

function handleSearch(keyword: string) {
  searchKeyword.value = keyword || null;
  getFileList();
}

function handleRefresh() {
  getFileList();
}

function handleFileDblClick(file: Api.Disk.FileItem) {
  if (file.isFolder) return;
  fetchAddRecent(file.fileId);
  preview.previewByCategory(file);
}

/** 分享处理：查询已有链接分享信息，始终打开配置对话框 */
async function handleShareFile(file: Api.Disk.FileItem) {
  existingShareInfo.value = null;
  const { data } = await fetchGetShareInfo(file.fileId);
  if (data) {
    existingShareInfo.value = data;
  }
  diskStore.openShareDialog(file);
}

function handleFileAction(action: string, file: Api.Disk.FileItem) {
  // 挂载只读视图：禁止写操作（重命名/复制/移动/删除对源owner文件无权限）
  if (isMountView.value && (action === 'rename' || action === 'copy' || action === 'move' || action === 'delete')) {
    window.$message?.warning('挂载文件夹为只读视图，不支持此操作');
    return;
  }
  switch (action) {
    case 'rename':
      diskStore.startRenaming(file.fileId, file.fileName);
      renamingFile.value = file;
      break;
    case 'copy':
      diskStore.openMoveCopyDialog('copy', [file]);
      break;
    case 'move':
      diskStore.openMoveCopyDialog('move', [file]);
      break;
    case 'delete':
      handleDeleteFile(file);
      break;
    case 'share':
      handleShareFile(file);
      break;
    case 'download':
      handleDownload([file]);
      break;
    case 'detail':
      detailFile.value = file;
      detailVisible.value = true;
      break;
    default:
      break;
  }
}

/** 触发浏览器下载（通过隐藏 <a> 标签） */
function triggerBrowserDownload(downloadUrl: string) {
  const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
  const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);
  const fullUrl = `${baseURL}${downloadUrl}`;

  const link = document.createElement('a');
  link.href = fullUrl;
  link.style.display = 'none';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 统一下载入口 — 智能路由
 * 单文件(非文件夹) → 直接下载；多文件或含文件夹 → 打包ZIP下载
 */
async function handleDownload(files: Api.Disk.FileItem[]) {
  if (files.length === 0) {
    window.$message?.warning($t('common.selectFileFirst'));
    return;
  }

  // 智能路由：单文件且非文件夹 → 直接下载
  if (files.length === 1 && !files[0].isFolder) {
    const { data, error } = await fetchIsAllowDownload([files[0].fileId]);
    if (error || !data?.allowDownload) {
      window.$message?.error('下载失败，请稍后重试');
      return;
    }
    triggerBrowserDownload(data.downloadUrl);
    return;
  }

  // 多文件或包含文件夹 → 打包下载
  window.$loading?.startLoading('正在准备下载...');

  const fileIds = files.map(f => f.fileId);
  const { data, error } = await fetchIsAllowPackageDownload(fileIds);

  window.$loading?.endLoading();

  if (error || !data?.allowDownload) {
    window.$message?.error('下载失败，请稍后重试');
    return;
  }

  triggerBrowserDownload(data.downloadUrl);
  diskStore.clearSelection();
}

/** 工具栏下载 — 取选中的文件调用统一入口 */
function handleToolbarDownload() {
  const selectedFiles = diskStore.currentFileList.filter(f => diskStore.selectedFiles.includes(f.fileId));
  handleDownload(selectedFiles);
}

/** 工具栏分享 — 选中单个文件时触发 */
function handleToolbarShare() {
  const selectedFileIds = diskStore.selectedFiles;
  if (selectedFileIds.length !== 1) return;

  const file = diskStore.currentFileList.find(f => f.fileId === selectedFileIds[0]);
  if (!file) return;

  handleShareFile(file);
}

/** 工具栏批量分享 — 多选时触发 */
function handleToolbarBatchShare() {
  const selectedFileIds = diskStore.selectedFiles;
  if (selectedFileIds.length === 0) return;

  const selectedFiles = diskStore.currentFileList.filter(f => selectedFileIds.includes(f.fileId));
  if (selectedFiles.length === 0) return;

  // 批量分享：打开分享配置对话框，处理多个文件
  // 注意：目前分享功能不支持多文件，这里简化为只分享第一个文件
  // 后续可以扩展为创建多个分享或打包分享
  handleShareFile(selectedFiles[0]);
}

/** 分享成功处理 - 乐观更新文件的 isShare 状态 */
function handleShareSuccess(_result: Api.Disk.ShareResult) {
  // 乐观更新：立即更新文件的分享状态
  const shareFileId = diskStore.shareFile?.fileId;
  if (shareFileId) {
    const fileIndex = fileList.value.findIndex(f => f.fileId === shareFileId);
    if (fileIndex !== -1) {
      fileList.value[fileIndex].isShare = true;
    }
  }
}

/** 取消分享处理（从 share-dialog 触发） - 乐观更新 */
function handleCancelShare(fileId: CommonType.IdType) {
  const fileIndex = fileList.value.findIndex(f => f.fileId === fileId);
  if (fileIndex !== -1) {
    fileList.value[fileIndex].isShare = false;
  }
  existingShareInfo.value = null;
}

function handleToolbarRename() {
  const selectedFileIds = diskStore.selectedFiles;
  if (selectedFileIds.length !== 1) return;

  const file = diskStore.currentFileList.find(f => f.fileId === selectedFileIds[0]);
  if (!file) return;

  diskStore.startRenaming(file.fileId, file.fileName);
  renamingFile.value = file;
}

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
    getFileList();
  }
}

async function handleDeleteFile(file: Api.Disk.FileItem) {
  window.$dialog?.warning({
    title: $t('page.disk.toolbar.delete'),
    content: `${$t('page.disk.moveCopy.deleteConfirm')} "${file.fileName}"?`,
    positiveText: $t('page.disk.trash.moveToTrash'),
    negativeText: $t('page.disk.trash.deletePermanently'),
    onPositiveClick: () => doMoveToTrash([file.fileId]),
    onNegativeClick: () => {
      window.$dialog?.error({
        title: $t('page.disk.trash.deletePermanently'),
        content: $t('page.disk.trash.permanentDeleteWarning'),
        positiveText: $t('common.confirm'),
        negativeText: $t('common.cancel'),
        onPositiveClick: () => doDeletePermanently([file.fileId])
      });
    }
  });
}

// 添加收藏（乐观更新）
async function handleAddFavorite(file: Api.Disk.FileItem) {
  const fileId = Number(file.fileId);

  // 乐观更新：立即更新 Store 缓存
  diskStore.addFavoriteIds([fileId]);

  const { error } = await fetchAddFavorite([fileId]);
  if (error) {
    // 回滚：从缓存移除
    diskStore.removeFavoriteIds([fileId]);
    window.$message?.error('收藏失败');
    return;
  }

  window.$message?.success(`已收藏 "${file.fileName}"`);
  getFileList(); // 刷新列表以更新 isFavorite 状态
}

// 取消收藏（乐观更新）
async function handleRemoveFavorite(file: Api.Disk.FileItem) {
  const fileId = Number(file.fileId);

  // 乐观更新：立即从 Store 缓存移除
  diskStore.removeFavoriteIds([fileId]);

  const { error } = await fetchRemoveFavorite([fileId]);
  if (error) {
    // 回滚：重新添加到缓存
    diskStore.addFavoriteIds([fileId]);
    window.$message?.error('取消收藏失败');
    return;
  }

  window.$message?.success(`已取消收藏 "${file.fileName}"`);
  getFileList(); // 刷新列表以更新 isFavorite 状态
}

function handleFileFavorite(file: Api.Disk.FileItem) {
  // 根据当前收藏状态决定添加或移除
  if (file.isFavorite) {
    handleRemoveFavorite(file);
  } else {
    handleAddFavorite(file);
  }
}

// 批量添加收藏（工具栏）
async function handleToolbarAddFavorite() {
  const selectedFileIds = diskStore.selectedFiles;
  if (selectedFileIds.length === 0) return;

  const selectedFiles = diskStore.currentFileList.filter(f => selectedFileIds.includes(f.fileId));
  // 过滤出未收藏的文件
  const filesToAdd = selectedFiles.filter(f => !f.isFavorite);
  if (filesToAdd.length === 0) {
    window.$message?.info('选中的文件都已收藏');
    return;
  }

  const fileIds = filesToAdd.map(f => Number(f.fileId));

  // 乐观更新
  diskStore.addFavoriteIds(fileIds);

  const { error } = await fetchAddFavorite(fileIds);
  if (error) {
    diskStore.removeFavoriteIds(fileIds);
    window.$message?.error('批量收藏失败');
    return;
  }

  window.$message?.success(`已收藏 ${filesToAdd.length} 个文件`);
  diskStore.clearSelection();
  getFileList();
}

// 批量取消收藏（工具栏）
async function handleToolbarRemoveFavorite() {
  const selectedFileIds = diskStore.selectedFiles;
  if (selectedFileIds.length === 0) return;

  const selectedFiles = diskStore.currentFileList.filter(f => selectedFileIds.includes(f.fileId));
  // 过滤出已收藏的文件
  const filesToRemove = selectedFiles.filter(f => f.isFavorite);
  if (filesToRemove.length === 0) {
    window.$message?.info('选中的文件都未收藏');
    return;
  }

  const fileIds = filesToRemove.map(f => Number(f.fileId));

  // 乐观更新
  diskStore.removeFavoriteIds(fileIds);

  const { error } = await fetchRemoveFavorite(fileIds);
  if (error) {
    diskStore.addFavoriteIds(fileIds);
    window.$message?.error('批量取消收藏失败');
    return;
  }

  window.$message?.success(`已取消收藏 ${filesToRemove.length} 个文件`);
  diskStore.clearSelection();
  getFileList();
}

function handleToolbarDelete() {
  const selectedFileIds = diskStore.selectedFiles;
  if (selectedFileIds.length === 0) return;

  const selectedFiles = diskStore.currentFileList.filter(f => selectedFileIds.includes(f.fileId));
  if (selectedFiles.length === 0) return;

  const isMultiple = selectedFiles.length > 1;

  window.$dialog?.warning({
    title: $t('page.disk.toolbar.delete'),
    content: isMultiple
      ? `${$t('page.disk.moveCopy.deleteConfirm')} ${selectedFiles.length} 个文件?`
      : `${$t('page.disk.moveCopy.deleteConfirm')} "${selectedFiles[0].fileName}"?`,
    positiveText: $t('page.disk.trash.moveToTrash'),
    negativeText: $t('page.disk.trash.deletePermanently'),
    onPositiveClick: () => doMoveToTrash(selectedFileIds),
    onNegativeClick: () => {
      window.$dialog?.error({
        title: $t('page.disk.trash.deletePermanently'),
        content: $t('page.disk.trash.permanentDeleteWarning'),
        positiveText: $t('common.confirm'),
        negativeText: $t('common.cancel'),
        onPositiveClick: () => doDeletePermanently(selectedFileIds)
      });
    }
  });
}

// 全屏 Loading（删除/恢复等耗时操作期间阻断误操作）
const { show: showFullScreenLoading, hide: hideFullScreenLoading } = useFullScreenLoading();

/** 执行移至回收站（返回 Promise 供 Dialog 按钮 loading） */
async function doMoveToTrash(fileIds: CommonType.IdType[]) {
  showFullScreenLoading($t('page.disk.trash.movingToTrash', { count: fileIds.length }));
  try {
    const { fetchDeleteFile } = await import('@/service/api/disk/file');
    const { error } = await fetchDeleteFile(fileIds);
    if (!error) {
      window.$message?.success($t('page.disk.trash.moveToTrashSuccess'));
      diskStore.clearSelection();
      getFileList();
    }
  } finally {
    hideFullScreenLoading();
  }
}

/** 执行彻底删除（返回 Promise 供 Dialog 按钮 loading，支持异步轮询） */
async function doDeletePermanently(fileIds: CommonType.IdType[]) {
  showFullScreenLoading($t('page.disk.trash.deletingPermanently', { count: fileIds.length }));
  try {
    const { fetchDeleteFile, fetchTaskStatus } = await import('@/service/api/disk/file');
    const { data, error } = await fetchDeleteFile(fileIds, true);
    if (error) return;
    if (data?.taskId) {
      // 异步模式: 轮询直到完成, 期间 dialog 按钮保持 loading
      for (let i = 0; i < 300; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          const res = await fetchTaskStatus(data.taskId);
          const status = res.data?.status;
          if (status === 'completed') {
            window.$message?.success($t('page.disk.trash.deletePermanentlySuccess'));
            break;
          }
          if (status === 'failed') {
            window.$message?.error(res.data?.error || '操作失败');
            break;
          }
        } catch {
          // 网络错误继续重试
        }
      }
    } else {
      window.$message?.success($t('page.disk.trash.deletePermanentlySuccess'));
    }
    diskStore.clearSelection();
    getFileList();
    loadQuotaInfo();
  } finally {
    hideFullScreenLoading();
  }
}

// 同步 fileList computed 到 diskStore（供其他组件使用 selectedFiles 等）
watch(fileList, list => {
  diskStore.currentFileList = list;
}, { deep: false });

// 共享对话框关闭后刷新文件列表（更新 sharedUserCount/sharedDeptCount）
watch(() => diskStore.shareDialogVisible, (visible, prev) => {
  if (prev && !visible) {
    getFileList();
  }
});

// Watch file type changes
watch(() => diskStore.currentFileType, () => {
  getFileList();
});

// Watch path changes
watch(() => diskStore.currentParentId, () => {
  getFileList();
});

// Watch sort changes
watch(() => diskStore.sortSettings, () => {
  getFileList();
}, { deep: true });

// Watch upload completions to auto-refresh file list
let prevCompletedCount = 0;
watch(
  () => diskStore.transferList.filter(item => item.transferType === 'upload' && item.status === 'completed').length,
  completedCount => {
    if (completedCount > prevCompletedCount) {
      prevCompletedCount = completedCount;
      getFileList();
      loadQuotaInfo();
    }
  }
);

// Watch URL path changes (browser back/forward)
watch(() => route.query.path, async (newPath) => {
  const currentPathStr = diskStore.getCurrentPathString();
  // 解码URL路径
  const decodedNewPath = newPath
    ? decodeURIComponent(newPath as string)
    : '/';

  // 只有当URL路径与当前状态不同时才恢复
  if (decodedNewPath !== currentPathStr) {
    const success = await diskStore.restoreFromPath(decodedNewPath);
    if (!success && decodedNewPath !== '/') {
      // 路径不存在，重定向到根目录
      window.$message?.warning('路径不存在，已返回根目录');
      router.replace({ name: 'disk' });
    }
    getFileList();
  }
});

onMounted(async () => {
  // 从URL恢复路径状态
  const pathParam = route.query.path as string;
  if (pathParam) {
    // 解码URL路径
    const decodedPath = decodeURIComponent(pathParam);
    const success = await diskStore.restoreFromPath(decodedPath);
    if (!success) {
      window.$message?.warning('路径不存在，已返回根目录');
      router.replace({ name: 'disk' });
    }
  }
  getFileList();
  loadQuotaInfo();
});
</script>

<template>
  <TableSiderLayout sider-title="文件管理" :hide-sider="appStore.isMobile">
    <template #header-extra>
      <NTooltip trigger="hover">
        <template #trigger>
          <NSwitch v-model:value="showCapacity" :round="false" />
        </template>
        显示容量
      </NTooltip>
    </template>
    <template #sider>
      <NDivider dashed />
      <FileTypeMenu
        :show-capacity="showCapacity"
        :quota-info="quotaInfo"
        :quota-loading="quotaLoading"
      />
    </template>
    <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
      <NCard :bordered="false" size="small" class="card-wrapper flex-1-hidden" :content-style="{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }">
        <!-- Toolbar -->
        <Toolbar
          :is-mount-view="isMountView"
          @search="handleSearch"
          @refresh="handleRefresh"
          @share="handleToolbarShare"
          @batch-share="handleToolbarBatchShare"
          @download="handleToolbarDownload"
          @delete="handleToolbarDelete"
          @rename="handleToolbarRename"
          @add-favorite="handleToolbarAddFavorite"
          @remove-favorite="handleToolbarRemoveFavorite"
          @show-transfer="transferPanelRef?.showDefault()"
        />
        <!-- Breadcrumb -->
        <Breadcrumb
          v-if="fileList.length > 0 || diskStore.currentPath.length > 0"
          :total-count="totalCount"
        />
        <!-- File Content -->
        <FileGrid
          v-if="diskStore.viewMode === 'grid'"
          ref="fileGridRef"
          :files="fileList"
          :loading="loading"
          page-type="disk"
          class="h-full"
          @file-dbl-click="handleFileDblClick"
          @file-created="handleFileCreated"
          @folder-created="handleFolderCreated"
          @file-share="handleFileAction('share', $event)"
          @file-download="handleFileAction('download', $event)"
          @file-delete="handleFileAction('delete', $event)"
          @file-rename="handleFileAction('rename', $event)"
          @file-rename-confirm="handleRenameConfirm"
          @file-rename-cancel="() => { diskStore.cancelRenaming(); renamingFile = null; }"
          @file-copy="handleFileAction('copy', $event)"
          @file-move="handleFileAction('move', $event)"
          @file-favorite="handleFileFavorite"
          @file-add-favorite="handleAddFavorite"
          @file-remove-favorite="handleRemoveFavorite"
          @file-detail="handleFileAction('detail', $event)"
          @refresh="handleRefresh"
        />
        <FileList
          v-if="diskStore.viewMode === 'list'"
          ref="fileListRef"
          :files="fileList"
          :loading="loading"
          page-type="disk"
          class="flex-1 min-h-0"
          @file-dbl-click="handleFileDblClick"
          @file-created="handleFileCreated"
          @folder-created="handleFolderCreated"
          @file-share="handleFileAction('share', $event)"
          @file-download="handleFileAction('download', $event)"
          @file-delete="handleFileAction('delete', $event)"
          @file-rename="handleFileAction('rename', $event)"
          @file-rename-confirm="handleRenameConfirm"
          @file-rename-cancel="() => { diskStore.cancelRenaming(); renamingFile = null; }"
          @file-copy="handleFileAction('copy', $event)"
          @file-move="handleFileAction('move', $event)"
          @file-favorite="handleFileFavorite"
          @file-add-favorite="handleAddFavorite"
          @file-remove-favorite="handleRemoveFavorite"
          @file-detail="handleFileAction('detail', $event)"
          @refresh="handleRefresh"
        />
        <!-- 加载更多状态 -->
        <div v-if="loadingMore" class="flex items-center justify-center py-12px">
          <NSpin size="small" />
          <span class="ml-8px text-13px opacity-60">加载更多...</span>
        </div>
        <div v-else-if="!hasMore && fileList.length > 0" class="text-center text-13px opacity-60 py-12px">
          已加载全部 {{ fileList.length }} / {{ totalCount }} 项
        </div>
      </NCard>
    </div>
    <!-- Transfer Panel -->
    <TransferPanel ref="transferPanelRef" />
    <!-- Move/Copy Dialog -->
    <MoveCopyDialog @success="getFileList" />
    <!-- Share Dialog -->
    <ShareDialog :existing-share="existingShareInfo" @success="handleShareSuccess" @cancel-share="handleCancelShare" />
    <!-- File Detail Modal -->
    <FileDetailModal
      v-model:visible="detailVisible"
      :file="detailFile"
    />
    <!-- Image Preview -->
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
      :extract-loading="extractLoading"
      @preview="preview.showArchivePreview = true; preview.showArchiveAction = false"
      @extract-here="handleExtractHere"
      @extract-to="handleExtractToOpen"
    />
    <ExtractToDialog
      v-model:visible="showExtractTo"
      :file-name="preview.archiveFile?.fileName || preview.archiveFile?.name || ''"
      @confirm="handleExtractToConfirm"
    />
    <ArchivePreview
      v-model:visible="preview.showArchivePreview"
      :file-id="preview.archiveFile?.fileId || ''"
      :file-name="preview.archiveFile?.fileName || preview.archiveFile?.name || ''"
    />
  </TableSiderLayout>
</template>

<style scoped lang="scss">
:deep(.n-card__content) {
  padding: 0 !important;
  height: 100%;
  display: flex;
  flex-direction: column;
}
:deep(.n-divider) {
  margin: 0 !important;
}
</style>
