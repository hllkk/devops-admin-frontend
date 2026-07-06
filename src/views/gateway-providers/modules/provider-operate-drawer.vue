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
    add: '新增供应商',
    edit: '编辑供应商'
  };
  return titles[props.operateType];
});

const billingTypeOptions = [
  { label: '按 Token', value: 'token' },
  { label: '按次计费', value: 'per_call' },
  { label: '月度配额', value: 'monthly_quota' }
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
  name: createRequiredRule('供应商名称不能为空'),
  providerType: createRequiredRule('供应商类型不能为空')
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
        <NFormItem label="供应商名称" path="name">
          <NInput v-model:value="model.name" placeholder="请输入供应商名称" />
        </NFormItem>
        <NFormItem label="供应商类型" path="providerType">
          <NInput v-model:value="model.providerType" placeholder="如 openai/claude/deepseek/azure/gemini" />
        </NFormItem>
        <NFormItem label="计费类型" path="billingType">
          <NSelect v-model:value="model.billingType" :options="billingTypeOptions" placeholder="请选择计费类型" />
        </NFormItem>
        <NFormItem label="月度预算" path="monthlyBudget">
          <NInput v-model:value="model.monthlyBudget" placeholder="请输入月度预算(如 1000.00)" />
        </NFormItem>
        <NFormItem label="是否启用" path="isActive">
          <NSwitch v-model:value="model.isActive" />
        </NFormItem>
        <NFormItem label="描述" path="description">
          <NInput v-model:value="model.description" type="textarea" :rows="2" placeholder="请输入描述" />
        </NFormItem>
        <NFormItem label="配置(JSON)" path="config">
          <NInput v-model:value="configText" type="textarea" :rows="4" placeholder="如 {&quot;region&quot;: &quot;us-east-1&quot;}" />
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
