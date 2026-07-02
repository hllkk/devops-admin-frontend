<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { NButton, NSpin } from 'naive-ui';
import AlertStream from './modules/alert-stream.vue';
import RealtimeGauge from './modules/realtime-gauge.vue';
import TaskTrendChart from './modules/task-trend-chart.vue';
import { usePolling } from '@/hooks/common/polling';
import { fetchGetRealtimeAlerts, fetchGetRealtimeMetrics } from '@/service/api/server';
import { $t } from '@/locales';

defineOptions({ name: 'ServerMonitor' });

const metrics = ref<Api.Server.RealtimeMetrics | null>(null);
const alerts = ref<Api.Server.AlertItem[]>([]);
const clock = ref('');
const loading = ref(true);
const errored = ref(false);

let clockTimer: ReturnType<typeof setInterval> | null = null;

/** 高频轮询：拉取实时指标 + 实时告警流 */
async function tick() {
  const [m, a] = await Promise.all([fetchGetRealtimeMetrics(), fetchGetRealtimeAlerts()]);
  loading.value = false;
  if (m.error || a.error) {
    errored.value = true;
    return;
  }
  errored.value = false;
  metrics.value = m.data;
  alerts.value = a.data ?? [];
}

const polling = usePolling(tick, 5000);

/** 实时时钟 */
function updateClock() {
  clock.value = new Date().toLocaleTimeString();
}

/** 错误态重试 */
function retry() {
  polling.stop();
  polling.start();
}

onMounted(() => {
  updateClock();
  clockTimer = setInterval(updateClock, 1000);
  polling.start();
});

onUnmounted(() => {
  polling.stop();
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
});

const cpuValue = computed(() => metrics.value?.cpu ?? 0);
const memValue = computed(() => metrics.value?.mem ?? 0);
const diskValue = computed(() => metrics.value?.disk ?? 0);
const netIn = computed(() => metrics.value?.netInKbps ?? 0);
const netOut = computed(() => metrics.value?.netOutKbps ?? 0);
</script>

<template>
  <div class="h-full overflow-auto p-16px" style="background-color: #0a0e1a">
    <!-- 顶部标题栏 + 时钟 + 连接状态 -->
    <div class="glass-panel mb-16px flex items-center justify-between px-24px py-16px">
      <div class="text-22px font-600 tracking-wide" style="text-shadow: 0 0 12px rgba(32, 128, 240, 0.6)">
        {{ $t('page.server.monitor.title') }}
      </div>
      <div class="flex items-center gap-16px text-14px opacity-80">
        <span class="tabular-nums">{{ clock }}</span>
        <span class="flex items-center gap-6px">
          <span
            class="size-8px rd-full"
            :style="{ backgroundColor: errored ? '#d03050' : '#18a058' }"
            :class="{ 'animate-pulse': !errored }"
          ></span>
          {{ errored ? $t('page.server.monitor.disconnected') : $t('page.server.monitor.live') }}
        </span>
      </div>
    </div>

    <NSpin :show="loading && !metrics">
      <!-- 实时指标卡 -->
      <div class="grid grid-cols-2 gap-16px lg:grid-cols-4">
        <div class="glass-card p-16px text-center">
          <div class="mb-4px text-13px opacity-70">{{ $t('page.server.monitor.cpu') }}</div>
          <RealtimeGauge :value="cpuValue" color="#2080f0" />
        </div>
        <div class="glass-card p-16px text-center">
          <div class="mb-4px text-13px opacity-70">{{ $t('page.server.monitor.mem') }}</div>
          <RealtimeGauge :value="memValue" color="#18a058" />
        </div>
        <div class="glass-card p-16px text-center">
          <div class="mb-4px text-13px opacity-70">{{ $t('page.server.monitor.disk') }}</div>
          <RealtimeGauge :value="diskValue" color="#f0a020" />
        </div>
        <div class="glass-card flex flex-col justify-center p-16px text-center">
          <div class="mb-4px text-13px opacity-70">{{ $t('page.server.monitor.net') }}</div>
          <div class="text-18px tabular-nums">↓{{ netIn }}</div>
          <div class="text-12px opacity-60">kbps</div>
          <div class="mt-8px text-18px tabular-nums">↑{{ netOut }}</div>
          <div class="text-12px opacity-60">kbps</div>
        </div>
      </div>

      <!-- 错误态 -->
      <div v-if="errored" class="glass-card mt-16px flex-center flex-col gap-8px py-40px">
        <span class="opacity-70">{{ $t('common.loadError') }}</span>
        <NButton size="small" @click="retry">{{ $t('common.retry') }}</NButton>
      </div>

      <template v-else>
        <!-- 实时告警流 -->
        <div class="glass-card mt-16px p-16px">
          <div class="mb-8px text-15px font-500">{{ $t('page.server.monitor.realtimeAlerts') }}</div>
          <div class="h-240px"><AlertStream :alerts="alerts" /></div>
        </div>

        <!-- 任务趋势 -->
        <div class="glass-card mt-16px p-16px">
          <div class="mb-8px text-15px font-500">{{ $t('page.server.monitor.taskTrend') }}</div>
          <TaskTrendChart />
        </div>
      </template>
    </NSpin>
  </div>
</template>
