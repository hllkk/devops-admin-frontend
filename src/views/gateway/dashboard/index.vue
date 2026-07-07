<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NSpin } from 'naive-ui';
import { fetchGetDashboard, type DashboardQuery } from '@/service/api/gateway';
import { useAppStore } from '@/store/modules/app';

defineOptions({ name: 'GatewayDashboard' });

const router = useRouter();
const appStore = useAppStore();

const data = ref<Api.Gateway.DashboardData | null>(null);
const loading = ref(false);
const period = ref('month');

const gap = computed(() => (appStore.isMobile ? 0 : 16));

const periodOptions = [
  { label: '今日', value: 'today' },
  { label: '近7天', value: '7d' },
  { label: '本月', value: 'month' },
  { label: '近30天', value: '30d' },
  { label: '上月', value: 'last_month' }
];

// 核心指标卡(1:1 AIHelms 4 卡)
const statCards = computed(() => {
  const s = data.value?.status;
  return [
    {
      key: 'activeUsers',
      title: '活跃用户',
      value: s?.activeUsers ?? 0,
      unit: '人',
      sub: s ? `较上周期 ${s.activeUsersChange >= 0 ? '+' : ''}${s.activeUsersChange}` : '',
      icon: 'mdi:account-group',
      color: '#2080f0',
      link: '/gateway/efficiency'
    },
    {
      key: 'totalRequests',
      title: '调用次数',
      value: s?.totalRequests ?? 0,
      unit: '次',
      sub: s ? `LLM ${s.llmRequests} / MCP ${s.mcpRequests}` : '',
      icon: 'mdi:chart-line',
      color: '#5318ab',
      link: '/gateway/efficiency'
    },
    {
      key: 'internalCost',
      title: '平台成本',
      value: s?.internalCost ?? 0,
      unit: '元',
      sub: s ? `外部 ${s.externalCost} / 差额 ${s.costDiff}` : '',
      icon: 'mdi:currency-cny',
      color: '#f0a020',
      link: '/gateway/efficiency'
    },
    {
      key: 'pendingCount',
      title: '待审批',
      value: s?.pendingCount ?? 0,
      unit: '件',
      sub: '点击进入资源审批',
      icon: 'mdi:clipboard-clock',
      color: '#d03050',
      link: '/gateway/security'
    }
  ];
});

// 快捷操作(指向 gateway 模块内页面 + 已有后台页面)
const quickActions = [
  { label: '供应商管理', desc: '上游供应商纳管', icon: 'mdi:domain', path: '/gateway/provider' },
  { label: '模型管理', desc: '模型与部署维护', icon: 'mdi:brain', path: '/gateway/model' },
  { label: 'AI Key 管理', desc: '额度、归属、范围', icon: 'mdi:key', path: '/gateway/ai-key' },
  { label: '操作日志', desc: '管理员操作记录', icon: 'mdi:shield-check', path: '/log/operation' },
  { label: '用户管理', desc: '平台用户', icon: 'mdi:account', path: '/manage/user' },
  { label: '部门管理', desc: '组织架构', icon: 'mdi:sitemap', path: '/manage/dept' }
];

