import { computed, ref, watch } from 'vue';
import { useDebounceFn, useBreakpoints } from '@vueuse/core';
import { defineStore } from 'pinia';
import { SetupStoreId } from '@/enum';
import { localStg } from '@/utils/storage';
import { router } from '@/router';
import { fetchResolvePath } from '@/service/api/disk/file';

const STORAGE_KEY = 'diskTransferList' as const;

/** 持久化的传输项（仅非敏感聚合字段，不含 fileName/folderName/error） */
interface PersistedTransferItem {
  transferId: string;
  status: Api.Disk.TransferItem['status'];
  progress: number;
  totalSize: number;
  transferredSize: number;
  transferType: 'upload' | 'download';
}

function restoreTransferList(): Api.Disk.TransferItem[] {
  const saved = localStg.get(STORAGE_KEY);
  if (!saved || !Array.isArray(saved)) return [];

  // Page refresh discards all in-progress transfers.
  // Only completed items survive. When the user re-drags the same file,
  // the backend's CheckFileBeforeUpload detects existing chunks and resumes.
  // 持久化时已过滤敏感字段，恢复时补全默认值以满足 TransferItem 类型契约
  return saved
    .filter(item => item && item.status === 'completed')
    .map(item => ({
      transferId: item.transferId,
      fileName: '历史记录', // 敏感字段未持久化，用占位符避免渲染空
      fileType: '',
      transferType: item.transferType ?? 'upload',
      status: 'completed',
      progress: 100,
      transferredSize: item.totalSize,
      totalSize: item.totalSize,
      speed: 0,
      remainingTime: 0
    }));
}

function persistTransferList(list: Api.Disk.TransferItem[]) {
  // 仅持久化非敏感聚合字段，过滤掉 fileName/folderName/error 等可能含敏感信息的元数据
  const safe: PersistedTransferItem[] = list.map(item => ({
    transferId: item.transferId,
    status: item.status,
    progress: item.progress,
    totalSize: item.totalSize,
    transferredSize: item.transferredSize,
    transferType: item.transferType
  }));
  localStg.set(STORAGE_KEY, safe as unknown as Api.Disk.TransferItem[]);
}

