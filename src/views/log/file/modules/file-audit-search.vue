<script setup lang="ts">
import { ref, toRaw } from 'vue';
import { jsonClone } from '@sa/utils';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'FileAuditSearch'
});

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Disk.FileAuditSearchParams>('model', { required: true });

const defaultModel = jsonClone(toRaw(model.value));

const dateRangeCreatedAt = ref<[string, string] | null>(null);

/** 操作类型选项 */
const operationTypeOptions = [
  { label: $t('page.system.fileLog.operationTypeOptions.upload'), value: 'upload' },
  { label: $t('page.system.fileLog.operationTypeOptions.download'), value: 'download' },
  { label: $t('page.system.fileLog.operationTypeOptions.preview'), value: 'preview' },
  { label: $t('page.system.fileLog.operationTypeOptions.createFolder'), value: 'create_folder' },
  { label: $t('page.system.fileLog.operationTypeOptions.delete'), value: 'delete' },
  { label: $t('page.system.fileLog.operationTypeOptions.restore'), value: 'restore' },
  { label: $t('page.system.fileLog.operationTypeOptions.purge'), value: 'purge' },
  { label: $t('page.system.fileLog.operationTypeOptions.rename'), value: 'rename' },
  { label: $t('page.system.fileLog.operationTypeOptions.move'), value: 'move' },
  { label: $t('page.system.fileLog.operationTypeOptions.copy'), value: 'copy' },
  { label: $t('page.system.fileLog.operationTypeOptions.shareCreate'), value: 'share_create' },
  { label: $t('page.system.fileLog.operationTypeOptions.shareRevoke'), value: 'share_revoke' },
  { label: $t('page.system.fileLog.operationTypeOptions.favorite'), value: 'favorite' },
  { label: $t('page.system.fileLog.operationTypeOptions.unfavorite'), value: 'unfavorite' },
  { label: $t('page.system.fileLog.operationTypeOptions.permission'), value: 'permission' }
];

/** 状态选项 */
const statusOptions = [
  { label: $t('page.system.fileLog.statusOptions.success'), value: 'success' },
  { label: $t('page.system.fileLog.statusOptions.failed'), value: 'failed' },
  { label: $t('page.system.fileLog.statusOptions.partial'), value: 'partial' }
];

/** 来源选项 */
const sourceOptions = [
  { label: $t('page.system.fileLog.sourceOptions.web'), value: 'web' },
  { label: $t('page.system.fileLog.sourceOptions.shareLink'), value: 'share_link' },
  { label: $t('page.system.fileLog.sourceOptions.system'), value: 'system' }
];

function onDateRangeCreatedAtUpdate(value: [string, string] | null) {
  if (value && value.length === 2) {
    [model.value.beginTime, model.value.endTime] = value;
  } else {
    model.value.beginTime = undefined;
    model.value.endTime = undefined;
  }
}

function resetModel() {
  dateRangeCreatedAt.value = null;
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
      <NCollapseItem :title="$t('common.search')" name="file-audit-search">
        <NForm ref="formRef" :model="model" label-placement="left" :label-width="80">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.system.fileLog.operName')" path="operName" class="pr-24px">
              <NInput v-model:value="model.operName" :placeholder="$t('common.pleaseInput')" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.system.fileLog.operationType')" path="operationType" class="pr-24px">
              <NSelect
                v-model:value="model.operationType"
                :options="operationTypeOptions"
                :placeholder="$t('common.pleaseSelect')"
                clearable
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.system.fileLog.fileName')" path="fileName" class="pr-24px">
              <NInput v-model:value="model.fileName" :placeholder="$t('common.pleaseInput')" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.system.fileLog.status')" path="status" class="pr-24px">
              <NSelect v-model:value="model.status" :options="statusOptions" :placeholder="$t('common.pleaseSelect')" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.system.fileLog.source')" path="source" class="pr-24px">
              <NSelect v-model:value="model.source" :options="sourceOptions" :placeholder="$t('common.pleaseSelect')" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.system.fileLog.createdAt')" path="createdAt" class="pr-24px">
              <NDatePicker
                v-model:formatted-value="dateRangeCreatedAt"
                update-value-on-close
                class="w-full"
                type="daterange"
                value-format="yyyy-MM-dd"
                clearable
                @update:formatted-value="onDateRangeCreatedAtUpdate"
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
