<script setup lang="tsx">
import { ref } from 'vue';
import { NTag } from 'naive-ui';
import {
  fetchGetFileAuditList,
  fetchBatchDeleteFileAudit,
  fetchCleanFileAudit
} from '@/service/api/disk/file-audit';
import { useAppStore } from '@/store/modules/app';
import { defaultTransform, useNaivePaginatedTable, useTableOperate } from '@/hooks/common/table';
import { useAuth } from '@/hooks/business/auth';
import { useDownload } from '@/hooks/business/download';
import ButtonIcon from '@/components/custom/button-icon.vue';
import { $t } from '@/locales';
import FileAuditSearch from './modules/file-audit-search.vue';
import FileAuditDetailDrawer from './modules/file-audit-detail-drawer.vue';
import { formatDateTime } from '@/utils/format';

defineOptions({
  name: 'FileAuditLogList'
});

const { hasAuth } = useAuth();
const appStore = useAppStore();
const { download } = useDownload();

const searchParams = ref<Api.Disk.FileAuditSearchParams>({
  pageNum: 1,
  pageSize: 10
});

const operationTypeColorMap: Record<string, 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'> = {
  upload: 'success',
  download: 'info',
  preview: 'info',
  delete: 'error',
  purge: 'error',
  restore: 'success',
  rename: 'primary',
  move: 'primary',
  copy: 'primary',
  share_create: 'warning',
  share_revoke: 'error',
  favorite: 'default',
  unfavorite: 'default'
};

const { columns, columnChecks, data, getData, getDataByPage, loading, mobilePagination, scrollX } =
  useNaivePaginatedTable({
    api: () => fetchGetFileAuditList(searchParams.value),
    transform: response => defaultTransform(response),
    onPaginationParamsChange: params => {
      searchParams.value.pageNum = params.page ?? 1;
      searchParams.value.pageSize = params.pageSize ?? 10;
    },
    columns: () => [
      {
        type: 'selection',
        align: 'center',
        width: 48
      },
      {
        key: 'index',
        title: $t('common.index'),
        align: 'center',
        width: 60,
        render: (_, index) => {
          return (searchParams.value.pageNum - 1) * searchParams.value.pageSize + index + 1;
        }
      },
      {
        key: 'operationType',
        title: $t('page.system.fileLog.operationType'),
        align: 'center',
        width: 110,
        render: row => {
          return (
            <NTag type={operationTypeColorMap[row.operationType] ?? 'default'} size="small">
              {row.operationType}
            </NTag>
          );
        }
      },
      {
        key: 'fileName',
        title: $t('page.system.fileLog.fileName'),
        align: 'left',
        width: 200,
        ellipsis: { tooltip: true }
      },
      {
        key: 'operName',
        title: $t('page.system.fileLog.operName'),
        align: 'center',
        width: 110,
        ellipsis: true
      },
      {
        key: 'source',
        title: $t('page.system.fileLog.source'),
        align: 'center',
        width: 90
      },
      {
        key: 'ip',
        title: $t('page.system.fileLog.operIp'),
        align: 'center',
        width: 130
      },
      {
        key: 'status',
        title: $t('page.system.fileLog.status'),
        align: 'center',
        width: 80,
        render: row => {
          return (
            <NTag type={row.status === 'success' ? 'success' : row.status === 'failed' ? 'error' : 'warning'} size="small">
              {row.status}
            </NTag>
          );
        }
      },
      {
        key: 'duration',
        title: $t('page.system.fileLog.duration'),
        align: 'center',
        width: 90,
        render: row => `${row.duration}ms`
      },
      {
        key: 'createdAt',
        title: $t('page.system.fileLog.createdAt'),
        align: 'center',
        width: 170,
        render: row => formatDateTime(row.createdAt)
      },
      {
        key: 'operate',
        title: $t('common.operate'),
        align: 'center',
        width: 80,
        render: (row: Api.Disk.FileAuditLog) => {
          return (
            <ButtonIcon
              text
              type="primary"
              icon="material-symbols:visibility-outline"
              tooltipContent={$t('common.detail')}
              onClick={() => handleDetail(row.id)}
            />
          );
        }
      }
    ]
  });

const { checkedRowKeys, onBatchDeleted, drawerVisible, editingData, handleEdit } = useTableOperate(data, 'id', getData);

async function handleBatchDelete() {
  const { error } = await fetchBatchDeleteFileAudit(checkedRowKeys.value);
  if (error) return;
  onBatchDeleted();
}

function handleDetail(id: CommonType.IdType) {
  handleEdit(id);
}

async function handleClean() {
  window.$dialog?.warning({
    title: $t('common.warning'),
    content: $t('page.system.fileLog.clearConfirm'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      const { error } = await fetchCleanFileAudit();
      if (!error) {
        window.$message?.success($t('page.system.fileLog.clearSuccess'));
        getData();
      }
    }
  });
}

function handleExport() {
  download('/disk/fileAudit/export', searchParams.value, `文件操作日志_${new Date().getTime()}.xlsx`);
}

function handleResetSearch() {
  getDataByPage();
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <FileAuditSearch v-model:model="searchParams" @reset="handleResetSearch" @search="getDataByPage" />
    <NCard :title="$t('page.system.fileLog.pageTitle')" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedRowKeys.length === 0"
          :loading="loading"
          :show-add="false"
          :show-delete="hasAuth('monitor:filelog:remove')"
          :show-export="hasAuth('monitor:filelog:export')"
          @delete="handleBatchDelete"
          @export="handleExport"
          @refresh="getData"
        >
          <template #prefix>
            <NButton v-if="hasAuth('monitor:filelog:clear')" size="small" ghost type="error" @click="handleClean">
              <template #icon>
                <icon-material-symbols-warning-outline-rounded />
              </template>
              {{ $t('common.clear') }}
            </NButton>
          </template>
        </TableHeaderOperation>
      </template>
      <NDataTable
        v-model:checked-row-keys="checkedRowKeys"
        :columns="columns"
        :data="data"
        size="small"
        :flex-height="!appStore.isMobile"
        :scroll-x="scrollX"
        :loading="loading"
        remote
        :row-key="row => row.id"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
      <FileAuditDetailDrawer v-model:visible="drawerVisible" :row-data="editingData" />
    </NCard>
  </div>
</template>

<style scoped></style>