export const useDiskStore = defineStore(SetupStoreId.Disk, () => {
  // 当前选中的文件类型
  const currentFileType = ref<Api.Disk.FileType>('all');

  // 当前路径（面包屑）
  const currentPath = ref<Api.Disk.FileItem[]>([]);

  // 当前父文件夹ID
  const currentParentId = ref<CommonType.IdType | null>(null);

  // 视图模式
  const viewMode = ref<'grid' | 'list'>('grid');

  // 移动端强制列表模式
  const breakpoints = useBreakpoints({ sm: 640 });
  const isMobile = breakpoints.smaller('sm');
  watch(isMobile, mobile => {
    if (mobile) viewMode.value = 'list';
  }, { immediate: true });

  // 排序设置
  const sortSettings = ref<{
    field: 'name' | 'size' | 'modifyTime' | 'type' | null;
    order: 'asc' | 'desc';
  }>({
    field: null,
    order: 'asc'
  });

  // 传输列表（从 localStorage 恢复）
  const transferList = ref<Api.Disk.TransferItem[]>(restoreTransferList());

  // 当前目录文件列表（由 DiskPage 同步）
  const currentFileList = ref<Api.Disk.FileItem[]>([]);

  // 选中的文件
  const selectedFiles = ref<CommonType.IdType[]>([]);

  // 内联创建状态
  const creatingType = ref<'file' | 'folder' | null>(null);

  // 内联重命名状态
  const renamingFileId = ref<CommonType.IdType | null>(null);
  const renamingName = ref('');

  // 移动/复制弹窗状态
  const moveCopyDialogVisible = ref(false);
  const moveCopyMode = ref<'copy' | 'move'>('copy');
  const moveCopyFiles = ref<Api.Disk.FileItem[]>([]);

  // 分享弹窗状态
  const shareDialogVisible = ref(false);
  const shareFile = ref<Api.Disk.FileItem | null>(null);

  // 文件预览状态
  const textPreviewVisible = ref(false);
  const textPreviewRow = ref<Api.Disk.FileItem | null>(null);

  // 音频预览状态
  const audioPreviewVisible = ref(false);
  const audioPreviewRow = ref<Api.Disk.FileItem | null>(null);

  // 视频预览状态
  const videoPreviewVisible = ref(false);
  const videoPreviewRow = ref<Api.Disk.FileItem | null>(null);

  // 收藏文件ID缓存（用于跨页面状态同步）
  const favoriteIds = ref<Set<number>>(new Set());

  // 配额信息（跨页面共享）
  const quotaInfo = ref<Api.Disk.QuotaInfo>({
    usedSpace: 0,
    quota: 0,
    unlimited: false,
    quotaSource: 'none'
  });

  // 计算属性：面包屑路径显示
  const breadcrumbPath = computed(() => {
    return currentPath.value.map(item => item.fileName);
  });

  // 计算属性：是否有上传任务
  const hasUploadTask = computed(() => {
    return transferList.value.some(
      item => item.transferType === 'upload' && item.status !== 'completed'
    );
  });
  // 切换文件类型
  function setFileType(type: Api.Disk.FileType) {
    currentFileType.value = type;
    currentParentId.value = null;
    currentPath.value = [];
    selectedFiles.value = [];
    syncStoreToUrl();
  }

  // 进入文件夹
  function enterFolder(folder: Api.Disk.FileItem) {
    currentParentId.value = folder.fileId;
    currentPath.value.push(folder);
    selectedFiles.value = [];
    syncStoreToUrl();
  }

  // 返回上一级
  function goBack(index?: number) {
    if (index !== undefined) {
      currentPath.value = currentPath.value.slice(0, index + 1);
      currentParentId.value = currentPath.value.length > 0
        ? currentPath.value[currentPath.value.length - 1].fileId
        : null;
    } else {
      currentPath.value.pop();
      currentParentId.value = currentPath.value.length > 0
        ? currentPath.value[currentPath.value.length - 1].fileId
        : null;
    }
    selectedFiles.value = [];
    syncStoreToUrl();
  }

  // 重置路径到根目录
  function resetPath() {
    currentPath.value = [];
    currentParentId.value = null;
    selectedFiles.value = [];
    syncStoreToUrl();
  }

  // 计算当前路径字符串
  function getCurrentPathString(): string {
    if (currentPath.value.length === 0) return '/';
    return '/' + currentPath.value.map(f => f.fileName).join('/');
  }

  // 同步Store状态到URL（使用query参数，避免路由组件重建）
  function syncStoreToUrl() {
    const pathStr = getCurrentPathString();

    if (pathStr !== '/') {
      router.push({ name: 'disk', query: { path: pathStr } });
    } else {
      router.push({ name: 'disk' });
    }
  }

  // 从URL恢复路径状态（接收已解码的路径）
  async function restoreFromPath(decodedPath: string): Promise<boolean> {
    if (!decodedPath || decodedPath === '/') {
      currentParentId.value = null;
      currentPath.value = [];
      return true;
    }

    try {
      const { data } = await fetchResolvePath(decodedPath);
      if (data) {
        currentParentId.value = data.fileId;
        // 从面包屑构建currentPath（排除根目录项：fileId为null或0）
        currentPath.value = data.breadcrumb
          .filter(b => b.fileId !== null && b.fileId !== 0)
          .map(b => ({
            fileId: b.fileId!,
            fileName: b.fileName,
            filePath: b.filePath,
            fileType: 'folder',
            fileSize: 0,
            isFolder: true,
            createTime: '',
            updateTime: '',
            modifyTime: '',
            createBy: '',
            updateBy: '',
            parentId: null
          }));
        return true;
      }
    } catch {
      // 路径解析失败，返回false
    }
    return false;
  }

  // 切换视图模式
  function setViewMode(mode: 'grid' | 'list') {
    viewMode.value = mode;
  }

  // 设置排序
  function setSort(field: 'name' | 'size' | 'modifyTime' | 'type' | null, order: 'asc' | 'desc') {
    sortSettings.value = { field, order };
  }

  // 添加传输项
  function addTransferItem(item: Api.Disk.TransferItem) {
    transferList.value.push(item);
  }

  // 更新传输项
  function updateTransferItem(transferId: string, updates: Partial<Api.Disk.TransferItem>) {
    const index = transferList.value.findIndex(item => item.transferId === transferId);
    if (index !== -1) {
      transferList.value[index] = { ...transferList.value[index], ...updates };
    }
  }

  // 移除传输项
  function removeTransferItem(transferId: string) {
    transferList.value = transferList.value.filter(item => item.transferId !== transferId);
  }

  // 清空已完成的传输项
  function clearCompletedTransfers() {
    transferList.value = transferList.value.filter(item => item.status !== 'completed');
  }

  // 设置选中文件
  function setSelectedFiles(fileIds: CommonType.IdType[]) {
    selectedFiles.value = fileIds;
  }

  // 清空选中
  function clearSelection() {
    selectedFiles.value = [];
  }

  // 开始内联创建
  function startCreating(type: 'file' | 'folder') {
    creatingType.value = type;
  }

  // 取消内联创建
  function cancelCreating() {
    creatingType.value = null;
  }

  // 开始内联重命名
  function startRenaming(fileId: CommonType.IdType, currentName: string) {
    renamingFileId.value = fileId;
    renamingName.value = currentName;
  }

  // 取消内联重命名
  function cancelRenaming() {
    renamingFileId.value = null;
    renamingName.value = '';
  }

  // 打开移动/复制弹窗
  function openMoveCopyDialog(mode: 'copy' | 'move', files: Api.Disk.FileItem[]) {
    moveCopyMode.value = mode;
    moveCopyFiles.value = [...files];
    moveCopyDialogVisible.value = true;
  }

  // 关闭移动/复制弹窗
  function closeMoveCopyDialog() {
    moveCopyDialogVisible.value = false;
    moveCopyFiles.value = [];
  }

  // 打开分享弹窗
  function openShareDialog(file: Api.Disk.FileItem) {
    shareFile.value = file;
    shareDialogVisible.value = true;
  }

  // 关闭分享弹窗
  function closeShareDialog() {
    shareDialogVisible.value = false;
    shareFile.value = null;
  }

  // 获取上传中的任务数
  const uploadingCount = computed(() =>
    transferList.value.filter(item => item.transferType === 'upload' && item.status !== 'completed').length
  );

  // 批量添加上传任务
  function addUploadTasks(items: Api.Disk.TransferItem[]) {
    transferList.value.push(...items);
  }

  // 清空所有传输项（包括已完成）
  function clearAllTransfers() {
    transferList.value = [];
  }

  // 添加收藏ID到缓存
  function addFavoriteIds(ids: number[]) {
    const newSet = new Set(favoriteIds.value);
    ids.forEach(id => newSet.add(id));
    favoriteIds.value = newSet;
  }

  // 从缓存移除收藏ID
  function removeFavoriteIds(ids: number[]) {
    const removeSet = new Set(ids);
    favoriteIds.value = new Set([...favoriteIds.value].filter(id => !removeSet.has(id)));
  }

  // 判断是否已收藏
  function isFileFavorite(fileId: number): boolean {
    return favoriteIds.value.has(fileId);
  }

  // 清空收藏缓存
  function clearFavoriteCache() {
    favoriteIds.value = new Set();
  }

  // 更新配额信息
  function updateQuotaInfo(info: Api.Disk.QuotaInfo) {
    quotaInfo.value = info;
  }

  // 重置所有状态
  function $reset() {
    currentFileType.value = 'all';
    currentPath.value = [];
    currentParentId.value = null;
    viewMode.value = 'grid';
    sortSettings.value = { field: null, order: 'asc' };
    transferList.value = [];
    selectedFiles.value = [];
  }

  // 持久化：transferList 变化时自动保存到 localStorage（防抖 500ms，避免频繁写入）
  const debouncedPersist = useDebounceFn((list: Api.Disk.TransferItem[]) => {
    persistTransferList(list);
  }, 500);
  watch(transferList, list => debouncedPersist(list), { deep: true });

  // beforeunload：有活跃传输时阻止用户误刷新/关闭页面
  function handleBeforeUnload(e: BeforeUnloadEvent) {
    const hasActive = transferList.value.some(
      item => item.status !== 'completed' && item.status !== 'failed'
    );
    if (hasActive) {
      e.preventDefault();
    }
  }
  watch(transferList, list => {
    const hasActive = list.some(
      item => item.status !== 'completed' && item.status !== 'failed'
    );
    if (hasActive) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    } else {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, { deep: true, immediate: true });

  return {
    // state
    currentFileType,
    currentPath,
    currentParentId,
    viewMode,
    sortSettings,
    transferList,
    currentFileList,
    selectedFiles,
    creatingType,
    renamingFileId,
    renamingName,
    moveCopyDialogVisible,
    moveCopyMode,
    moveCopyFiles,
    shareDialogVisible,
    shareFile,
    textPreviewVisible,
    textPreviewRow,
    audioPreviewVisible,
    audioPreviewRow,
    videoPreviewVisible,
    videoPreviewRow,
    favoriteIds,
    quotaInfo,
    // computed
    breadcrumbPath,
    hasUploadTask,
    uploadingCount,
    isFavoriteCacheReady: computed(() => favoriteIds.value.size > 0),
    // actions
    setFileType,
    enterFolder,
    goBack,
    resetPath,
    setViewMode,
    setSort,
    addTransferItem,
    updateTransferItem,
    removeTransferItem,
    clearCompletedTransfers,
    setSelectedFiles,
    clearSelection,
    startCreating,
    cancelCreating,
    startRenaming,
    cancelRenaming,
    openMoveCopyDialog,
    closeMoveCopyDialog,
    openShareDialog,
    closeShareDialog,
    addUploadTasks,
    clearAllTransfers,
    addFavoriteIds,
    removeFavoriteIds,
    isFileFavorite,
    clearFavoriteCache,
    updateQuotaInfo,
    $reset,
    // URL同步
    getCurrentPathString,
    syncStoreToUrl,
    restoreFromPath
  };
});

export default useDiskStore;