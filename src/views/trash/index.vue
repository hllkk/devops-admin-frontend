<script setup lang="ts">
import { ref, computed } from 'vue';
import { useLoading } from '@sa/hooks';
import { $t } from '@/locales';
import { useDiskStore } from '@/store/modules/disk';
import { fetchGetTrashList, fetchRestoreTrash, fetchDeleteTrash, fetchEmptyTrash, mapBackendTrashList, fetchTaskStatus } from '@/service/api/disk/file';
import { fetchGetQuota } from '@/service/api/disk';
import SimpleToolbar from '../disk/modules/simple-toolbar.vue';
import FileGrid from '../disk/modules/file-grid.vue';
import FileList from '../disk/modules/file-list.vue';
import FileEmpty from '@/components/disk/file-empty.vue';
import { useFullScreenLoading } from '@/hooks/business/use-full-screen-loading';

defineOptions({
  name: 'TrashPage'
});

const diskStore = useDiskStore();
const { loading, startLoading, endLoading } = useLoading();
const { show: showFullScreenLoading, hide: hideFullScreenLoading } = useFullScreenLoading();

const recycleList = ref<Api.Disk.RecycleItem[]>([]);
const selectedFiles = ref<CommonType.IdType[]>([]);
const searchParams = ref<Api.Disk.RecycleListParams>({
  pageNum: 1,
  pageSize: 100
});

const fileList = computed(() => recycleList.value.map(convertToFileItem));
const selectedCount = computed(() => selectedFiles.value.length);
const showEmpty = computed(() => recycleList.value.length === 0 && !loading.value);

function convertToFileItem(item: Api.Disk.RecycleItem): Api.Disk.FileItem {
  return {
    fileId: item.recycleId,
    fileName: item.fileName,
    fileType: item.fileType,
    fileExtension: item.fileExtension,
    fileSize: item.fileSize,
    filePath: item.originalPath,
    parentId: null,
    isFolder: item.isFolder,
    modifyTime: item.deleteTime,
    createTime: item.deleteTime,
    updateTime: item.deleteTime,
    createBy: '',
    updateBy: '',
    mediaCover: item.mediaCover
  };
}

async function getData() {
  startLoading();
  const { data, error } = await fetchGetTrashList(searchParams.value);
  if (!error && data) {
    const mapped = mapBackendTrashList(data);
    recycleList.value = mapped.rows;
  } else {
    recycleList.value = [];
  }
  endLoading();
}

// 刷新配额信息（通知 disk store 更新）
async function refreshQuota() {
  const { data } = await fetchGetQuota();
  if (data) {
    diskStore.updateQuotaInfo(data);
  }
}

function handleSort(field: string, order: 'asc' | 'desc') {
  searchParams.value.sortField = field as 'fileName' | 'deleteTime' | 'size';
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

function handleRestore() {
  const ids = selectedFiles.value;
  if (ids.length === 0) return;

  window.$dialog?.info({
    title: $t('page.disk.trash.restore'),
    content: ids.length === 1
      ? $t('page.disk.trash.restoreConfirmSingle')
      : $t('page.disk.trash.restoreConfirmMultiple', { count: ids.length }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      showFullScreenLoading($t('page.disk.trash.restoring', { count: ids.length }));
      try {
        const { error } = await fetchRestoreTrash(ids);
        if (!error) {
          window.$message?.success($t('page.disk.trash.restoreSuccess'));
          selectedFiles.value = [];
          getData();
        }
      } finally {
        hideFullScreenLoading();
      }
    }
  });
}

/** 轮询异步任务（返回 Promise，dialog 按钮保持 loading 直到完成） */
async function pollTaskStatus(taskId: string, maxRetries = 300): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      const { data } = await fetchTaskStatus(taskId);
      if (!data) continue;
      if (data.status === 'completed') return true;
      if (data.status === 'failed') {
        window.$message?.error(data.error || '操作失败');
        return false;
      }
    } catch {
      // 网络错误继续重试
    }
  }
  window.$message?.warning('操作超时，请稍后刷新查看结果');
  return false;
}

