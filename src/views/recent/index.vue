<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import { useLoading } from '@sa/hooks';
import { $t } from '@/locales';
import { useDiskStore } from '@/store/modules/disk';
import { fetchGetRecentList, fetchDeleteRecent, fetchClearRecent, fetchAddRecent, fetchRenameFile, fetchAddFavorite, fetchRemoveFavorite } from '@/service/api/disk';
import { fetchIsAllowDownload } from '@/service/api/disk/file';
import { fetchGetShareInfo } from '@/service/api/disk/share';
import { getServiceBaseURL } from '@/utils/service';
import { useFilePreview } from '@/hooks/business/disk/use-file-preview';
import ImagePreview from '@/components/preview/image-preview.vue';
import FilePreviewOverlays from '@/components/disk/file-preview-overlays.vue';
import SimpleToolbar from '../disk/modules/simple-toolbar.vue';
import FileGrid from '../disk/modules/file-grid.vue';
import FileList from '../disk/modules/file-list.vue';
import FileEmpty from '@/components/disk/file-empty.vue';
import MoveCopyDialog from '../disk/modules/move-copy-dialog.vue';
import ShareDialog from '../disk/modules/share-dialog.vue';
import ShareResultDialog from '../disk/modules/share-result-dialog.vue';
import FileDetailModal from '../disk/modules/file-detail-modal.vue';

defineOptions({
  name: 'RecentPage'
});

const diskStore = useDiskStore();
const { loading, startLoading, endLoading } = useLoading();

const searchParams = ref<Api.Disk.RecentListParams>({
  pageNum: 1,
  pageSize: 100,
  sortField: null,
  sortOrder: null
});

const recentList = ref<Api.Disk.RecentItem[]>([]);
const selectedFiles = ref<CommonType.IdType[]>([]);
const imagePreviewRef = ref<InstanceType<typeof ImagePreview>>();

// 重命名状态
const renamingFile = ref<Api.Disk.FileItem | null>(null);

// 分享状态
const existingShareInfo = ref<Api.Disk.ShareResult | null>(null);
const shareResult = ref<Api.Disk.ShareResult | null>(null);
const shareResultVisible = ref(false);

// 文件详情
const detailVisible = ref(false);
const detailFile = ref<Api.Disk.FileItem | null>(null);

function convertToFileItem(item: Api.Disk.RecentItem): Api.Disk.FileItem {
  return {
    fileId: item.fileId,
    recordId: item.recordId,
    fileName: item.fileName,
    fileType: item.fileType,
    fileExtension: item.fileExtension,
    fileSize: item.fileSize,
    filePath: item.filePath,
    parentId: null,
    isFolder: item.isFolder,
    isFavorite: item.isFavorite,
    isShare: item.isShare,
    modifyTime: item.visitTime,
    createTime: item.visitTime,
    updateTime: item.visitTime,
    createBy: '',
    updateBy: '',
    mediaCover: item.hasMediaCover
  };
}

const fileList = computed(() => recentList.value.map(convertToFileItem));

const preview = reactive(useFilePreview({ fileList, imagePreviewRef }));

const selectedCount = computed(() => selectedFiles.value.length);
const showEmpty = computed(() => recentList.value.length === 0 && !loading.value);

async function getData() {
  startLoading();
  const { data, error } = await fetchGetRecentList(searchParams.value);
  endLoading();

  if (!error && data) {
    recentList.value = data.rows || [];
  } else {
    recentList.value = [];
  }
}

function handleSort(field: string, order: 'asc' | 'desc') {
  searchParams.value.sortField = field as 'visitTime' | 'fileName' | 'size';
  searchParams.value.sortOrder = order;
  getData();
}

function toggleView() {
  diskStore.setViewMode(diskStore.viewMode === 'grid' ? 'list' : 'grid');
}

function handleClearSelection() {
  selectedFiles.value = [];
}

function handleSelectionChange(files: CommonType.IdType[]) {
  selectedFiles.value = files;
}

