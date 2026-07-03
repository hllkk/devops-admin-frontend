<script setup lang="ts">
import { watch } from 'vue';
import { useEcharts } from '@/hooks/common/echarts';

defineOptions({ name: 'ResourceGauge' });

interface Props {
  /** 当前使用率（0-100） */
  value: number;
  /** 仪表盘下方标题 */
  title: string;
  /** 进度条颜色 */
  color?: string;
}

const props = withDefaults(defineProps<Props>(), { color: '#8e9dff' });

const { domRef, updateOptions } = useEcharts(() => ({
  series: [
    {
      type: 'gauge',
      startAngle: 210,
      endAngle: -30,
      min: 0,
      max: 100,
      progress: { show: true, width: 14, roundCap: true, itemStyle: { color: props.color } },
      axisLine: { lineStyle: { width: 14, color: [[1, 'rgba(128,128,128,0.15)']] } },
      axisTick: { show: false },
      splitLine: { length: 8, lineStyle: { width: 1, color: 'rgba(128,128,128,0.3)' } },
      pointer: { show: false },
      axisLabel: { show: false },
      anchor: { show: false },
      detail: {
        valueAnimation: true,
        fontSize: 22,
        offsetCenter: [0, '0%'],
        formatter: '{value}%'
      },
      title: { offsetCenter: [0, '40%'], fontSize: 13 },
      data: [{ value: 0, name: props.title }]
    }
  ]
}));

/**
 * 响应式更新：监听 value 与 color 变化，实时刷新仪表盘数值与配色。
 *
 * useEcharts 内部会在 DOM 拥有尺寸后自动首次渲染，此处的 watch（immediate: true）
 * 负责把真实数值同步到 series.data 中，避免父组件需要手动调用 render。
 */
watch(
  () => props.value,
  v => {
    updateOptions(opts => {
      opts.series[0].data = [{ value: v, name: props.title }];
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
  <div ref="domRef" class="h-220px w-full"></div>
</template>