function stateTagType(state: Api.Gateway.ServiceStatusItem['state']): 'success' | 'warning' | 'error' | 'default' {
  return ({ healthy: 'success', warning: 'warning', danger: 'error', empty: 'default' } as const)[state];
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatMoney(value: number) {
  return `¥${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

async function loadData() {
  loading.value = true;
  const params: DashboardQuery = {};
  if (period.value !== 'custom') {
    params.period = period.value;
  }
  const { data: result, error } = await fetchGetDashboard(params);
  if (!error) data.value = result;
  loading.value = false;
}

function navigate(path: string) {
  router.push(path);
}

onMounted(loadData);
</script>

<template>
  <div class="h-full overflow-auto p-16px">
    <NSpace vertical :size="16">
      <!-- 顶部：标题 + 更新时间 + 时间段 -->
      <NCard :bordered="false" size="small" class="card-wrapper">
        <div class="flex flex-wrap items-center justify-between gap-12px">
          <div>
            <div class="text-20px font-600">AI 网关 Dashboard</div>
            <div v-if="data" class="mt-4px text-12px text-gray-500">
              最后更新：{{ data.lastUpdatedLabel }} · {{ data.period.label }}
            </div>
          </div>
          <NRadioGroup v-model:value="period" size="small" @update:value="loadData">
            <NRadioButton v-for="opt in periodOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
          </NRadioGroup>
        </div>
      </NCard>

      <NSpin :show="loading">
        <template v-if="data">
          <!-- 4 核心指标卡(照 admin card-data 网格) -->
          <NGrid :x-gap="gap" :y-gap="16" responsive="screen" item-responsive>
            <NGi v-for="card in statCards" :key="card.key" span="24 s:12 m:6">
              <NCard :bordered="false" size="small" class="card-wrapper cursor-pointer" hoverable @click="navigate(card.link)">
                <div class="flex items-center justify-between">
                  <div class="flex flex-col">
                    <span class="text-13px text-gray-500">{{ card.title }}</span>
                    <span class="mt-4px text-24px font-700">
                      {{ card.key === 'internalCost' ? formatMoney(card.value) : formatNumber(card.value) }}
                      <span class="ml-2px text-12px font-400 text-gray-400">{{ card.unit }}</span>
                    </span>
                    <span class="mt-4px text-12px text-gray-400">{{ card.sub }}</span>
                  </div>
                  <div
                    class="flex h-44px w-44px items-center justify-center rounded-8px"
                    :style="{ backgroundColor: `${card.color}1a` }"
                  >
                    <SvgIcon :icon="card.icon" :style="{ color: card.color, fontSize: '24px' }" />
                  </div>
                </div>
              </NCard>
            </NGi>
          </NGrid>

          <!-- 资源概览(8 项,1:1 AIHelms) -->
          <NCard :bordered="false" size="small" class="card-wrapper mt-16px" title="资源概览">
            <NGrid :x-gap="gap" :y-gap="12" responsive="screen" item-responsive cols="2 s:4 m:8">
              <NGi v-for="resource in data.resources" :key="resource.name">
                <div
                  class="cursor-pointer rounded-8px border border-gray-100 bg-gray-50 p-12px transition hover:border-primary hover:bg-primary-50"
                  @click="navigate(resource.linkPath)"
                >
                  <div class="flex items-center justify-between">
                    <SvgIcon icon="mdi:package-variant" class="text-16px text-gray-500" />
                  </div>
                  <div class="mt-8px text-12px text-gray-500">{{ resource.name }}</div>
                  <div class="text-18px font-700">{{ resource.total }}</div>
                  <div v-if="resource.active !== null" class="text-11px text-gray-400">
                    {{ resource.active }} {{ resource.activeLabel }}
                  </div>
                </div>
              </NGi>
            </NGrid>
          </NCard>

          <!-- 快捷操作 + 服务状态 -->
          <NGrid :x-gap="gap" :y-gap="16" responsive="screen" item-responsive class="mt-16px">
            <NGi span="24 s:24 m:12">
              <NCard :bordered="false" size="small" class="card-wrapper h-full" title="快捷操作">
                <NGrid :x-gap="12" :y-gap="12" responsive="screen" item-responsive cols="1 s:2">
                  <NGi v-for="action in quickActions" :key="action.label">
                    <div
                      class="flex cursor-pointer items-center gap-12px rounded-8px border border-gray-100 p-12px transition hover:border-primary hover:bg-primary-50"
                      @click="navigate(action.path)"
                    >
                      <div class="flex h-36px w-36px shrink-0 items-center justify-center rounded-6px bg-gray-100">
                        <SvgIcon :icon="action.icon" class="text-16px text-gray-600" />
                      </div>
                      <div class="min-w-0">
                        <div class="truncate text-13px font-500">{{ action.label }}</div>
                        <div class="truncate text-11px text-gray-400">{{ action.desc }}</div>
                      </div>
                    </div>
                  </NGi>
                </NGrid>
              </NCard>
            </NGi>
            <NGi span="24 s:24 m:12">
              <NCard :bordered="false" size="small" class="card-wrapper h-full" title="服务状态">
                <NSpace vertical :size="10">
                  <div
                    v-for="item in data.serviceStatus"
                    :key="item.key"
                    class="flex items-center justify-between rounded-8px border p-12px"
                    :class="{
                      'border-success-border bg-success-50': item.state === 'healthy',
                      'border-warning-border bg-warning-50': item.state === 'warning',
                      'border-error-border bg-error-50': item.state === 'danger',
                      'border-gray-200 bg-gray-50': item.state === 'empty'
                    }"
                  >
                    <NSpace align="center" :size="12">
                      <div class="flex h-32px w-32px items-center justify-center rounded-6px bg-white">
                        <SvgIcon icon="mdi:server-network" class="text-16px text-gray-600" />
                      </div>
                      <div>
                        <div class="text-13px font-500">{{ item.label }}</div>
                        <div class="text-11px opacity-80">{{ item.description }}</div>
                      </div>
                    </NSpace>
                    <NTag :type="stateTagType(item.state)" size="small">{{ item.healthy }}/{{ item.total }}</NTag>
                  </div>
                </NSpace>
              </NCard>
            </NGi>
          </NGrid>

          <!-- 调用趋势 + 最新待审批 -->
          <NGrid :x-gap="gap" :y-gap="16" responsive="screen" item-responsive class="mt-16px">
            <NGi span="24 s:24 m:14">
              <NCard :bordered="false" size="small" class="card-wrapper" title="调用趋势">
                <div v-if="data.requestTrend.length === 0" class="flex-center flex-col gap-8px py-40px">
                  <NEmpty description="暂无调用数据（待 P3 litellm spend 接入）" />
                </div>
                <div v-else class="h-200px flex items-end gap-4px">
                  <div
                    v-for="point in data.requestTrend"
                    :key="point.label"
                    class="flex-1 rounded-t bg-primary"
                    :style="{ height: `${(point.requests / Math.max(...data.requestTrend.map(p => p.requests), 1)) * 100}%` }"
                  />
                </div>
              </NCard>
            </NGi>
            <NGi span="24 s:24 m:10">
              <NCard :bordered="false" size="small" class="card-wrapper h-full" title="最新待审批">
                <div v-if="data.pendingApprovalsList.length === 0" class="flex-center flex-col gap-8px py-40px">
                  <NEmpty description="暂无待审批（待二期审批流）" />
                </div>
                <NDataTable v-else :columns="[]" :data="data.pendingApprovalsList" size="small" />
              </NCard>
            </NGi>
          </NGrid>
        </template>
      </NSpin>
    </NSpace>
  </div>
</template>

<style scoped></style>
