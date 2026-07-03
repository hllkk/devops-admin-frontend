<script setup lang="ts">
import { NButton, NCard, NInput, NSelect } from 'naive-ui';
import type { SelectOption } from 'naive-ui';
import { $t } from '@/locales';

defineOptions({ name: 'ServerSearch' });

const model = defineModel<Api.Server.ServerSearchParams>({ required: true });

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

const statusOptions: SelectOption[] = [
  { label: $t('page.server.serverList.online'), value: 'online' as const },
  { label: $t('page.server.serverList.warning'), value: 'warning' as const },
  { label: $t('page.server.serverList.offline'), value: 'offline' as const }
];
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <div class="flex flex-wrap items-center gap-12px">
      <NInput
        v-model:value="model.name"
        clearable
        :placeholder="$t('page.server.serverList.searchPlaceholder')"
        class="w-200px"
      />
      <NInput
        v-model:value="model.ip"
        clearable
        :placeholder="$t('page.server.serverList.ip')"
        class="w-180px"
      />
      <NSelect
        v-model:value="model.status"
        clearable
        :options="statusOptions"
        :placeholder="$t('page.server.serverList.status')"
        class="w-140px"
      />
      <NButton type="primary" @click="emit('search')">{{ $t('common.search') }}</NButton>
      <NButton @click="emit('reset')">{{ $t('common.reset') }}</NButton>
    </div>
  </NCard>
</template>

<style scoped></style>
