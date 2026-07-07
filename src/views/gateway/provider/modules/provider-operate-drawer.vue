<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { jsonClone } from '@sa/utils';
import { fetchCreateProvider, fetchUpdateProvider } from '@/service/api/gateway';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'ProviderOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: NaiveUI.TableOperateType;
  /** the edit row data */
  rowData?: Api.Gateway.Provider | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const { formRef, validate, restoreValidation } = useNaiveForm();
const { createRequiredRule } = useFormRules();

const title = computed(() => {
  const titles: Record<NaiveUI.TableOperateType, string> = {
    add: $t('page.gateway.provider.addProvider'),
    edit: $t('page.gateway.provider.editProvider')
  };
  return titles[props.operateType];
});

const billingTypeOptions = [
  { label: $t('page.gateway.provider.billingTypeOptions.token'), value: 'token' },
  { label: $t('page.gateway.provider.billingTypeOptions.per_call'), value: 'per_call' },
  { label: $t('page.gateway.provider.billingTypeOptions.monthly_quota'), value: 'monthly_quota' }
];

type Model = Api.Gateway.ProviderOperateParams;

const model = ref<Model>(createDefaultModel());

// config 以 JSON 文本编辑，独立于 model.config，提交时解析回对象
const configText = ref('{}');

function createDefaultModel(): Model {
  return {
    name: '',
    providerType: '',
    billingType: 'token',
    monthlyBudget: '',
    isActive: true,
    description: '',
    config: {}
  };
}

type RuleKey = Extract<keyof Model, 'name' | 'providerType'>;

const rules: Record<RuleKey, App.Global.FormRule> = {
  name: createRequiredRule($t('page.gateway.provider.form.name.required')),
  providerType: createRequiredRule($t('page.gateway.provider.form.type.required'))
};

function handleUpdateModelWhenEdit() {
  model.value = createDefaultModel();
  configText.value = '{}';

  if (props.operateType === 'edit' && props.rowData) {
    Object.assign(model.value, jsonClone(props.rowData));
    model.value.monthlyBudget = props.rowData.monthlyBudget || '';
    model.value.billingType = props.rowData.billingType || 'token';
    model.value.isActive = props.rowData.isActive;
    configText.value = JSON.stringify(props.rowData.config || {}, null, 2);
  }
}

function closeDrawer() {
  visible.value = false;
}

// 解析 config 文本为对象；空文本视为 {}，非法 JSON 或非对象时返回 null 表示拒绝提交
function parseConfigText(): Record<string, unknown> | null {
  const text = configText.value.trim();
  if (!text) {
    return {};
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    window.$message?.error('config 必须是 JSON 对象');
    return null;
  } catch {
    window.$message?.error('config JSON 格式错误');
    return null;
  }
}

async function handleSubmit() {
  await validate();

  const parsedConfig = parseConfigText();
  if (parsedConfig === null) return;

  const payload: Api.Gateway.ProviderOperateParams = {
    name: model.value.name,
    providerType: model.value.providerType,
    billingType: model.value.billingType,
    monthlyBudget: model.value.monthlyBudget || null,
    isActive: model.value.isActive,
    description: model.value.description,
    config: parsedConfig
  };

  if (props.operateType === 'add') {
    const { error } = await fetchCreateProvider(payload);
    if (error) return;
    window.$message?.success($t('common.addSuccess'));
  } else {
    const { error } = await fetchUpdateProvider({ ...payload, id: model.value.id });
    if (error) return;
    window.$message?.success($t('common.updateSuccess'));
  }

  closeDrawer();
  emit('submitted');
}

watch(visible, () => {
  if (visible.value) {
    handleUpdateModelWhenEdit();
    restoreValidation();
  }
});
</script>

<template>
  <NDrawer v-model:show="visible" :title="title" display-directive="show" :width="800" class="max-w-90%">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="90">
        <NFormItem :label="$t('page.gateway.provider.name')" path="name">
          <NInput v-model:value="model.name" :placeholder="$t('page.gateway.provider.form.name.placeholder')" />
        </NFormItem>
        <NFormItem :label="$t('page.gateway.provider.type')" path="providerType">
          <NInput v-model:value="model.providerType" :placeholder="$t('page.gateway.provider.form.type.placeholder')" />
        </NFormItem>
        <NFormItem :label="$t('page.gateway.provider.billingType')" path="billingType">
          <NSelect v-model:value="model.billingType" :options="billingTypeOptions" :placeholder="$t('page.gateway.provider.form.billingType.placeholder')" />
        </NFormItem>
        <NFormItem :label="$t('page.gateway.provider.monthlyBudget')" path="monthlyBudget">
          <NInput v-model:value="model.monthlyBudget" :placeholder="$t('page.gateway.provider.form.monthlyBudget.placeholder')" />
        </NFormItem>
        <NFormItem :label="$t('page.gateway.provider.isActive')" path="isActive">
          <NSwitch v-model:value="model.isActive" />
        </NFormItem>
        <NFormItem :label="$t('page.gateway.provider.description')" path="description">
          <NInput v-model:value="model.description" type="textarea" :rows="2" :placeholder="$t('page.gateway.provider.form.description.placeholder')" />
        </NFormItem>
        <NFormItem :label="$t('page.gateway.provider.config')" path="config">
          <NInput v-model:value="configText" type="textarea" :rows="4" :placeholder="$t('page.gateway.provider.form.config.placeholder')" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace :size="16">
          <NButton @click="closeDrawer">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" @click="handleSubmit">{{ $t('common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
