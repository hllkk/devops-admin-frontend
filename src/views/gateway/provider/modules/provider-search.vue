<script setup lang="ts">
import { computed, toRaw } from 'vue';
import { jsonClone } from '@sa/utils';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'ProviderSearch'
});

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Gateway.ProviderSearchParams>('model', { required: true });

const isActiveOptions = [
  { label: $t('page.gateway.provider.isActiveOptions.enabled'), value: 'true' },
  { label: $t('page.gateway.provider.isActiveOptions.disabled'), value: 'false' }
];

// NSelect value 不接受 boolean，用字符串中介与 model.isActive(boolean|null) 双向转换
const isActiveSelect = computed<string | null>({
  get: () => {
    if (model.value.isActive === null || model.value.isActive === undefined) return null;
    return model.value.isActive ? 'true' : 'false';
  },
  set: val => {
    model.value.isActive = val === null ? null : val === 'true';
  }
});

const defaultModel = jsonClone(toRaw(model.value));

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
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse>
      <NCollapseItem :title="$t('common.search')" name="provider-search">
        <NForm ref="formRef" :model="model" label-placement="left" :label-width="90">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.gateway.provider.name')" path="name" class="pr-24px">
              <NInput v-model:value="model.name" :placeholder="$t('page.gateway.provider.form.name.placeholder')" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.gateway.provider.type')" path="providerType" class="pr-24px">
              <NInput v-model:value="model.providerType" :placeholder="$t('page.gateway.provider.form.type.placeholder')" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.gateway.provider.status')" path="isActive" class="pr-24px">
              <NSelect v-model:value="isActiveSelect" :placeholder="$t('common.pleaseSelect')" :options="isActiveOptions" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" class="pr-24px">
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
