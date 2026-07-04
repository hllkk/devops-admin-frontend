<script setup lang="tsx">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NCard, NDataTable, NEmpty, NRadioButton, NRadioGroup, NSpace, NSpin, NTag } from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import { useAuth } from '@/hooks/business/auth';
import { defaultTransform, useNaivePaginatedTable, useTableOperate } from '@/hooks/common/table';
import { $t } from '@/locales';
import {
  fetchGetServerList,
  fetchBatchDeleteServer,
  fetchGetGroupTree
} from '@/service/api/server/server';
import { flattenGroups } from '@/service/api/server/group';
import ServerSearch from './modules/server-search.vue';
import ServerCardItem from './modules/server-card-item.vue';
import MetricBar from './modules/metric-bar.vue';
import ServerGroupTree from './modules/server-group-tree.vue';
import ServerOperateDrawer from './modules/server-operate-drawer.vue';
import ServerImportModal from './modules/server-import-modal.vue';
import ServerMoveModal from './modules/server-move-modal.vue';
import ServerMoveWorkbenchModal from './modules/server-move-workbench-modal.vue';

defineOptions({ name: 'ServerList' });

const { hasAuth } = useAuth();
const router = useRouter();
const route = useRoute();

const { bool: importVisible, setTrue: openImport } = useBoolean();
const { bool: moveVisible, setTrue: openMove, setFalse: closeMove } = useBoolean();
const { bool: workbenchVisible, setTrue: openWorkbench } = useBoolean();
const workbenchDefaultGroupId = ref<CommonType.IdType>(0);

const selectedGroupId = ref<CommonType.IdType>(0);
const viewMode = ref<'table' | 'card'>('table');

const flatGroupOptions = ref<{ id: CommonType.IdType; name: string }[]>([]);

const searchParams = ref<Api.Server.ServerSearchParams>({
  pageNum: 1,
  pageSize: 10,
  name: null,
  ip: null,
  status: null,
  os: null,
  groupId: null,
  params: {}
});

async function refreshGroupOptions() {
  const { data } = await fetchGetGroupTree();
  if (data) {
    flatGroupOptions.value = flattenGroups(data);
  }
}

/** 根据 OS 名称返回 iconify 图标名(科技感 logo 风格) */
function getOsIcon(os: string): string {
  const lower = os.toLowerCase();
  if (lower.includes('windows')) return 'logos:microsoft-windows-icon';
  if (lower.includes('ubuntu')) return 'logos:ubuntu';
  if (lower.includes('debian')) return 'logos:debian';
  if (lower.includes('centos')) return 'devicon-centos';
  if (lower.includes('rocky')) return 'logos-rocky-linux-icon';
  if (lower.includes('redhat')) return 'devicon-redhat';
  if (lower.includes('fedora')) return 'devicon-fedora';
  if (lower.includes('rhel')) {
    return 'mdi:linux';
  }
  return 'streamline-color-database-server-2';
}

const { columns, columnChecks, data, getData, getDataByPage, loading, mobilePagination, scrollX } =
  useNaivePaginatedTable({
    api: () => fetchGetServerList(searchParams.value),
    transform: response => defaultTransform(response),
    onPaginationParamsChange: params => {
      searchParams.value.pageNum = params.page;
      searchParams.value.pageSize = params.pageSize;
    },
    columns: () => [
      {
        type: 'selection',
        align: 'center',
        width: 48
      },
      {
        key: 'name',
        title: $t('page.server.serverList.name'),
        minWidth: 180,
        render: row => {
          const osIcon = getOsIcon(row.os);
          return (
            <NSpace size={8} align="center" wrap={false}>
              <SvgIcon icon={osIcon} class="text-18px text-primary" />
              <span class="truncate">{row.name}</span>
            </NSpace>
          );
        }
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
        key: 'os',
        title: $t('page.server.serverList.os'),
        width: 140,
        ellipsis: { tooltip: true }
      },
      {
        key: 'location',
        title: $t('page.server.serverList.location'),
        width: 120,
        ellipsis: { tooltip: true }
      },
      {
        key: 'cpuUsage',
        title: $t('page.server.serverList.cpu'),
        width: 140,
        render: row => <MetricBar value={row.cpuUsage} />
      },
      {
        key: 'memUsage',
        title: $t('page.server.serverList.mem'),
        width: 140,
        render: row => <MetricBar value={row.memUsage} />
      },
      {
        key: 'diskUsage',
        title: $t('page.server.serverList.disk'),
        width: 140,
        render: row => <MetricBar value={row.diskUsage} />
      },
      {
        key: 'operations',
        title: $t('page.server.serverList.operations'),
        width: 200,
        fixed: 'right',
        render: row => (
          <NSpace size={8}>
            <NButton size="small" type="primary" tertiary onClick={() => goDetail(row.id)}>
              {$t('page.server.serverList.detail')}
            </NButton>
            <NButton size="small" type="primary" tertiary onClick={() => edit(row.id)}>
              {$t('page.server.serverList.edit')}
            </NButton>
          </NSpace>
        )
      }
    ]
  });

