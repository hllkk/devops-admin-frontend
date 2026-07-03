<script setup lang="ts">
import { toRaw } from 'vue';
import { jsonClone } from '@sa/utils';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({ name: 'ServerSearch' });

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Server.ServerSearchParams>('model', { required: true });

const defaultModel = jsonClone(toRaw(model.value));

const OS_OPTIONS = [
  { label: 'Ubuntu 22.04', value: 'Ubuntu 22.04' },
  { label: 'CentOS 7', value: 'CentOS 7' },
  { label: 'Debian 12', value: 'Debian 12' },
  { label: 'Rocky 9', value: 'Rocky 9' },
  { label: 'Windows Server 2022', value: 'Windows Server 2022' }
];

const STATUS_OPTIONS = [
  { label: $t('page.server.serverList.online'), value: 'online' as const },
  { label: $t('page.server.serverList.warning'), value: 'warning' as const },
  { label: $t('page.server.serverList.offline'), value: 'offline' as const }
];

function resetModel() {
  Object.assign(model.value, defaultModel);
}

async function reset() {
  await restoreValidation();
  resetModel();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}
</script>

<template>
  <NCard :bordered="false" size="small" class="table-search card-wrapper">
    <NCollapse>
      <NCollapseItem :title="$t('common.search')" name="server-search">
        <NForm ref="formRef" :model="model" label-placement="left" :label-width="80">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.server.serverList.name')" path="name" class="pr-24px">
              <NInput v-model:value="model.name" :placeholder="$t('page.server.form.name.required')" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.server.serverList.ip')" path="ip" class="pr-24px">
              <NInput
                v-model:value="model.ip"
                :placeholder="$t('page.server.serverList.searchPlaceholder')"
                clearable
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.server.serverList.os')" path="os" class="pr-24px">
              <NSelect v-model:value="model.os" :options="OS_OPTIONS" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.server.serverList.status')" path="status" class="pr-24px">
              <NSelect
                v-model:value="model.status"
                :options="STATUS_OPTIONS"
                clearable
                :placeholder="$t('page.server.serverList.status')"
              />
            </NFormItemGi>
            <NFormItemGi span="24" class="pr-24px">
              <NSpace class="w-full" justify="end">
                <NButton @click="reset">
                  <template #icon>
                    <icon-ic-round-refresh class="text-icon" />
                  </template>
                  {{ $t('common.reset') }}
                </NButton>
                <NButton type="primary" ghost @click="search">
                  <template #icon>
                    <icon-ic-round-search class="text-icon" />
                  </template>
                  {{ $t('common.search') }}
                </NButton>
              </NSpace>
            </NFormItemGi>
          </NGrid>
        </NForm>
      </NCollapseItem>
    </NCollapse>
  </NCard>
</template>

<style scoped></style>
