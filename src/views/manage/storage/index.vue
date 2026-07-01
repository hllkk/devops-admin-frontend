<script setup lang="tsx">
import { ref } from 'vue';
import { fetchDeleteStorageLibrary, fetchGetStorageLibraries } from '@/service/api/disk/storage';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { useNaivePaginatedTable } from '@/hooks/common/table';
import { formatFileSize } from '@/utils/file';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import TransferModal from './modules/transfer-modal.vue';

defineOptions({ name: 'StorageManage' });

const appStore = useAppStore();
const { hasAuth } = useAuth();

/** 将 "2006-01-02 15:04:05" 格式的时间转为相对时间描述 */
function timeAgo(raw: string): string {
  if (!raw) return '-';
  const d = new Date(raw.replace(' ', 'T') + (raw.includes('+') || raw.includes('Z') ? '' : '+08:00'));
  if (Number.isNaN(d.getTime())) return raw;
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  return raw.slice(0, 10); // 超过7天只显示日期
}

const searchParams = ref({
  pageNum: 1,
  pageSize: 10,
  keyword: undefined as string | undefined,
  quotaState: undefined as string | undefined
});

const transferVisible = ref(false);
const currentLibrary = ref<Api.Disk.StorageAdmin.LibraryItem | null>(null);

function quotaPercent(item: Api.Disk.StorageAdmin.LibraryItem): number {
  if (item.quotaUnlimited || (item.quotaLimit ?? 0) <= 0) return 0;
  return Math.min(100, Math.round((item.totalSize / item.quotaLimit!) * 100));
}

function openTransfer(item: Api.Disk.StorageAdmin.LibraryItem) {
  currentLibrary.value = item;
  transferVisible.value = true;
}

type LibRow = Api.Disk.StorageAdmin.LibraryItem;



const { columns, columnChecks, data, getData, getDataByPage, loading, mobilePagination, scrollX } =
  useNaivePaginatedTable({
    api: () => fetchGetStorageLibraries({ ...searchParams.value, keyword: searchParams.value.keyword || undefined }),
    transform: response => {
      const d = response.data;
      if (!d) return { data: [], pageNum: 1, pageSize: 10, total: 0 };
      return { data: d.rows, pageNum: searchParams.value.pageNum, pageSize: searchParams.value.pageSize, total: d.total };
    },
    onPaginationParamsChange: params => {
      searchParams.value.pageNum = params.page ?? 1;
      searchParams.value.pageSize = params.pageSize ?? 10;
    },
    columns: () => [
      {
        key: 'nickName' as const,
        title: '资料库',
        align: 'center' as const,
        minWidth: 140,
        render(row: LibRow) {
          return `${row.nickName}(${row.userName})`;
        }
      },
      {
        key: 'deptName' as const,
        title: '部门',
        align: 'center' as const,
        minWidth: 100,
        render(row: LibRow) {
          return row.deptName || '';
        }
      },
      {
        key: 'totalSize' as const,
        title: '大小',
        align: 'center' as const,
        minWidth: 120,
        render(row: LibRow) {
          return formatFileSize(row.totalSize);
        }
      },
      {
        key: 'quota' as const,
        title: '配额',
        align: 'center' as const,
        minWidth: 200,
        render(row: LibRow) {
          if (row.quotaUnlimited) return <n-tag type="info" size="small">无限</n-tag>;
          const pct = quotaPercent(row);
          const s: 'success' | 'warning' | 'error' = pct >= 100 ? 'error' : pct >= 80 ? 'warning' : 'success';
          return (
            <div class="flex-col-center gap-4px w-full">
              <n-progress type="line" percentage={pct} status={s} show-indicator={false} />
              <span class="text-12px">{formatFileSize(row.totalSize)} / {formatFileSize(row.quotaLimit)}</span>
            </div>
          );
        }
      },
      {
        key: 'totalFiles' as const,
        title: '文件数',
        align: 'center' as const,
        minWidth: 90,
        render(row: LibRow) {
          return String(row.totalFiles);
        }
      },
      {
        key: 'shareCount' as const,
        title: '共享数',
        align: 'center' as const,
        minWidth: 90,
        render(row: LibRow) {
          return String(row.shareCount);
        }
      },
      {
        key: 'trashCount' as const,
        title: '回收站',
        align: 'center' as const,
        minWidth: 90,
        render(row: LibRow) {
          return String(row.trashCount);
        }
      },
      {
        key: 'lastActiveTime' as const,
        title: '最后活跃',
        align: 'center' as const,
        minWidth: 140,
        render(row: LibRow) {
          if (!row.lastActiveTime) return '-';
          return (
            <n-tooltip trigger="hover">
              {{ trigger: () => <span class="text-12px cursor-default">{timeAgo(row.lastActiveTime)}</span>, default: () => row.lastActiveTime }}
            </n-tooltip>
          );
        }
      },
      {
        key: 'status' as const,
        title: '状态',
        align: 'center' as const,
        width: 70,
        render(row: LibRow) {
          return row.status === '1' ? <n-tag type="success" size="small">正常</n-tag> : <n-tag type="warning" size="small">停用</n-tag>;
        }
      },
      {
        key: 'operate' as const,
        title: $t('common.operate'),
        align: 'center' as const,
        width: 120,
        fixed: 'right' as const,
        render(row: LibRow) {
          return (
            <div class="flex-center gap-8px">
              {hasAuth('system:storage:transfer') ? (
                <ButtonIcon text type="primary" icon="material-symbols:swap-horiz"
                  tooltipContent="转让" onClick={() => openTransfer(row)} />
              ) : null}
              {hasAuth('system:storage:delete') ? (
                <ButtonIcon text type="error" icon="material-symbols:delete-outline"
                  tooltipContent="清空" popconfirmContent={`确认清空「${row.nickName}」的全部文件?此操作不可逆。`}
                  onPositiveClick={() => handleDelete(row)} />
              ) : null}
            </div>
          );
        }
      }
    ]
  });

async function handleDelete(item: Api.Disk.StorageAdmin.LibraryItem) {
  const { error } = await fetchDeleteStorageLibrary(item.userId);
  if (error) return;
  window.$message?.success('资料库已清空');
  getData();
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :bordered="false" size="small" class="card-wrapper">
      <NFlex align="center" :wrap="false" justify="end">
        <NInput
          v-model:value="searchParams.keyword"
          placeholder="用户名/昵称"
          clearable
          class="max-w-200px"
          @keyup.enter="() => getDataByPage()"
        />
        <NButton type="primary" @click="() => getDataByPage()">
          <icon-mdi-magnify class="text-icon" />
          {{ $t('common.search') }}
        </NButton>
      </NFlex>
    </NCard>
    <NCard title="存储管理" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :loading="loading"
          :show-add="false"
          :show-delete="false"
          @refresh="getData"
        />
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        size="small"
        :flex-height="!appStore.isMobile"
        :scroll-x="scrollX"
        :loading="loading"
        remote
        :row-key="(row: LibRow) => row.userId"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
    </NCard>
    <TransferModal v-model:visible="transferVisible" :library="currentLibrary" @submitted="getData" />
  </div>
</template>
