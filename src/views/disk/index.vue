<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLoading } from '@sa/hooks';
import { $t } from '@/locales';
import { useDiskStore } from '@/store/modules/disk';
import { fetchGetFileList, fetchCreateFolder, fetchCreateFile, fetchRenameFile, mapBackendFileList, fetchGetQuota, fetchAddFavorite, fetchRemoveFavorite } from '@/service/api/disk';
import { fetchIsAllowDownload, fetchIsAllowPackageDownload } from '@/service/api/disk/file';
import { fetchGetShareInfo } from '@/service/api/disk/share';
import { fetchAddRecent } from '@/service/api/disk/recent';
import { getServiceBaseURL } from '@/utils/service';
import { useFilePreview } from '@/hooks/business/disk/use-file-preview';
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
import ShareResultDialog from './modules/share-result-dialog.vue';
import FileDetailModal from './modules/file-detail-modal.vue';
import ArchiveActionDialog from '@/components/disk/archive-action-dialog.vue';
import ArchivePreview from '@/components/preview/archive-preview.vue';

defineOptions({
  name: 'DiskPage'
});

const diskStore = useDiskStore();
const route = useRoute();
const router = useRouter();
const { loading, startLoading, endLoading } = useLoading();

const fileList = ref<Api.Disk.FileItem[]>([]);
const transferPanelRef = ref<InstanceType<typeof TransferPanel>>();
const imagePreviewRef = ref<InstanceType<typeof ImagePreview>>();
const totalCount = ref(0);

// 文件预览 hook
const preview = reactive(useFilePreview({ fileList, imagePreviewRef, audioFilterMode: 'fileType' }));

// 重命名状态
const renamingFile = ref<Api.Disk.FileItem | null>(null);

// 文件详情
const detailVisible = ref(false);
const detailFile = ref<Api.Disk.FileItem | null>(null);

// 已有链接分享信息（传入 share-dialog 供展示）
const existingShareInfo = ref<Api.Disk.ShareResult | null>(null);

// 分享结果相关
const shareResult = ref<Api.Disk.ShareResult | null>(null);
const shareResultVisible = ref(false);
const lastSharedFileId = ref<CommonType.IdType | null>(null);

// 显示容量开关
const showCapacity = ref(true);

// 配额信息（从 disk store 共享）
const quotaInfo = computed(() => diskStore.quotaInfo);
const quotaLoading = ref(false);

// 测试数据 - 用于无后端时测试前端效果



const searchParams = ref<Api.Disk.FileSearchParams>({
  pageNum: 1,
  pageSize: 100,
  fileType: null,
  keyword: null,
  parentId: null,
  sortField: null,
  sortOrder: null
});

async function loadQuotaInfo() {
  quotaLoading.value = true;
  const { data, error } = await fetchGetQuota();
  if (!error && data) {
    diskStore.updateQuotaInfo(data); // 更新到 disk store
  }
  quotaLoading.value = false;
}

