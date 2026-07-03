<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { NButton, NEmpty, NRadioButton, NRadioGroup, NSpin } from 'naive-ui';
import { useEcharts } from '@/hooks/common/echarts';
import { fetchGetServerMetrics } from '@/service/api/server';
import { $t } from '@/locales';

defineOptions({ name: 'ServerMetricsChart' });

interface Props {
  serverId: CommonType.IdType;
}
const props = defineProps<Props>();

const range = ref<Api.Server.MetricRange>('24h');
const errored = ref(false);
const loading = ref(false);

const { domRef, updateOptions } = useEcharts(() => ({
  tooltip: { trigger: 'axis' },
  legend: { top: 0, data: ['CPU', 'MEM', 'DISK', 'NET'] },
  grid: { left: '3%', right: '4%', bottom: '3%', top: '18%', containLabel: true },
  xAxis: { type: 'category', boundaryGap: false, data: [] as string[] },
  yAxis: { type: 'value' },
  series: [
    { name: 'CPU', type: 'line', smooth: true, color: '#2080f0', data: [] as number[] },
    { name: 'MEM', type: 'line', smooth: true, color: '#18a058', data: [] as number[] },
    { name: 'DISK', type: 'line', smooth: true, color: '#f0a020', data: [] as number[] },
    { name: 'NET', type: 'line', smooth: true, color: '#d03050', data: [] as number[] }
  ]
}));

async function load() {
  loading.value = true;
  errored.value = false;
  const { data, error } = await fetchGetServerMetrics(props.serverId, range.value);
  loading.value = false;
  if (error || !data) {
    errored.value = true;
    return;
  }
  updateOptions(o => {
    o.xAxis!.data = data.cpu.map(p => p.time);
    o.series[0]!.data = data.cpu.map(p => p.value);
    o.series[1]!.data = data.mem.map(p => p.value);
    o.series[2]!.data = data.disk.map(p => p.value);
    o.series[3]!.data = data.net.map(p => p.value);
    return o;
  });
}

watch(range, load);
onMounted(load);
</script>

<template>
  <div>
    <NRadioGroup v-model:value="range" size="small" class="mb-8px">
      <NRadioButton value="1h">{{ $t('page.server.serverDetail.metricRange1h') }}</NRadioButton>
      <NRadioButton value="6h">{{ $t('page.server.serverDetail.metricRange6h') }}</NRadioButton>
      <NRadioButton value="24h">{{ $t('page.server.serverDetail.metricRange24h') }}</NRadioButton>
      <NRadioButton value="7d">{{ $t('page.server.serverDetail.metricRange7d') }}</NRadioButton>
    </NRadioGroup>

    <NSpin :show="loading">
      <div ref="domRef" class="h-320px w-full"></div>
    </NSpin>

    <NEmpty v-if="errored" :description="$t('common.loadError')">
      <template #extra>
        <NButton size="small" @click="load">{{ $t('common.retry') }}</NButton>
      </template>
    </NEmpty>
  </div>
</template>
