<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useLoading } from '@sa/hooks';
import { $t } from '@/locales';
import { useDiskStore } from '@/store/modules/disk';
import { fetchGetFavoriteList, fetchRemoveFavorite } from '@/service/api/disk/favorite';
import { mapBackendFileList, fetchRenameFile } from '@/service/api/disk/file';
import { fetchIsAllowDownload } from '@/service/api/disk/file';
import { fetchGetShareInfo } from '@/service/api/disk/share';
import { getServiceBaseURL } from '@/utils/service';
import SimpleToolbar from '../disk/modules/simple-toolbar.vue';
import FileGrid from '../disk/modules/file-grid.vue';
import FileList from '../disk/modules/file-list.vue';
import FileEmpty from '@/components/disk/file-empty.vue';
import MoveCopyDialog from '../disk/modules/move-copy-dialog.vue';
import ShareDialog from '../disk/modules/share-dialog.vue';
import ShareResultDialog from '../disk/modules/share-result-dialog.vue';
import FileDetailModal from '../disk/modules/file-detail-modal.vue';

defineOptions({
  name: 'FavoritePage'
});

const router = useRouter();
const diskStore = useDiskStore();
const { loading, startLoading, endLoading } = useLoading();

const searchParams = ref<Api.Disk.FavoriteListParams>({
  pageNum: 1,
  pageSize: 50,
  sortField: null,
  sortOrder: null
});

const favoriteList = ref<Api.Disk.FileItem[]>([]);
const selectedFiles = ref<CommonType.IdType[]>([]);

// 重命名状态
const renamingFile = ref<Api.Disk.FileItem | null>(null);

// 分享状态
const existingShareInfo = ref<Api.Disk.ShareResult | null>(null);
const shareResult = ref<Api.Disk.ShareResult | null>(null);
const shareResultVisible = ref(false);

// 文件详情
const detailVisible = ref(false);
const detailFile = ref<Api.Disk.FileItem | null>(null);

const selectedCount = computed(() => selectedFiles.value.length);
const showEmpty = computed(() => favoriteList.value.length === 0 && !loading.value);

async function getData() {
  startLoading();
  const { data, error } = await fetchGetFavoriteList(searchParams.value);
  endLoading();

  if (!error && data) {
    const mapped = mapBackendFileList({ list: data.list, total: data.total });
    favoriteList.value = mapped.rows;
  } else {
    favoriteList.value = [];
  }
}

function handleSort(field: string, order: 'asc' | 'desc') {
  searchParams.value.sortField = field as 'name' | 'size' | 'modifyTime' | 'type';
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

// --- 取消收藏（工具栏批量） ---
function handleRemoveFavorite() {
  const selectedIds = selectedFiles.value;
  if (selectedIds.length === 0) return;

  const contentText = selectedIds.length === 1
    ? $t('page.disk.favorite.removeConfirmSingle')
    : $t('page.disk.favorite.removeConfirmMultiple', { count: selectedIds.length });

  window.$dialog?.warning({
    title: $t('page.disk.favorite.remove'),
    content: contentText,
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      startLoading();
      const { error } = await fetchRemoveFavorite(selectedIds.map(id => Number(id)));
      endLoading();

      if (!error) {
        favoriteList.value = favoriteList.value.filter(item => !selectedIds.includes(item.fileId));
        selectedFiles.value = [];
        diskStore.removeFavoriteIds(selectedIds.map(id => Number(id)));
        window.$message?.success($t('page.disk.favorite.removeSuccess'));
      } else {
        window.$message?.error($t('page.disk.favorite.removeFailed'));
      }
    }
  });
}

// --- 取消收藏单个（右键菜单） ---
async function handleRemoveFavoriteFile(file: Api.Disk.FileItem) {
  const fileId = Number(file.fileId);
  diskStore.removeFavoriteIds([fileId]);

  const { error } = await fetchRemoveFavorite([fileId]);
  if (error) {
    diskStore.addFavoriteIds([fileId]);
    window.$message?.error('取消收藏失败');
    return;
  }
  favoriteList.value = favoriteList.value.filter(item => item.fileId !== file.fileId);
  selectedFiles.value = selectedFiles.value.filter(id => id !== file.fileId);
  window.$message?.success(`已取消收藏 "${file.fileName}"`);
}

// --- 工具栏下载 ---
function handleToolbarDownload() {
  if (selectedFiles.value.length === 0) {
    window.$message?.warning('请先选择文件');
    return;
  }
  const selectId = selectedFiles.value[0];
  const file = favoriteList.value.find(f => f.fileId === selectId);
  if (file) {
    handleDownload(file);
  }
}

function handleFileDblClick(file: Api.Disk.FileItem) {
  const path = file.filePath;
  if (path && path !== '/') {
    router.push({ name: 'disk', query: { path } });
  } else {
    router.push({ name: 'disk' });
  }
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
      handleRemoveFavoriteFile(file);
      break;
    case 'detail':
      detailFile.value = file;
      detailVisible.value = true;
      break;
  }
}

getData();
</script>

<template>
  <div class="min-h-500px h-full flex-col-stretch gap-0 overflow-hidden lt-lg:overflow-auto">
    <NCard :bordered="false" size="small" class="card-wrapper h-full flex-1-hidden" :content-style="{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }">
      <div class="h-full flex flex-col">
        <SimpleToolbar
          page-type="favorite"
          :selected-count="selectedCount"
          @sort="handleSort"
          @toggle-view="toggleView"
          @refresh="getData"
          @clear-selection="handleClearSelection"
          @remove-favorite="handleRemoveFavorite"
          @download="handleToolbarDownload"
        />

        <div class="flex-1 overflow-hidden lt-sm:flex-initial lt-sm:overflow-auto">
          <FileEmpty v-if="showEmpty" :description="$t('page.disk.favorite.empty')" />

          <FileGrid
            v-if="!showEmpty && diskStore.viewMode === 'grid'"
            :files="favoriteList"
            :loading="loading"
            :selected-files="selectedFiles"
            page-type="favorite"
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
            @file-remove-favorite="handleRemoveFavoriteFile"
            @selection-change="handleSelectionChange"
            @refresh="getData"
          />

          <FileList
            v-if="!showEmpty && diskStore.viewMode === 'list'"
            :files="favoriteList"
            :loading="loading"
            :selected-files="selectedFiles"
            page-type="favorite"
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
            @file-remove-favorite="handleRemoveFavoriteFile"
            @selection-change="handleSelectionChange"
            @refresh="getData"
          />
        </div>
      </div>
    </NCard>

    <MoveCopyDialog @success="getData" />
    <ShareDialog :existing-share="existingShareInfo" @success="handleShareSuccess" />
    <ShareResultDialog v-model:visible="shareResultVisible" :result="shareResult" />
    <FileDetailModal v-model:visible="detailVisible" :file="detailFile" />
  </div>
</template>
