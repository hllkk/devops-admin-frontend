<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NButton, NEmpty, NSpin, NTimeline, NTimelineItem } from 'naive-ui';
import { fetchGetServerOpLogs } from '@/service/api/server';
import { $t } from '@/locales';

defineOptions({ name: 'OpLogTimeline' });

interface Props {
  serverId: CommonType.IdType;
}
const props = defineProps<Props>();

const logs = ref<Api.Server.OpLog[]>([]);
const loading = ref(false);
const errored = ref(false);

async function load() {
  loading.value = true;
  errored.value = false;
  const { data, error } = await fetchGetServerOpLogs(props.serverId);
  loading.value = false;
  if (error || !data) {
    errored.value = true;
    return;
  }
  logs.value = data;
}

onMounted(load);
</script>

<template>
  <div>
    <NSpin :show="loading">
      <NTimeline v-if="logs.length">
        <NTimelineItem
          v-for="log in logs"
          :key="log.id"
          :type="log.result === 'success' ? 'success' : 'error'"
          :title="log.action"
          :content="`${log.operator} · ${new Date(log.time).toLocaleString()}`"
        />
      </NTimeline>

      <NEmpty v-else-if="!errored" :description="$t('common.loadError')" />
    </NSpin>

    <div v-if="errored" class="flex-center py-16px">
      <NButton size="small" @click="load">{{ $t('common.retry') }}</NButton>
    </div>
  </div>
</template>
