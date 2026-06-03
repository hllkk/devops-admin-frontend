<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { $t } from '@/locales';
import { useLoading } from '@sa/hooks';
import {
  fetchCreateInternalShare,
  fetchGetFileShareTargets,
  fetchUpdateTargetPermissions,
  fetchRemoveShareTarget
} from '@/service/api/disk/internal-share';
import { fetchGetDeptSelect } from '@/service/api/system/dept';
import ShareTargetItem from './share-target-item.vue';

defineOptions({
  name: 'ShareToDept'
});

interface Props {
  fileId: number;
}

const props = defineProps<Props>();

const { startLoading, endLoading } = useLoading();

const selectedDeptIds = ref<number[]>([]);
const selectedPermissions = ref<string[]>(['DOWNLOAD']);
const existingTargets = ref<Api.Disk.FileShareTargetItem[]>([]);
const deptTreeOptions = ref<any[]>([]);
const deptLoading = ref(false);

const permissionOptions = computed(() => [
  { label: $t('page.disk.sharedWithMe.permDownload'), value: 'DOWNLOAD' },
  { label: $t('page.disk.sharedWithMe.permUpload'), value: 'UPLOAD' },
  { label: $t('page.disk.sharedWithMe.permEdit'), value: 'PUT' },
  { label: $t('page.disk.sharedWithMe.permDelete'), value: 'DELETE' }
]);

const canSubmit = computed(() => selectedDeptIds.value.length > 0 && selectedPermissions.value.length > 0);

async function loadExistingTargets() {
  const { data } = await fetchGetFileShareTargets(props.fileId);
  if (data) {
    existingTargets.value = data.filter(t => t.targetType === 'dept');
  }
}

async function loadDeptOptions() {
  if (deptTreeOptions.value.length > 0) return;
  deptLoading.value = true;
  const { data } = await fetchGetDeptSelect();
  if (data) {
    deptTreeOptions.value = data as any[];
  }
  deptLoading.value = false;
}

async function handleSubmit() {
  if (!canSubmit.value) return;

  startLoading();
  const targets = selectedDeptIds.value.map(id => ({
    targetId: id,
    permissions: [...selectedPermissions.value]
  }));

  const { error } = await fetchCreateInternalShare({
    fileId: props.fileId,
    shareType: 'dept',
    targets
  });

  endLoading();
  if (!error) {
    window.$message?.success($t('page.disk.share.shareSuccess'));
    selectedDeptIds.value = [];
    await loadExistingTargets();
  }
}

async function handleUpdateTargetPermissions(id: number, permissions: string[]) {
  startLoading();
  const { error } = await fetchUpdateTargetPermissions(id, permissions);
  endLoading();
  if (!error) {
    window.$message?.success($t('page.disk.share.updateSuccess'));
    await loadExistingTargets();
  }
}

async function handleRemoveTarget(id: number) {
  const idx = existingTargets.value.findIndex(t => t.id === id);
  if (idx < 0) return;
  const removed = existingTargets.value.splice(idx, 1)[0];
  startLoading();
  const { error } = await fetchRemoveShareTarget(id);
  endLoading();
  if (error) {
    existingTargets.value.splice(idx, 0, removed);
  } else {
    window.$message?.success($t('page.disk.myShare.cancelSuccess'));
  }
}

onMounted(() => {
  loadExistingTargets();
});
</script>

<template>
  <div class="flex flex-col gap-16px">
    <div class="flex items-center gap-8px">
      <NTreeSelect
        v-model:value="selectedDeptIds"
        multiple
        filterable
        key-field="id"
        label-field="label"
        :placeholder="$t('page.disk.share.selectDept')"
        :options="deptTreeOptions"
        :loading="deptLoading"
        class="flex-1"
        @focus="loadDeptOptions"
      />
      <NSelect
        v-model:value="selectedPermissions"
        multiple
        :options="permissionOptions"
        :placeholder="$t('page.disk.share.permissions')"
        class="w-200px"
      />
      <NButton
        type="primary"
        :disabled="!canSubmit"
        @click="handleSubmit"
      >
        {{ $t('common.confirm') }}
      </NButton>
    </div>

    <div v-if="existingTargets.length > 0" class="flex flex-col gap-8px">
      <div class="text-12px opacity-50">{{ $t('page.disk.share.sharedDepts') }}</div>
      <ShareTargetItem
        v-for="target in existingTargets"
        :id="target.id"
        :key="target.id"
        :target-id="target.targetId"
        :target-name="target.targetName"
        target-type="dept"
        :permissions="target.permissions"
        @update="handleUpdateTargetPermissions"
        @remove="handleRemoveTarget"
      />
    </div>
    <div v-else class="py-24px text-center text-13px opacity-40">
      {{ $t('page.disk.share.noSharedDepts') }}
    </div>
  </div>
</template>
