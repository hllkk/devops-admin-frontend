<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NButton } from 'naive-ui';
import { useEcharts } from '@/hooks/common/echarts';
import { fetchGetTaskTrend } from '@/service/api/server';
import { $t } from '@/locales';

defineOptions({ name: 'TaskTrendChart' });

const { domRef, updateOptions } = useEcharts(() => ({
  tooltip: { trigger: 'axis' },
  legend: { top: 0, data: ['success', 'failed'] },
  grid: { left: '3%', right: '4%', bottom: '3%', top: '18%', containLabel: true },
  xAxis: { type: 'category', data: [] as string[] },
  yAxis: { type: 'value' },
  series: [
    { name: 'success', type: 'bar', stack: 't', color: '#18a058', data: [] as number[] },
    { name: 'failed', type: 'bar', stack: 't', color: '#d03050', data: [] as number[] }
  ]
}));

const errored = ref(false);

/** 拉取任务趋势数据并刷新图表 */
async function load() {
  errored.value = false;
  const { data, error } = await fetchGetTaskTrend(7);
  if (error || !data) {
    errored.value = true;
    return;
  }
  updateOptions(opts => {
    opts.xAxis.data = data.map(i => i.date);
    opts.series[0].data = data.map(i => i.success);
    opts.series[1].data = data.map(i => i.failed);
    return opts;
  });
}

onMounted(load);
</script>

<template>
  <div class="relative h-full">
    <div ref="domRef" class="h-260px w-full"></div>
    <div v-if="errored" class="flex-center absolute inset-0 flex-col gap-8px">
      <span class="opacity-70">{{ $t('common.loadError') }}</span>
      <NButton size="small" @click="load">{{ $t('common.retry') }}</NButton>
    </div>
  </div>
</template>
