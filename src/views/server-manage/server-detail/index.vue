<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { NButton, NCard, NDescriptions, NDescriptionsItem, NEmpty, NSpin, NTag } from 'naive-ui';
import { useAppStore } from '@/store/modules/app';
import { fetchGetServerDetail } from '@/service/api/server';
import { $t } from '@/locales';
import HostCredential from './modules/host-credential.vue';
import ServerMetricsChart from './modules/server-metrics-chart.vue';
import OpLogTimeline from './modules/op-log-timeline.vue';

defineOptions({ name: 'ServerDetail' });

const route = useRoute();
const appStore = useAppStore();
const serverId = computed(() => route.params.id as CommonType.IdType);
const descColumn = computed(() => (appStore.isMobile ? 1 : 3));

const detail = ref<Api.Server.ServerDetail | null>(null);
const loading = ref(true);
const errored = ref(false);

async function load() {
  loading.value = true;
  errored.value = false;
  const { data, error } = await fetchGetServerDetail(serverId.value);
  loading.value = false;
  if (error || !data) {
    errored.value = true;
    return;
  }
  detail.value = data;
}

onMounted(load);

const STATUS_TAG_TYPE: Record<Api.Server.Status, 'success' | 'warning' | 'error'> = {
  online: 'success',
  warning: 'warning',
  offline: 'error'
};
const STATUS_LABEL: Record<Api.Server.Status, string> = {
  online: $t('page.server.serverList.online'),
  warning: $t('page.server.serverList.warning'),
  offline: $t('page.server.serverList.offline')
};

function statusTagType(s: Api.Server.Status): 'success' | 'warning' | 'error' {
  return STATUS_TAG_TYPE[s];
}
function statusLabel(s: Api.Server.Status): string {
  return STATUS_LABEL[s];
}
function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return `${d}d ${h}h`;
}
</script>

<template>
  <div class="h-full overflow-auto p-16px">
    <NSpin :show="loading">
      <div v-if="errored" class="flex-col-center gap-8px py-40px">
        <NEmpty :description="$t('common.loadError')" />
        <NButton size="small" @click="load">{{ $t('common.retry') }}</NButton>
      </div>

      <div v-else-if="detail" class="flex-col-stretch gap-16px">
        <NCard :bordered="false" size="small" class="card-wrapper" :title="$t('page.server.serverDetail.basicInfo')">
          <NDescriptions label-placement="left" :column="descColumn" size="small">
            <NDescriptionsItem :label="$t('page.server.serverList.name')">{{ detail.name }}</NDescriptionsItem>
            <NDescriptionsItem :label="$t('page.server.serverList.ip')">{{ detail.ip }}</NDescriptionsItem>
            <NDescriptionsItem :label="$t('page.server.serverList.status')">
              <NTag :type="statusTagType(detail.status)" size="small" round>{{ statusLabel(detail.status) }}</NTag>
            </NDescriptionsItem>
            <NDescriptionsItem :label="$t('page.server.serverDetail.hostname')">{{ detail.hostname }}</NDescriptionsItem>
            <NDescriptionsItem :label="$t('page.server.serverDetail.os')">{{ detail.os }}</NDescriptionsItem>
            <NDescriptionsItem :label="$t('page.server.serverDetail.cpuModel')">{{ detail.cpuModel }}</NDescriptionsItem>
            <NDescriptionsItem :label="$t('page.server.serverDetail.coreCount')">{{ detail.coreCount }}</NDescriptionsItem>
            <NDescriptionsItem :label="$t('page.server.serverDetail.location')">{{ detail.location }}</NDescriptionsItem>
            <NDescriptionsItem :label="$t('page.server.serverDetail.uptime')">
              {{ fmtUptime(detail.uptimeSeconds) }}
            </NDescriptionsItem>
          </NDescriptions>
        </NCard>

        <NCard :bordered="false" size="small" class="card-wrapper" :title="$t('page.server.serverDetail.realtimeMonitor')">
          <ServerMetricsChart :server-id="serverId" />
        </NCard>

        <div class="grid gap-16px lg:grid-cols-2">
          <HostCredential :server-id="serverId" />
          <NCard :bordered="false" size="small" class="card-wrapper" :title="$t('page.server.serverDetail.opLogs')">
            <OpLogTimeline :server-id="serverId" />
          </NCard>
        </div>
      </div>
    </NSpin>
  </div>
</template>
