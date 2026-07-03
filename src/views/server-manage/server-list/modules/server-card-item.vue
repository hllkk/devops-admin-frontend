<script setup lang="ts">
import { NButton, NTag } from 'naive-ui';
import MetricBar from './metric-bar.vue';
import { $t } from '@/locales';

defineOptions({ name: 'ServerCardItem' });

interface Props {
  server: Api.Server.Server;
}

defineProps<Props>();

const emit = defineEmits<{
  detail: [id: CommonType.IdType];
  restart: [id: CommonType.IdType];
}>();

interface StatusMeta {
  type: NaiveUI.ThemeColor;
  text: string;
}

function statusOf(s: Api.Server.Status): StatusMeta {
  switch (s) {
    case 'online':
      return { type: 'success', text: $t('page.server.serverList.online') };
    case 'warning':
      return { type: 'warning', text: $t('page.server.serverList.warning') };
    case 'offline':
      return { type: 'error', text: $t('page.server.serverList.offline') };
    default:
      return { type: 'default', text: s };
  }
}
</script>

<template>
  <div class="card-wrapper flex flex-col gap-12px p-16px">
    <div class="flex items-center justify-between gap-8px">
      <div class="flex items-center gap-8px overflow-hidden">
        <NTag :type="statusOf(server.status).type" size="small" round>
          {{ statusOf(server.status).text }}
        </NTag>
        <span class="truncate text-15px font-500">{{ server.name }}</span>
      </div>
      <span class="shrink-0 text-12px opacity-60 tabular-nums">{{ server.ip }}</span>
    </div>

    <div class="flex flex-col gap-8px">
      <MetricBar :value="server.cpuUsage" :label="$t('page.server.serverList.cpu')" />
      <MetricBar :value="server.memUsage" :label="$t('page.server.serverList.mem')" />
      <MetricBar :value="server.diskUsage" :label="$t('page.server.serverList.disk')" />
    </div>

    <div class="flex justify-end gap-8px">
      <NButton size="small" tertiary @click="emit('restart', server.id)">
        {{ $t('page.server.serverList.restart') }}
      </NButton>
      <NButton size="small" type="primary" @click="emit('detail', server.id)">
        {{ $t('page.server.serverList.detail') }}
      </NButton>
    </div>
  </div>
</template>

<style scoped></style>
