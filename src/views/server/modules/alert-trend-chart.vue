<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useEcharts } from '@/hooks/common/echarts';
import { fetchGetAlertTrend } from '@/service/api/server';
import { $t } from '@/locales';

defineOptions({ name: 'AlertTrendChart' });

const { domRef, updateOptions } = useEcharts(() => ({
  tooltip: { trigger: 'axis' },
  legend: { top: 0, data: ['critical', 'warning', 'info'] },
  grid: { left: '3%', right: '4%', bottom: '3%', top: '18%', containLabel: true },
  xAxis: { type: 'category', boundaryGap: false, data: [] as string[] },
  yAxis: { type: 'value' },
  series: [
    { name: 'critical', type: 'line', smooth: true, areaStyle: {}, color: '#d03050', data: [] as number[] },
    { name: 'warning', type: 'line', smooth: true, areaStyle: {}, color: '#f0a020', data: [] as number[] },
    { name: 'info', type: 'line', smooth: true, areaStyle: {}, color: '#2080f0', data: [] as number[] }
  ]
}));

const loading = ref(false);
const errored = ref(false);

/** 拉取告警趋势数据并刷新图表 */
async function load() {
  loading.value = true;
  errored.value = false;
  const { data, error } = await fetchGetAlertTrend(7);
  loading.value = false;
  if (error || !data) {
    errored.value = true;
    return;
  }
  updateOptions(opts => {
    opts.xAxis.data = data.map(i => i.date);
    opts.series[0].data = data.map(i => i.critical);
    opts.series[1].data = data.map(i => i.warning);
    opts.series[2].data = data.map(i => i.info);
    return opts;
  });
}

onMounted(load);

defineExpose({ load, loading, errored });
</script>

<template>
  <div class="relative h-full">
    <div ref="domRef" class="h-300px w-full"></div>
    <div
      v-if="errored"
      class="flex-center absolute inset-0 flex-col gap-8px"
    >
      <span class="opacity-70">{{ $t('common.loadError') }}</span>
      <NButton size="small" @click="load">{{ $t('common.retry') }}</NButton>
    </div>
  </div>
</template>