// --- 下载 ---
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

async function handleDownload(file: Api.Disk.FileItem) {
  const { data, error } = await fetchIsAllowDownload([file.fileId]);
  if (error || !data?.allowDownload) {
    window.$message?.error('下载失败，请稍后重试');
    return;
  }
  triggerBrowserDownload(data.downloadUrl);
}

// --- 分享 ---
async function handleShareFile(file: Api.Disk.FileItem) {
  existingShareInfo.value = null;
  const { data } = await fetchGetShareInfo(file.fileId);
  if (data) {
    existingShareInfo.value = data;
  }
  diskStore.openShareDialog(file);
}

function handleShareSuccess(result: Api.Disk.ShareResult) {
  shareResult.value = result;
  shareResultVisible.value = true;
  getData();
}

// --- 收藏 ---
async function handleAddFavorite(file: Api.Disk.FileItem) {
  const fileId = Number(file.fileId);
  diskStore.addFavoriteIds([fileId]);

  const { error } = await fetchAddFavorite([fileId]);
  if (error) {
    diskStore.removeFavoriteIds([fileId]);
    window.$message?.error('收藏失败');
    return;
  }
  window.$message?.success(`已收藏 "${file.fileName}"`);
  getData();
}

async function handleRemoveFavorite(file: Api.Disk.FileItem) {
  const fileId = Number(file.fileId);
  diskStore.removeFavoriteIds([fileId]);

  const { error } = await fetchRemoveFavorite([fileId]);
  if (error) {
    diskStore.addFavoriteIds([fileId]);
    window.$message?.error('取消收藏失败');
    return;
  }
  window.$message?.success(`已取消收藏 "${file.fileName}"`);
  getData();
}

// --- 重命名 ---
async function handleRenameConfirm(newName: string) {
  if (!renamingFile.value || !newName.trim()) return;
  if (newName.trim() === renamingFile.value.fileName) {
    diskStore.cancelRenaming();
    renamingFile.value = null;
    return;
  }
  const { error } = await fetchRenameFile(renamingFile.value.fileId, newName.trim());
  if (!error) {
    window.$message?.success('重命名成功');
    diskStore.cancelRenaming();
    renamingFile.value = null;
    getData();
  }
}

// --- 删除访问记录（工具栏批量） ---
async function handleClearRecent() {
  const selectedIds = selectedFiles.value;
  if (selectedIds.length === 0) return;

  window.$dialog?.warning({
    title: $t('page.disk.recent.remove'),
    content: `确定要删除 ${selectedIds.length} 条访问记录吗？`,
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      startLoading();
      const { error } = await fetchDeleteRecent(selectedIds);
      endLoading();

      if (!error) {
        recentList.value = recentList.value.filter(item => !selectedIds.includes(item.recordId));
        selectedFiles.value = [];
        window.$message?.success('已删除访问记录');
      } else {
        window.$message?.error('删除失败');
      }
    }
  });
}

// --- 删除单个访问记录（右键菜单） ---
async function handleDeleteRecentRecord(file: Api.Disk.FileItem) {
  const recordId = file.recordId!;
  const { error } = await fetchDeleteRecent([recordId]);
  if (!error) {
    recentList.value = recentList.value.filter(item => item.recordId !== recordId);
    selectedFiles.value = selectedFiles.value.filter(id => id !== recordId);
    window.$message?.success('已移除访问记录');
  }
}

// --- 清空全部 ---
function handleClearAll() {
  window.$dialog?.warning({
    title: $t('page.disk.recent.clearAll'),
    content: '确定要清空全部访问记录吗？',
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      startLoading();
      const { error } = await fetchClearRecent();
      endLoading();

      if (!error) {
        recentList.value = [];
        selectedFiles.value = [];
        window.$message?.success('已清空全部访问记录');
      } else {
        window.$message?.error('清空失败');
      }
    }
  });
}

function handleFileDblClick(file: Api.Disk.FileItem) {
  if (file.isFolder) {
    window.$message?.info('暂不支持预览文件夹');
    return;
  }
  fetchAddRecent(file.fileId);
  preview.previewByCategory(file);
}