const { drawerVisible, operateType, editingData, handleAdd, handleEdit, checkedRowKeys, onBatchDeleted } =
  useTableOperate(data, 'id', getData);

function goDetail(id: CommonType.IdType) {
  router.push({ name: 'server-manage_server-detail', params: { id } });
}

function edit(id: CommonType.IdType) {
  handleEdit(id);
}

function onSearch() {
  getDataByPage(1);
}

function onReset() {
  searchParams.value = {
    pageNum: 1,
    pageSize: 10,
    name: null,
    ip: null,
    status: null,
    os: null,
    groupId: selectedGroupId.value === 0 ? null : selectedGroupId.value,
    params: {}
  };
  getDataByPage(1);
}

async function handleBatchDelete() {
  const ids = checkedRowKeys.value;
  if (ids.length === 0) return;
  const { error } = await fetchBatchDeleteServer(ids);
  if (error) {
    window.$message?.error(error.message);
    return;
  }
  await onBatchDeleted();
}

function handleExport() {
  const headers = [
    $t('page.server.serverList.name'),
    $t('page.server.serverList.ip'),
    $t('page.server.serverList.status'),
    $t('page.server.serverList.os'),
    $t('page.server.serverList.location'),
    $t('page.server.serverList.cpu'),
    $t('page.server.serverList.mem'),
    $t('page.server.serverList.disk')
  ];
  const rows = data.value.map(s => [
    s.name,
    s.ip,
    s.status,
    s.os,
    s.location ?? '',
    `${s.cpuUsage}%`,
    `${s.memUsage}%`,
    `${s.diskUsage}%`
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const blobURL = window.URL.createObjectURL(blob);
  const tempLink = Object.assign(document.createElement('a'), {
    style: { display: 'none' },
    href: blobURL,
    download: `${$t('page.server.serverList.exportFileName')}_${Date.now()}.csv`
  });
  document.body.appendChild(tempLink);
  tempLink.click();
  document.body.removeChild(tempLink);
  window.URL.revokeObjectURL(blobURL);
}

async function onGroupRefresh() {
  await Promise.all([refreshGroupOptions(), getDataByPage()]);
}

function onGroupAddServer(groupId: CommonType.IdType) {
  selectedGroupId.value = groupId;
  handleAdd();
}

function onGroupMoveHosts(groupId: CommonType.IdType) {
  workbenchDefaultGroupId.value = groupId;
  openWorkbench();
}

function onGroupDeleteHosts(group: Api.Server.ServerGroup) {
  if ((group.serverCount ?? 0) === 0) {
    window.$message?.warning($t('page.server.group.noHosts'));
    return;
  }
  window.$dialog?.warning({
    title: $t('common.tip'),
    content: $t('page.server.group.deleteHostsConfirm', { group: group.name, count: group.serverCount ?? 0 }),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      const { data: serverPage, error } = await fetchGetServerList({
        groupId: group.id,
        includeSubGroups: false,
        pageNum: 1,
        pageSize: 9999,
        name: null,
        ip: null,
        status: null,
        os: null,
        params: {}
      });
      if (error) {
        window.$message?.error(error.message);
        return;
      }
      const ids = (serverPage?.rows ?? []).map(s => s.id);
      if (ids.length === 0) return;
      const { error: delError } = await fetchBatchDeleteServer(ids);
      if (delError) {
        window.$message?.error(delError.message);
        return;
      }
      window.$message?.success($t('common.deleteSuccess'));
      await onGroupRefresh();
    }
  });
}

async function onWorkbenchSubmitted() {
  workbenchVisible.value = false;
  await getDataByPage(1);
  await refreshGroupOptions();
}

async function handleMoveSubmitted() {
  closeMove();
  await getDataByPage(1);
}

onMounted(async () => {
  await refreshGroupOptions();
  if (route.query.groupId) {
    const id = Number(route.query.groupId) as CommonType.IdType;
    selectedGroupId.value = id;
    searchParams.value.groupId = id;
  }
});

const flatGroupsForDrawer = computed(() => flatGroupOptions.value);
</script>

<template>
  <TableSiderLayout
    :sider-title="$t('page.server.group.title')"
    :default-expanded="true"
  >
    <template #header-extra>
      <NButton size="small" text class="h-18px" @click="onGroupRefresh">
        <template #icon>
          <SvgIcon icon="ic:round-refresh" />
        </template>
      </NButton>
    </template>
    <template #sider>
      <ServerGroupTree
        v-model="selectedGroupId"
        @refresh-server="onGroupRefresh"
        @add-server="onGroupAddServer"
        @move-hosts="onGroupMoveHosts"
        @delete-hosts="onGroupDeleteHosts"
      />
    </template>
    <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
      <ServerSearch v-model:model="searchParams" @reset="onReset" @search="onSearch" />
      <TableRowCheckAlert v-model:checked-row-keys="checkedRowKeys" />
      <NCard
        :title="$t('page.server.serverList.title')"
        :bordered="false"
        size="small"
        class="card-wrapper sm:flex-1-hidden"
      >
        <template #header-extra>
          <TableHeaderOperation
            v-model:columns="columnChecks"
            :disabled-delete="checkedRowKeys.length === 0"
            :loading="loading"
            :show-add="hasAuth('server:server:add')"
            :show-delete="hasAuth('server:server:remove')"
            :show-export="hasAuth('server:server:export')"
            @add="handleAdd"
            @delete="handleBatchDelete"
            @export="handleExport"
            @refresh="getData"
          >
            <template #prefix>
              <NRadioGroup v-model:value="viewMode" size="small">
                <NRadioButton value="table">{{ $t('page.server.serverList.tableView') }}</NRadioButton>
                <NRadioButton value="card">{{ $t('page.server.serverList.cardView') }}</NRadioButton>
              </NRadioGroup>
            </template>
            <template #after>
              <NButton size="small" ghost @click="openImport">
                <template #icon>
                  <icon-material-symbols-upload-rounded class="text-icon" />
                </template>
                {{ $t('common.import') }}
              </NButton>
              <NButton
                size="small"
                ghost
                :disabled="checkedRowKeys.length === 0"
                @click="openMove"
              >
                <template #icon>
                  <icon-material-symbols-drive-file-move class="text-icon" />
                </template>
                {{ $t('page.server.serverList.move') }}
              </NButton>
            </template>
          </TableHeaderOperation>
        </template>

        <NDataTable
          v-show="viewMode === 'table'"
          v-model:checked-row-keys="checkedRowKeys"
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
              />
            </div>
            <NEmpty v-else :description="$t('common.noData')" class="py-40px" />
          </NSpin>
        </div>

        <ServerOperateDrawer
          v-model:visible="drawerVisible"
          :operate-type="operateType"
          :row-data="editingData"
          :group-options="flatGroupsForDrawer"
          :default-group-id="selectedGroupId === 0 ? undefined : selectedGroupId"
          @submitted="getDataByPage(1)"
        />
        <ServerImportModal
          v-model:visible="importVisible"
          :default-group-id="selectedGroupId === 0 ? 13 : selectedGroupId"
          :group-options="flatGroupsForDrawer"
          @submitted="getDataByPage(1)"
        />
        <ServerMoveModal
          v-model:visible="moveVisible"
          :server-ids="checkedRowKeys"
          :server-count="checkedRowKeys.length"
          :exclude-group-id="selectedGroupId"
          :group-options="flatGroupsForDrawer"
          @submitted="handleMoveSubmitted"
        />
        <ServerMoveWorkbenchModal
          v-model:visible="workbenchVisible"
          :default-group-id="workbenchDefaultGroupId"
          @submitted="onWorkbenchSubmitted"
        />
      </NCard>
    </div>
  </TableSiderLayout>
</template>

<style scoped>
:deep(.n-data-table-wrapper),
:deep(.n-data-table-base-table),
:deep(.n-data-table-base-table-body) {
  height: 100%;
}
</style>
