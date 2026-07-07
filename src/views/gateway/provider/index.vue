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
      title: '供应商名称',
      align: 'center',
      minWidth: 140,
      ellipsis: { tooltip: true }
    },
    {
      key: 'providerType',
      title: '供应商类型',
      align: 'center',
      minWidth: 120
    },
    {
      key: 'billingType',
      title: '计费类型',
      align: 'center',
      minWidth: 120,
      render: row => billingTypeText(row.billingType)
    },
    {
      key: 'monthlyBudget',
      title: '月度预算',
      align: 'center',
      minWidth: 110,
      render: row => (row.monthlyBudget ? row.monthlyBudget : '-')
    },
    {
      key: 'monthlyUsed',
      title: '月度已用',
      align: 'center',
      minWidth: 110
    },
    {
      key: 'credentialCount',
      title: '凭证数',
      align: 'center',
      minWidth: 90
    },
    {
      key: 'isActive',
      title: '状态',
      align: 'center',
      minWidth: 90,
      render: row => (
        <NTag size="small" type={row.isActive ? 'success' : 'default'}>
          {row.isActive ? '启用' : '禁用'}
        </NTag>
      )
    },
    {
      key: 'createTime',
      title: '创建时间',
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
  { label: '按 Token', value: 'token' },
  { label: '按次计费', value: 'per_call' },
  { label: '月度配额', value: 'monthly_quota' }
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
    <NCard title="供应商列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
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