// --- 文件操作分发 ---
function handleFileAction(action: string, file: Api.Disk.FileItem) {
  switch (action) {
    case 'download':
      handleDownload(file);
      break;
    case 'share':
      handleShareFile(file);
      break;
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
      handleDeleteRecentRecord(file);
      break;
    case 'detail':
      detailFile.value = file;
      detailVisible.value = true;
      break;
  }
}

// --- 工具栏下载 ---
function handleToolbarDownload() {
  if (selectedFiles.value.length === 0) {
    window.$message?.warning('请先选择文件');
    return;
  }
  const selectId = selectedFiles.value[0];
  const file = fileList.value.find(f => (f.recordId ?? f.fileId) === selectId);
  if (file) {
    handleDownload(file);
  }
}

getData();
</script>

<template>
  <div class="min-h-500px h-full flex-col-stretch gap-0 overflow-hidden lt-lg:overflow-auto">
    <NCard :bordered="false" size="small" class="card-wrapper h-full flex-1-hidden" :content-style="{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }">
      <div class="h-full flex flex-col">
        <SimpleToolbar
          page-type="recent"
          :selected-count="selectedCount"
          @sort="handleSort"
          @toggle-view="toggleView"
          @refresh="getData"
          @clear-selection="handleClearSelection"
          @clear-recent="handleClearRecent"
          @clear-all="handleClearAll"
          @download="handleToolbarDownload"
        />

        <div class="flex-1 overflow-hidden">
          <FileEmpty v-if="showEmpty" :description="$t('page.disk.recent.empty')" />

          <FileGrid
            v-if="!showEmpty && diskStore.viewMode === 'grid'"
            :files="fileList"
            :loading="loading"
            :selected-files="selectedFiles"
            page-type="recent"
            disable-create
            @file-dbl-click="handleFileDblClick"
            @file-download="handleFileAction('download', $event)"
            @file-share="handleFileAction('share', $event)"
            @file-delete="handleFileAction('delete', $event)"
            @file-rename="handleFileAction('rename', $event)"
            @file-rename-confirm="handleRenameConfirm"
            @file-rename-cancel="() => { diskStore.cancelRenaming(); renamingFile = null; }"
            @file-copy="handleFileAction('copy', $event)"
            @file-move="handleFileAction('move', $event)"
            @file-detail="handleFileAction('detail', $event)"
            @file-add-favorite="handleAddFavorite"
            @file-remove-favorite="handleRemoveFavorite"
            @selection-change="handleSelectionChange"
            @refresh="getData"
          />

          <FileList
            v-if="!showEmpty && diskStore.viewMode === 'list'"
            :files="fileList"
            :loading="loading"
            :selected-files="selectedFiles"
            page-type="recent"
            disable-create
            @file-dbl-click="handleFileDblClick"
            @file-download="handleFileAction('download', $event)"
            @file-share="handleFileAction('share', $event)"
            @file-delete="handleFileAction('delete', $event)"
            @file-rename="handleFileAction('rename', $event)"
            @file-rename-confirm="handleRenameConfirm"
            @file-rename-cancel="() => { diskStore.cancelRenaming(); renamingFile = null; }"
            @file-copy="handleFileAction('copy', $event)"
            @file-move="handleFileAction('move', $event)"
            @file-detail="handleFileAction('detail', $event)"
            @file-add-favorite="handleAddFavorite"
            @file-remove-favorite="handleRemoveFavorite"
            @selection-change="handleSelectionChange"
            @refresh="getData"
          />
        </div>
      </div>
    </NCard>

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
    <MoveCopyDialog @success="getData" />
    <ShareDialog :existing-share="existingShareInfo" @success="handleShareSuccess" />
    <ShareResultDialog v-model:visible="shareResultVisible" :result="shareResult" />
    <FileDetailModal v-model:visible="detailVisible" :file="detailFile" />
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