async function getFileList() {
  startLoading();

  searchParams.value.fileType = diskStore.currentFileType === 'all' ? null : diskStore.currentFileType;
  searchParams.value.parentId = diskStore.currentParentId;
  searchParams.value.sortField = diskStore.sortSettings.field;
  searchParams.value.sortOrder = diskStore.sortSettings.order;

  const { data, error } = await fetchGetFileList(searchParams.value);

  if (!error && data) {
    const mapped = mapBackendFileList(data);
    if (mapped.rows.length > 0) {
      fileList.value = mapped.rows;
      totalCount.value = mapped.total;
    } else {
      fileList.value = [];
      totalCount.value = 0;
    }
  }
  endLoading();
  diskStore.currentFileList = fileList.value;
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
  searchParams.value.keyword = keyword || null;
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
function handleShareSuccess(result: Api.Disk.ShareResult) {
  // 乐观更新：立即更新文件的分享状态
  const shareFileId = diskStore.shareFile?.fileId;
  if (shareFileId) {
    const fileIndex = fileList.value.findIndex(f => f.fileId === shareFileId);
    if (fileIndex !== -1) {
      fileList.value[fileIndex].isShare = true;
    }
    lastSharedFileId.value = shareFileId;
  }
  shareResult.value = result;
  shareResultVisible.value = true;
}

/** 分享取消处理 - 乐观更新文件的 isShare 状态 */
function handleShareCancelled() {
  const shareFileId = diskStore.shareFile?.fileId ?? lastSharedFileId.value;
  if (shareFileId) {
    const fileIndex = fileList.value.findIndex(f => f.fileId === shareFileId);
    if (fileIndex !== -1) {
      fileList.value[fileIndex].isShare = false;
    }
  }
  shareResult.value = null;
  lastSharedFileId.value = null;
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
    onPositiveClick: async () => {
      const { fetchDeleteFile } = await import('@/service/api/disk/file');
      const { error } = await fetchDeleteFile([file.fileId]);
      if (!error) {
        window.$message?.success($t('page.disk.trash.moveToTrashSuccess'));
        diskStore.clearSelection();
        getFileList();
      }
    },
    onNegativeClick: async () => {
      window.$dialog?.error({
        title: $t('page.disk.trash.deletePermanently'),
        content: $t('page.disk.trash.permanentDeleteWarning'),
        positiveText: $t('common.confirm'),
        negativeText: $t('common.cancel'),
        onPositiveClick: async () => {
          const { fetchDeleteFile } = await import('@/service/api/disk/file');
          const { error } = await fetchDeleteFile([file.fileId], true);
          if (!error) {
            window.$message?.success($t('page.disk.trash.deletePermanentlySuccess'));
            diskStore.clearSelection();
            getFileList();
            loadQuotaInfo(); // 刷新配额信息
          }
        }
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
    onPositiveClick: async () => {
      const { fetchDeleteFile } = await import('@/service/api/disk/file');
      const { error } = await fetchDeleteFile(selectedFileIds);
      if (!error) {
        window.$message?.success($t('page.disk.trash.moveToTrashSuccess'));
        diskStore.clearSelection();
        getFileList();
      }
    },
    onNegativeClick: async () => {
      window.$dialog?.error({
        title: $t('page.disk.trash.deletePermanently'),
        content: $t('page.disk.trash.permanentDeleteWarning'),
        positiveText: $t('common.confirm'),
        negativeText: $t('common.cancel'),
        onPositiveClick: async () => {
          const { fetchDeleteFile } = await import('@/service/api/disk/file');
          const { error } = await fetchDeleteFile(selectedFileIds, true);
          if (!error) {
            window.$message?.success($t('page.disk.trash.deletePermanentlySuccess'));
            diskStore.clearSelection();
            getFileList();
            loadQuotaInfo(); // 刷新配额信息
          }
        }
      });
    }
  });
}

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
  <TableSiderLayout sider-title="文件管理">
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
      <NCard :bordered="false" size="small" class="card-wrapper flex-1-hidden">
        <!-- Toolbar -->
        <Toolbar
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
          :files="fileList"
          :loading="loading"
          page-type="disk"
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
      </NCard>
    </div>
    <!-- Transfer Panel -->
    <TransferPanel ref="transferPanelRef" />
    <!-- Move/Copy Dialog -->
    <MoveCopyDialog @success="getFileList" />
    <!-- Share Dialog -->
    <ShareDialog :existing-share="existingShareInfo" @success="handleShareSuccess" @cancel-share="handleCancelShare" />
    <!-- Share Result Dialog -->
    <ShareResultDialog
      v-model:visible="shareResultVisible"
      :result="shareResult"
      @cancelled="handleShareCancelled"
    />
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
      @preview="preview.showArchivePreview = true; preview.showArchiveAction = false"
      @extract-here="preview.showArchiveAction = false"
      @extract-to="preview.showArchiveAction = false"
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
