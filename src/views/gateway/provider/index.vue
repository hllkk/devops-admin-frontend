<script setup lang="tsx">
import { ref } from 'vue';
import { NDivider, NTag } from 'naive-ui';
import { fetchBatchDeleteProvider, fetchGetProviderPage } from '@/service/api/gateway';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { defaultTransform, useNaivePaginatedTable, useTableOperate } from '@/hooks/common/table';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import ProviderOperateDrawer from './modules/provider-operate-drawer.vue';
import ProviderSearch from './modules/provider-search.vue';

defineOptions({
  name: 'GatewayProviderList'
});

const appStore = useAppStore();
const { hasAuth } = useAuth();

const searchParams = ref<Api.Gateway.ProviderSearchParams>({
  pageNum: 1,
  pageSize: 10,
  name: null,
  providerType: null,
  isActive: null
});

const { columns, columnChecks, data, getData, getDataByPage, loading, mobilePagination, scrollX } = useNaivePaginatedTable({
  api: () => fetchGetProviderPage(searchParams.value),
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
      width: 64,
      render: (_, index) => index + 1
    },
    {
      key: 'name',
      title: $t('page.gateway.provider.name'),
      align: 'center',
      minWidth: 140,
      ellipsis: { tooltip: true }
    },
    {
      key: 'providerType',
      title: $t('page.gateway.provider.type'),
      align: 'center',
      minWidth: 120
    },
    {
      key: 'billingType',
      title: $t('page.gateway.provider.billingType'),
      align: 'center',
      minWidth: 120,
      render: row => billingTypeText(row.billingType)
    },
    {
      key: 'monthlyBudget',
      title: $t('page.gateway.provider.monthlyBudget'),
      align: 'center',
      minWidth: 110,
      render: row => (row.monthlyBudget ? row.monthlyBudget : '-')
    },
    {
      key: 'monthlyUsed',
      title: $t('page.gateway.provider.monthlyUsed'),
      align: 'center',
      minWidth: 110
    },
    {
      key: 'credentialCount',
      title: $t('page.gateway.provider.credentialCount'),
      align: 'center',
      minWidth: 90
    },
    {
      key: 'isActive',
      title: $t('page.gateway.provider.status'),
      align: 'center',
      minWidth: 90,
      render: row => (
        <NTag size="small" type={row.isActive ? 'success' : 'default'}>
          {row.isActive ? $t('page.gateway.provider.isActiveOptions.enabled') : $t('page.gateway.provider.isActiveOptions.disabled')}
        </NTag>
      )
    },
    {
      key: 'createTime',
      title: $t('page.gateway.provider.createTime'),
      align: 'center',
      minWidth: 160,
      ellipsis: { tooltip: true }
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 130,
      fixed: 'right',
      render: row => {
        const divider = () => {
          if (!hasAuth('gateway:provider:edit') || !hasAuth('gateway:provider:remove')) {
            return null;
          }
          return <NDivider vertical />;
        };

        const editBtn = () => {
          if (!hasAuth('gateway:provider:edit')) {
            return null;
          }
          return (
            <ButtonIcon
              type="primary"
              text
              icon="material-symbols:drive-file-rename-outline-outline"
              tooltipContent={$t('common.edit')}
              onClick={() => edit(row.id)}
            />
          );
        };

        const deleteBtn = () => {
          if (!hasAuth('gateway:provider:remove')) {
            return null;
          }
          return (
            <ButtonIcon
              text
              type="error"
              icon="material-symbols:delete-outline"
              tooltipContent={$t('common.delete')}
              popconfirmContent={$t('common.confirmDelete')}
              onPositiveClick={() => handleDelete(row.id)}
            />
          );
        };

        return (
          <div class="flex-center gap-8px">
            {editBtn()}
            {divider()}
            {deleteBtn()}
          </div>
        );
      }
    }
  ]
});

const { drawerVisible, operateType, editingData, handleAdd, handleEdit, checkedRowKeys, onBatchDeleted, onDeleted } =
  useTableOperate(data, 'id', getData);

const billingTypeOptions = [
  { label: $t('page.gateway.provider.billingTypeOptions.token'), value: 'token' },
  { label: $t('page.gateway.provider.billingTypeOptions.per_call'), value: 'per_call' },
  { label: $t('page.gateway.provider.billingTypeOptions.monthly_quota'), value: 'monthly_quota' }
];

function billingTypeText(value: string) {
  return billingTypeOptions.find(o => o.value === value)?.label || value || '-';
}

async function handleBatchDelete() {
  const { error } = await fetchBatchDeleteProvider(checkedRowKeys.value);
  if (error) return;
  onBatchDeleted();
}

async function handleDelete(id: CommonType.IdType) {
  const { error } = await fetchBatchDeleteProvider([id]);
  if (error) return;
  onDeleted();
}

async function edit(id: CommonType.IdType) {
  handleEdit(id);
}

async function handleResetSearch() {
  searchParams.value.name = null;
  searchParams.value.providerType = null;
  searchParams.value.isActive = null;
  await getDataByPage();
}
</script>

<template>
  <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
    <ProviderSearch v-model:model="searchParams" @reset="handleResetSearch" @search="getDataByPage" />
    <NCard :title="$t('page.gateway.provider.title')" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedRowKeys.length === 0"
          :loading="loading"
          :show-add="hasAuth('gateway:provider:add')"
          :show-delete="hasAuth('gateway:provider:remove')"
          @add="handleAdd"
          @delete="handleBatchDelete"
          @refresh="getData"
        />
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
      <ProviderOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getData"
      />
    </NCard>
  </div>
</template>

<style scoped></style>
