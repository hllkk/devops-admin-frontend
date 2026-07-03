<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { NSpin, NButton, NEmpty, NGrid, NGi, NCard } from 'naive-ui';
import StatCard from './modules/stat-card.vue';
import ResourceGauge from './modules/resource-gauge.vue';
import AlertTrendChart from './modules/alert-trend-chart.vue';
import RecentAlertList from './modules/recent-alert-list.vue';
import { useServerStore } from '@/store/modules/server';
import { useAppStore } from '@/store/modules/app';
import { $t } from '@/locales';

defineOptions({ name: 'ServerDashboard' });

const store = useServerStore();
const appStore = useAppStore();

/** 概览统计（顶部 4 卡 + 资源占用） */
const stats = computed(() => store.overviewStats);

/** 错误态 */
const errored = computed(() => Boolean(store.errorMsg));

/** 间距：移动端 0，桌面 16（与 admin 一致） */
const gap = computed(() => (appStore.isMobile ? 0 : 16));

/** 顶部 4 个渐变统计卡（颜色映射对齐 admin 渐变体系 + 告警用警告色系） */
const statCards = computed(() => [
  {
    key: 'serverCount',
    title: $t('page.server.dashboard.serverCount'),
    value: stats.value?.serverCount ?? 0,
    icon: 'mdi:server-network',
    color: { start: '#ec4786', end: '#b955a4' }
  },
  {
    key: 'containerCount',
    title: $t('page.server.dashboard.containerCount'),
    value: stats.value?.containerCount ?? 0,
    icon: 'mdi:docker',
    color: { start: '#56cdf3', end: '#719de3' }
  },
  {
    key: 'databaseCount',
    title: $t('page.server.dashboard.databaseCount'),
    value: stats.value?.databaseCount ?? 0,
    icon: 'mdi:database',
    color: { start: '#865ec0', end: '#5144b4' }
  },
  {
    key: 'alertCount',
    title: $t('page.server.dashboard.alertCount'),
    value: stats.value?.alertCount ?? 0,
    icon: 'mdi:bell-alert',
    color: { start: '#fcbc25', end: '#f68057' }
  }
]);

onMounted(async () => {
  await store.refreshOverview();
  store.startPolling();
});

onUnmounted(() => {
  store.stopPolling();
});

/** 错误态重试 */
async function retry() {
  await store.refreshOverview();
}
</script>

<template>
  <div class="h-full overflow-auto p-16px">
    <NSpin :show="store.loading && !stats">
      <!-- 错误态：顶部 4 卡区域显示重试入口 -->
      <div v-if="errored" class="card-wrapper mt-16px flex-center flex-col gap-8px py-40px">
        <NEmpty :description="store.errorMsg ?? $t('common.loadError')" />
        <NButton type="primary" size="small" @click="retry">{{ $t('common.retry') }}</NButton>
      </div>

      <template v-else>
        <!-- Row 1: 4 个渐变统计卡（外层单卡包裹，与 admin card-data 结构一致） -->
        <NCard :bordered="false" size="small" class="card-wrapper">
          <NGrid cols="s:1 m:2 l:4" responsive="screen" :x-gap="16" :y-gap="16">
            <NGi v-for="item in statCards" :key="item.key">
              <StatCard
                :title="item.title"
                :value="item.value"
                :icon="item.icon"
                :color="item.color"
              />
            </NGi>
          </NGrid>
        </NCard>

        <!-- Row 2: 资源总览 + 告警趋势 (14:10) -->
        <NGrid :x-gap="gap" :y-gap="16" responsive="screen" item-responsive class="mt-16px">
          <NGi span="24 s:24 m:14">
            <NCard :bordered="false" class="card-wrapper">
              <div class="mb-12px text-16px font-500">{{ $t('page.server.dashboard.resourceOverview') }}</div>
              <div class="h-300px flex items-center">
                <div class="grid w-full grid-cols-3 gap-8px">
                  <ResourceGauge
                    :value="stats?.cpuUsage ?? 0"
                    :title="$t('page.server.monitor.cpu')"
                    color="#2080f0"
                  />
                  <ResourceGauge
                    :value="stats?.memUsage ?? 0"
                    :title="$t('page.server.monitor.mem')"
                    color="#18a058"
                  />
                  <ResourceGauge
                    :value="stats?.diskUsage ?? 0"
                    :title="$t('page.server.monitor.disk')"
                    color="#f0a020"
                  />
                </div>
              </div>
            </NCard>
          </NGi>
          <NGi span="24 s:24 m:10">
            <NCard :bordered="false" class="card-wrapper">
              <div class="mb-12px text-16px font-500">{{ $t('page.server.dashboard.alertTrend') }}</div>
              <AlertTrendChart />
            </NCard>
          </NGi>
        </NGrid>

        <!-- Row 3: 最近告警 -->
        <div class="mt-16px">
          <NCard :bordered="false" class="card-wrapper">
            <div class="mb-12px text-16px font-500">{{ $t('page.server.dashboard.recentAlerts') }}</div>
            <RecentAlertList :alerts="store.recentAlerts" :loading="store.loading" />
          </NCard>
        </div>
      </template>
    </NSpin>
  </div>
</template>

<style scoped></style>
