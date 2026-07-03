<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useFormRules } from '@/hooks/common/form';
import { useNaiveForm } from '@/hooks/common/form';
import { fetchCreateGroup, fetchRenameGroup } from '@/service/api/server/server';
import { $t } from '@/locales';

defineOptions({ name: 'ServerGroupOperateModal' });

interface Props {
  operateType: 'create' | 'rename';
  rowData?: Api.Server.ServerGroup | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });

const { formRef, validate, restoreValidation } = useNaiveForm();
const { createRequiredRule } = useFormRules();

const model = ref<{ name: string }>({ name: '' });

const title = computed(() =>
  props.operateType === 'create' ? $t('page.server.group.create') : $t('page.server.group.rename')
);

const rules = {
  name: [
    createRequiredRule($t('page.server.group.nameRequired')),
    {
      validator: (_rule: unknown, value: string) => {
        if (value.length > 50) {
          return new Error($t('page.server.group.nameMaxLength'));
        }
        return true;
      },
      trigger: ['input', 'blur']
    }
  ]
};

function resetModel() {
  model.value = { name: props.operateType === 'rename' ? props.rowData?.name ?? '' : '' };
}

watch(visible, val => {
  if (val) {
    resetModel();
    restoreValidation();
  }
});

async function handleSubmit() {
  await validate();
  const { name } = model.value;
  if (props.operateType === 'create' && props.rowData) {
    const { error } = await fetchCreateGroup({ parentId: props.rowData.id, name });
    if (error) {
      window.$message?.error(error.message);
      return;
    }
    window.$message?.success($t('page.server.group.createSuccess'));
  } else if (props.operateType === 'rename' && props.rowData) {
    const { error } = await fetchRenameGroup({ id: props.rowData.id, name });
    if (error) {
      window.$message?.error(error.message);
      return;
    }
    window.$message?.success($t('page.server.group.renameSuccess'));
  }
  visible.value = false;
  emit('submitted');
}
</script>

<template>
  <NModal
    v-model:show="visible"
    preset="card"
    :title="title"
    :style="{ width: '420px' }"
    @close="() => (visible = false)"
  >
    <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="80">
      <NFormItem :label="$t('page.server.group.title')" path="name">
        <NInput v-model:value="model.name" :placeholder="$t('page.server.group.nameRequired')" />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="visible = false">{{ $t('common.cancel') }}</NButton>
        <NButton type="primary" @click="handleSubmit">{{ $t('common.confirm') }}</NButton>
      </NSpace>
    </template>
  </NModal>
</template>