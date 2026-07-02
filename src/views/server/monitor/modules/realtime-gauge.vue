<script setup lang="ts">
import { watch } from 'vue';
import { useEcharts } from '@/hooks/common/echarts';

defineOptions({ name: 'RealtimeGauge' });

interface Props {
  /** 当前使用率（0-100） */
  value: number;
  /** 进度条颜色 */
  color: string;
}

const props = defineProps<Props>();

const { domRef, updateOptions } = useEcharts(() => ({
  series: [
    {
      type: 'gauge',
      min: 0,
      max: 100,
      radius: '90%',
      progress: { show: true, width: 12, roundCap: true, itemStyle: { color: props.color } },
      axisLine: { lineStyle: { width: 12, color: [[1, 'rgba(255,255,255,0.08)']] } },
      pointer: { length: '55%', width: 4 },
      axisTick: { show: false },
      splitLine: { length: 6, lineStyle: { color: 'rgba(255,255,255,0.3)' } },
      axisLabel: { distance: 12, fontSize: 10, color: 'rgba(255,255,255,0.5)' },
      detail: { valueAnimation: true, fontSize: 20, formatter: '{value}%', color: 'inherit' },
      data: [{ value: 0 }]
    }
  ]
}));

/**
 * 响应式更新：监听 value 变化实时刷新仪表盘数值。
 *
 * useEcharts 内部会在 DOM 拥有尺寸后自动首次渲染，此处的 watch（immediate: true）
 * 负责把真实数值同步到 series.data 中，父组件只需 :value 绑定即可。
 */
watch(
  () => props.value,
  v => {
    updateOptions(opts => {
      opts.series[0].data = [{ value: v }];
      return opts;
    });
  },
  { immediate: true }
);

watch(
  () => props.color,
  c => {
    updateOptions(opts => {
      opts.series[0].progress.itemStyle = { color: c };
      return opts;
    });
  }
);
</script>

<template>
  <div ref="domRef" class="h-200px w-full"></div>
</template>
