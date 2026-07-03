<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { fetchAddServer, fetchUpdateServer } from '@/service/api/server/server';
import { $t } from '@/locales';

defineOptions({ name: 'ServerOperateDrawer' });

interface Props {
  operateType: NaiveUI.TableOperateType;
  rowData: Api.Server.Server | null;
  groupOptions: { id: CommonType.IdType; name: string }[];
  defaultGroupId?: CommonType.IdType;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });

const { formRef, validate, restoreValidation } = useNaiveForm();
const { createRequiredRule } = useFormRules();

const REG_IP = /^((25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(25[0-5]|2[0-4]\d|[01]?\d?\d)$/;

const OS_OPTIONS = [
  'Ubuntu 22.04',
  'Ubuntu 20.04',
  'CentOS 7',
  'CentOS 8',
  'Debian 12',
  'Debian 11',
  'Rocky 9',
  'Rocky 8',
  'Windows Server 2022',
  'Windows Server 2019'
].map(v => ({ label: v, value: v }));

interface ServerFormModel {
  name: string;
  ip: string;
  os: string;
  groupId: CommonType.IdType | null;
  hostname: string;
  location: string;
  uptimeSeconds: number;
  username: string;
  password: string;
}

function createDefaultModel(): ServerFormModel {
  return {
    name: '',
    ip: '',
    os: 'Ubuntu 22.04',
    groupId: null,
    hostname: '',
    location: '',
    uptimeSeconds: 0,
    username: '',
    password: ''
  };
}

const model = ref<ServerFormModel>(createDefaultModel());

const title = computed(() =>
  props.operateType === 'add' ? $t('common.add') : $t('page.server.serverList.edit')
);

function resetModel() {
  if (props.operateType === 'add') {
    model.value = {
      ...createDefaultModel(),
      groupId: props.defaultGroupId ?? null
    };
  } else {
    const row = props.rowData;
    model.value = {
      ...createDefaultModel(),
      name: row?.name ?? '',
      ip: row?.ip ?? '',
      os: row?.os ?? 'Ubuntu 22.04',
      groupId: row?.groupId ?? null,
      hostname: row?.hostname ?? '',
      location: row?.location ?? '',
      uptimeSeconds: row?.uptimeSeconds ?? 0
    };
  }
}

watch(visible, val => {
  if (val) {
    resetModel();
    restoreValidation();
  }
});

const rules = {
  name: [
    createRequiredRule($t('page.server.form.name.required')),
    { max: 50, message: $t('page.server.form.name.maxLength'), trigger: 'blur' }
  ],
  ip: [
    createRequiredRule($t('page.server.form.ip.required')),
    { pattern: REG_IP, message: $t('page.server.form.ip.invalid'), trigger: 'blur' }
  ],
  os: [createRequiredRule($t('page.server.form.os.required'))],
  groupId: [createRequiredRule($t('page.server.form.groupId.required'))],
  username: [createRequiredRule($t('page.server.form.username.required'))],
  password: [createRequiredRule($t('page.server.form.password.required'))]
};

async function handleSubmit() {
  await validate();
  const { name, ip, os, groupId, hostname, location, uptimeSeconds, username, password } = model.value;
  if (props.operateType === 'add') {
    const { error } = await fetchAddServer({
      name,
      ip,
      os,
      groupId: groupId!,
      hostname,
      location,
      uptimeSeconds,
      username,
      password
    });
    if (error) {
      window.$message?.error(error.message);
      return;
    }
    window.$message?.success($t('page.server.serverList.addSuccess'));
  } else {
    const { error } = await fetchUpdateServer({
      id: props.rowData!.id,
      name,
      ip,
      os,
      groupId: groupId!,
      hostname,
      location,
      uptimeSeconds
    });
    if (error) {
      window.$message?.error(error.message);
      return;
    }
    window.$message?.success($t('page.server.serverList.updateSuccess'));
  }
  visible.value = false;
  emit('submitted');
}
</script>

<template>
  <NDrawer v-model:show="visible" :width="500" placement="right">
    <NDrawerContent :title="title" closable>
      <NForm ref="formRef" :model="model" :rules="rules" label-placement="top">
        <NFormItem :label="$t('page.server.serverList.name')" path="name">
          <NInput v-model:value="model.name" :placeholder="$t('page.server.form.name.required')" />
        </NFormItem>
        <NFormItem :label="$t('page.server.serverList.ip')" path="ip">
          <NInput v-model:value="model.ip" :placeholder="$t('page.server.form.ip.required')" />
        </NFormItem>
        <NFormItem :label="$t('page.server.serverList.os')" path="os">
          <NAutoComplete
            v-model:value="model.os"
            :options="OS_OPTIONS"
            :placeholder="$t('page.server.form.os.required')"
          />
        </NFormItem>
        <NFormItem :label="$t('page.server.group.title')" path="groupId">
          <NSelect
            v-model:value="model.groupId"
            :options="groupOptions"
            label-field="name"
            value-field="id"
            :placeholder="$t('page.server.form.groupId.required')"
          />
        </NFormItem>
        <NFormItem v-if="operateType === 'add'" :label="$t('page.server.form.username.required')" path="username">
          <NInput v-model:value="model.username" :placeholder="$t('page.server.form.username.required')" />
        </NFormItem>
        <NFormItem v-if="operateType === 'add'" :label="$t('page.server.form.password.required')" path="password">
          <NInput
            v-model:value="model.password"
            type="password"
            show-password-on="click"
            :placeholder="$t('page.server.form.password.required')"
          />
        </NFormItem>
        <NFormItem :label="$t('page.server.serverList.location')" path="location">
          <NInput v-model:value="model.location" />
        </NFormItem>
        <NFormItem :label="$t('page.server.serverList.detail')" path="hostname">
          <NInput v-model:value="model.hostname" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="visible = false">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" @click="handleSubmit">{{ $t('common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
