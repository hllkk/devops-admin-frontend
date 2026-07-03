<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { NSpin, NButton } from 'naive-ui';
import StatCard from './modules/stat-card.vue';
import ResourceGauge from './modules/resource-gauge.vue';
import AlertTrendChart from './modules/alert-trend-chart.vue';
import RecentAlertList from './modules/recent-alert-list.vue';
import { useServerStore } from '@/store/modules/server';
import { $t } from '@/locales';

defineOptions({ name: 'ServerDashboard' });

const store = useServerStore();

/** 概览统计（顶部卡片 + 资源占用） */
const stats = computed(() => store.overviewStats);

/** 是否处于错误态 */
const errored = computed(() => Boolean(store.errorMsg));

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
    <!-- 顶部统计卡（毛玻璃） -->
    <div class="grid grid-cols-2 gap-16px lg:grid-cols-4">
      <StatCard
        :label="$t('page.server.dashboard.serverCount')"
        :value="stats?.serverCount ?? 0"
        icon="mdi:server-network"
        accent="primary"
      />
      <StatCard
        :label="$t('page.server.dashboard.containerCount')"
        :value="stats?.containerCount ?? 0"
        icon="mdi:docker"
        accent="success"
      />
      <StatCard
        :label="$t('page.server.dashboard.databaseCount')"
        :value="stats?.databaseCount ?? 0"
        icon="mdi:database"
        accent="warning"
      />
      <StatCard
        :label="$t('page.server.dashboard.alertCount')"
        :value="stats?.alertCount ?? 0"
        icon="mdi:bell-alert"
        accent="error"
      />
    </div>

    <NSpin :show="store.loading && !stats">
      <!-- 错误态 -->
      <div v-if="errored" class="glass-card mt-16px flex-center flex-col gap-8px py-40px">
        <span class="opacity-70">{{ store.errorMsg }}</span>
        <NButton size="small" @click="retry">{{ $t('common.retry') }}</NButton>
      </div>

      <template v-else>
        <!-- 资源总览 + 告警趋势 -->
        <div class="mt-16px grid gap-16px lg:grid-cols-2">
          <div class="glass-card p-20px">
            <div class="mb-12px text-16px font-500">{{ $t('page.server.dashboard.resourceOverview') }}</div>
            <div class="grid grid-cols-3 gap-8px">
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

          <div class="glass-card p-20px">
            <div class="mb-12px text-16px font-500">{{ $t('page.server.dashboard.alertTrend') }}</div>
            <AlertTrendChart />
          </div>
        </div>

        <!-- 最近告警 -->
        <div class="mt-16px glass-card p-20px">
          <div class="mb-12px text-16px font-500">{{ $t('page.server.dashboard.recentAlerts') }}</div>
          <RecentAlertList :alerts="store.recentAlerts" :loading="store.loading" />
        </div>
      </template>
    </NSpin>
  </div>
</template>
