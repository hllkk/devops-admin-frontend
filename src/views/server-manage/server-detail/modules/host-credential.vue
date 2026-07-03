<script setup lang="ts">
import { ref } from 'vue';
import { NButton, NCard, NDescriptions, NDescriptionsItem, NEmpty, NSpin, NTag, useMessage } from 'naive-ui';
import { $t } from '@/locales';
import { fetchGetServerCredential } from '@/service/api/server';

defineOptions({ name: 'HostCredential' });

interface Props {
  serverId: CommonType.IdType;
}
const props = defineProps<Props>();

const message = useMessage();

const credential = ref<Api.Server.HostCredential | null>(null);
const loading = ref(false);
const errored = ref(false);

async function load() {
  loading.value = true;
  errored.value = false;
  const { data, error } = await fetchGetServerCredential(props.serverId);
  loading.value = false;
  if (error || !data) {
    errored.value = true;
    return;
  }
  credential.value = data;
}

async function copySecret() {
  if (!credential.value) return;
  // 安全说明：后端仅返回脱敏占位（maskedSecret），真实密钥永不返回前端；
  // 此处复制的只是脱敏占位字符串，用于演示与占位粘贴，不涉及敏感数据泄露。
  await navigator.clipboard.writeText(credential.value.maskedSecret);
  message.success($t('page.server.serverDetail.copy'));
}

load();
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" :title="$t('page.server.serverDetail.hostCredential')">
    <template #header-extra>
      <NButton size="small" tertiary :loading="loading" :disabled="!credential || errored" @click="copySecret">
        {{ $t('page.server.serverDetail.copy') }}
      </NButton>
    </template>

    <NSpin :show="loading">
      <NDescriptions v-if="credential" label-placement="left" :column="2" size="small">
        <NDescriptionsItem :label="$t('page.server.serverDetail.hostCredential')">
          <NTag size="small" round>{{ credential.type.toUpperCase() }}</NTag>
        </NDescriptionsItem>
        <NDescriptionsItem label="User">{{ credential.username }}</NDescriptionsItem>
        <NDescriptionsItem label="Port">{{ credential.port }}</NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.server.serverDetail.masked')">
          <span class="tabular-nums opacity-80">{{ credential.maskedSecret }}</span>
        </NDescriptionsItem>
      </NDescriptions>

      <NEmpty v-else-if="!errored" :description="$t('page.server.serverDetail.masked')" />

      <div v-if="errored" class="flex-center py-16px">
        <NButton size="small" @click="load">{{ $t('common.retry') }}</NButton>
      </div>
    </NSpin>
  </NCard>
</template>
