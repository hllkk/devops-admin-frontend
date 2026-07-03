<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { UploadFileInfo } from 'naive-ui';
import * as XLSX from 'xlsx';
import { fetchBatchImportServers } from '@/service/api/server/server';
import { $t } from '@/locales';

defineOptions({ name: 'ServerImportModal' });

interface Props {
  defaultGroupId: CommonType.IdType;
  groupOptions: { id: CommonType.IdType; name: string }[];
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });

const groupId = ref<CommonType.IdType | null>(null);
const fileList = ref<UploadFileInfo[]>([]);
const items = ref<Api.Server.ServerImportItem[]>([]);
const submitting = ref(false);

const REG_IP = /^((25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(25[0-5]|2[0-4]\d|[01]?\d?\d)$/;

const COLUMN_KEYS: Record<string, { key: 'name' | 'ip' | 'os' | 'hostname' | 'location' | 'status'; label: string }> = {
  名称: { key: 'name', label: '名称' },
  name: { key: 'name', label: '名称' },
  IP: { key: 'ip', label: 'IP' },
  ip: { key: 'ip', label: 'IP' },
  操作系统: { key: 'os', label: '操作系统' },
  os: { key: 'os', label: '操作系统' },
  主机名: { key: 'hostname', label: '主机名' },
  hostname: { key: 'hostname', label: '主机名' },
  位置: { key: 'location', label: '位置' },
  location: { key: 'location', label: '位置' },
  状态: { key: 'status', label: '状态' },
  status: { key: 'status', label: '状态' }
};

watch(visible, val => {
  if (val) {
    groupId.value = props.defaultGroupId;
    items.value = [];
    fileList.value = [];
  }
});

const validCount = computed(() => items.value.filter(i => i.valid).length);
const invalidCount = computed(() => items.value.filter(i => !i.valid).length);

async function handleFileChange(options: { fileList: UploadFileInfo[] }) {
  fileList.value = options.fileList;
  const file = options.fileList[0]?.file;
  if (!file) {
    items.value = [];
    return;
  }
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

  items.value = rows.map(row => validateRow(row));
}

function validateRow(row: Record<string, string>): Api.Server.ServerImportItem {
  const mapped: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(row)) {
    const def = COLUMN_KEYS[rawKey] ?? COLUMN_KEYS[rawKey.toLowerCase()];
    if (def) mapped[def.key] = String(rawValue ?? '').trim();
  }

  const name = mapped.name ?? '';
  const ip = mapped.ip ?? '';
  const os = mapped.os ?? '';
  const hostname = mapped.hostname ?? '';
  const location = mapped.location ?? '';

  const errors: string[] = [];
  if (!name) errors.push($t('page.server.import.validate.nameRequired'));
  if (!ip) errors.push($t('page.server.import.validate.ipRequired'));
  else if (!REG_IP.test(ip)) errors.push($t('page.server.import.validate.ipInvalid'));
  if (!os) errors.push($t('page.server.import.validate.osRequired'));

  return {
    name,
    ip,
    os,
    hostname: hostname || undefined,
    location: location || undefined,
    valid: errors.length === 0,
    errorMessage: errors.join('; ')
  };
}

async function handleConfirm() {
  if (!groupId.value) {
    window.$message?.warning($t('page.server.form.groupId.required'));
    return;
  }
  if (validCount.value === 0) {
    window.$message?.warning($t('page.server.import.invalidRows', { count: invalidCount.value }));
    return;
  }
  submitting.value = true;
  const { data, error } = await fetchBatchImportServers({
    items: items.value,
    groupId: groupId.value
  });
  submitting.value = false;
  if (error) {
    window.$message?.error(error.message);
    return;
  }
  window.$message?.success(
    $t('page.server.import.successMessage', {
      success: data?.success ?? 0,
      failed: data?.failed ?? 0
    })
  );
  visible.value = false;
  emit('submitted');
}

const columns = [
  { title: $t('page.server.serverList.name'), key: 'name' },
  { title: $t('page.server.serverList.ip'), key: 'ip' },
  { title: $t('page.server.serverList.os'), key: 'os' },
  { title: $t('page.server.serverList.location'), key: 'location' },
  {
    title: $t('page.server.serverList.status'),
    key: 'valid',
    render: (row: Api.Server.ServerImportItem) => (row.valid ? '✓' : row.errorMessage)
  }
];

function rowClassName(row: Api.Server.ServerImportItem): string {
  return row.valid ? '' : 'invalid-row';
}
</script>

<template>
  <NModal
    v-model:show="visible"
    preset="card"
    :title="$t('page.server.import.title')"
    :style="{ width: '720px' }"
  >
    <NSpace vertical :size="12">
      <NFormItem :label="$t('page.server.import.defaultGroup')">
        <NSelect
          v-model:value="groupId"
          :options="groupOptions"
          label-field="name"
          value-field="id"
          :placeholder="$t('page.server.form.groupId.required')"
        />
      </NFormItem>
      <NUpload
        v-model:file-list="fileList"
        :max="1"
        accept=".xlsx"
        :show-file-list="true"
        @change="handleFileChange"
      >
        <NButton>{{ $t('page.server.import.upload') }}</NButton>
      </NUpload>
      <NText depth="3" class="text-12px">{{ $t('page.server.import.uploadTip') }}</NText>
      <NDataTable
        v-if="items.length > 0"
        :columns="columns"
        :data="items"
        :pagination="{ pageSize: 5 }"
        size="small"
        :row-class-name="rowClassName"
      />
      <NSpace v-if="items.length > 0">
        <NTag type="success">{{ $t('common.confirm') }}: {{ validCount }}</NTag>
        <NTag type="error">{{ $t('page.server.import.invalidRows', { count: invalidCount }) }}</NTag>
      </NSpace>
    </NSpace>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="visible = false">{{ $t('page.server.import.cancel') }}</NButton>
        <NButton type="primary" :loading="submitting" :disabled="validCount === 0" @click="handleConfirm">
          {{ $t('page.server.import.confirm') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.invalid-row {
  background: var(--n-color-error-td);
}
</style>
