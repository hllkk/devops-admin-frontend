<script setup lang="tsx">
import { ref } from 'vue';
import { NButton, NCard, NDataTable, NEmpty, NRadioButton, NRadioGroup, NSpace, NSpin, NTag } from 'naive-ui';
import { defaultTransform, useNaivePaginatedTable } from '@/hooks/common/table';
import { useRouterPush } from '@/hooks/common/router';
import { fetchGetServerList } from '@/service/api/server';
import { $t } from '@/locales';
import ServerSearch from './modules/server-search.vue';
import ServerCardItem from './modules/server-card-item.vue';
import MetricBar from './modules/metric-bar.vue';

defineOptions({ name: 'ServerList' });

const { routerPush } = useRouterPush();

interface SearchModel {
  name: string | null;
  ip: string | null;
  status: Api.Server.Status | null;
}

function createDefaultParams(): SearchModel {
  return { name: null, ip: null, status: null };
}

const searchParams = ref<Api.Server.ServerSearchParams>({
  pageNum: 1,
  pageSize: 10,
  ...createDefaultParams()
});

const viewMode = ref<'table' | 'card'>('table');

const { columns, columnChecks, data, loading, getData, getDataByPage, mobilePagination, scrollX } =
  useNaivePaginatedTable({
    api: () => fetchGetServerList(searchParams.value),
    transform: response => defaultTransform(response),
    onPaginationParamsChange: params => {
      searchParams.value.pageNum = params.page;
      searchParams.value.pageSize = params.pageSize;
    },
    columns: () => [
      {
        key: 'name',
        title: $t('page.server.serverList.name'),
        minWidth: 140,
        ellipsis: { tooltip: true }
      },
      {
        key: 'ip',
        title: $t('page.server.serverList.ip'),
        width: 140
      },
      {
        key: 'status',
        title: $t('page.server.serverList.status'),
        width: 100,
        render: row => {
          const meta: Record<Api.Server.Status, 'success' | 'warning' | 'error'> = {
            online: 'success',
            warning: 'warning',
            offline: 'error'
          };
          const labelMap: Record<Api.Server.Status, string> = {
            online: $t('page.server.serverList.online'),
            warning: $t('page.server.serverList.warning'),
            offline: $t('page.server.serverList.offline')
          };
          return (
            <NTag type={meta[row.status]} size="small" round>
              {labelMap[row.status]}
            </NTag>
          );
        }
      },
      {
        key: 'cpuUsage',
        title: $t('page.server.serverList.cpu'),
        width: 160,
        render: row => <MetricBar value={row.cpuUsage} />
      },
      {
        key: 'memUsage',
        title: $t('page.server.serverList.mem'),
        width: 160,
        render: row => <MetricBar value={row.memUsage} />
      },
      {
        key: 'diskUsage',
        title: $t('page.server.serverList.disk'),
        width: 160,
        render: row => <MetricBar value={row.diskUsage} />
      },
      {
        key: 'operations',
        title: $t('page.server.serverList.operations'),
        width: 120,
        fixed: 'right',
        render: row => (
          <NSpace size={8}>
            <NButton size="small" type="primary" tertiary onClick={() => goDetail(row.id)}>
              {$t('page.server.serverList.detail')}
            </NButton>
          </NSpace>
        )
      }
    ]
  });

function goDetail(id: CommonType.IdType) {
  routerPush({ name: 'server-manage_server-detail', params: { id } });
}

function onSearch() {
  getDataByPage(1);
}

function onReset() {
  searchParams.value = { pageNum: 1, pageSize: 10, ...createDefaultParams() };
  getDataByPage(1);
}

function onRestart(id: CommonType.IdType) {
  window.$message?.info($t('page.server.serverList.restart') + ` (mock #${id})`);
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <ServerSearch v-model="searchParams" @search="onSearch" @reset="onReset" />

    <NCard :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <div class="flex items-center gap-12px">
          <NRadioGroup v-model:value="viewMode" size="small">
            <NRadioButton value="table">{{ $t('page.server.serverList.tableView') }}</NRadioButton>
            <NRadioButton value="card">{{ $t('page.server.serverList.cardView') }}</NRadioButton>
          </NRadioGroup>
          <TableHeaderOperation
            v-model:columns="columnChecks"
            :loading="loading"
            :show-add="false"
            :show-delete="false"
            :show-export="false"
            @refresh="getData"
          />
        </div>
      </template>

      <NDataTable
        v-show="viewMode === 'table'"
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="mobilePagination"
        :scroll-x="scrollX"
        size="small"
        remote
        :row-key="row => row.id"
      >
        <template #empty>
          <NEmpty :description="$t('common.noData')" class="py-40px" />
        </template>
      </NDataTable>

      <div v-show="viewMode === 'card'" class="relative">
        <NSpin :show="loading">
          <div v-if="data.length" class="grid grid-cols-1 gap-12px sm:grid-cols-2 lg:grid-cols-3">
            <ServerCardItem
              v-for="server in data"
              :key="server.id"
              :server="server"
              @detail="goDetail"
              @restart="onRestart"
            />
          </div>
          <NEmpty v-else :description="$t('common.noData')" class="py-40px" />
        </NSpin>
      </div>
    </NCard>
  </div>
</template>

<style scoped></style>