function handleDeletePermanently() {
  const ids = selectedFiles.value;
  if (ids.length === 0) return;

  window.$dialog?.error({
    title: $t('page.disk.trash.deletePermanently'),
    content: ids.length === 1
      ? $t('page.disk.trash.permanentDeleteConfirmSingle')
      : $t('page.disk.trash.permanentDeleteConfirmMultiple', { count: ids.length }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      showFullScreenLoading($t('page.disk.trash.deletingPermanently', { count: ids.length }));
      try {
        const { data, error } = await fetchDeleteTrash(ids);
        if (error) return;
        if (data?.taskId) {
          const ok = await pollTaskStatus(data.taskId);
          if (!ok) return;
        }
        window.$message?.success($t('page.disk.trash.deletePermanentlySuccess'));
        selectedFiles.value = [];
        getData();
        refreshQuota();
      } finally {
        hideFullScreenLoading();
      }
    }
  });
}

function handleEmptyTrash() {
  window.$dialog?.error({
    title: $t('page.disk.trash.empty'),
    content: $t('page.disk.trash.emptyConfirm'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      showFullScreenLoading($t('page.disk.trash.emptying'));
      try {
        const { data, error } = await fetchEmptyTrash();
        if (error) return;
        if (data?.taskId) {
          const ok = await pollTaskStatus(data.taskId);
          if (!ok) return;
        }
        window.$message?.success($t('page.disk.trash.emptySuccess'));
        selectedFiles.value = [];
        getData();
        refreshQuota();
      } finally {
        hideFullScreenLoading();
      }
    }
  });
}

// 回收站不支持双击预览
function handleFileDblClick(_file: Api.Disk.FileItem) {
  // 不做任何操作
}

function handleFileAction(action: string, file: Api.Disk.FileItem) {
  switch (action) {
    case 'restore':
      selectedFiles.value = [file.fileId];
      handleRestore();
      break;
    case 'delete':
      selectedFiles.value = [file.fileId];
      handleDeletePermanently();
      break;
  }
}

function handleDownloadTip() {
  window.$message?.warning($t('page.disk.trash.cannotDownload'));
}

getData();
</script>

<template>
  <div class="min-h-500px h-full flex-col-stretch gap-0 overflow-hidden lt-lg:overflow-auto">
    <NCard :bordered="false" size="small" class="card-wrapper h-full flex-1-hidden" :content-style="{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }">
      <div class="h-full flex flex-col">
        <SimpleToolbar
          page-type="trash"
          :selected-count="selectedCount"
          @sort="handleSort"
          @toggle-view="toggleView"
          @refresh="getData"
          @clear-selection="handleClearSelection"
          @restore="handleRestore"
          @delete-permanently="handleDeletePermanently"
          @empty-trash="handleEmptyTrash"
          @download="handleDownloadTip"
        />

        <div class="flex-1 overflow-hidden">
          <FileEmpty v-if="showEmpty" :description="$t('page.disk.trash.noData')" />

          <FileGrid
            v-if="!showEmpty && diskStore.viewMode === 'grid'"
            :files="fileList"
            :loading="loading"
            :selected-files="selectedFiles"
            page-type="trash"
            disable-create
            @file-dbl-click="handleFileDblClick"
            @file-delete="handleFileAction('delete', $event)"
            @file-restore="handleFileAction('restore', $event)"
            @selection-change="handleSelectionChange"
            @refresh="getData"
            @empty-trash="handleEmptyTrash"
          />

          <FileList
            v-if="!showEmpty && diskStore.viewMode === 'list'"
            :files="fileList"
            :loading="loading"
            :selected-files="selectedFiles"
            page-type="trash"
            disable-create
            @file-dbl-click="handleFileDblClick"
            @file-delete="handleFileAction('delete', $event)"
            @file-restore="handleFileAction('restore', $event)"
            @selection-change="handleSelectionChange"
            @refresh="getData"
            @empty-trash="handleEmptyTrash"
          />
        </div>
      </div>
    </NCard>
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
