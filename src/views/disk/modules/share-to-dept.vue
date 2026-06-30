<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { $t } from '@/locales';
import { useLoading } from '@sa/hooks';
import type { TreeSelectOption } from 'naive-ui';
import {
  fetchCreateInternalShare,
  fetchGetFileShareTargets,
  fetchUpdateShareRole,
  fetchRemoveShareTarget
} from '@/service/api/disk/internal-share';
import { fetchGetDeptSelect } from '@/service/api/system/dept';
import ShareTargetItem from './share-target-item.vue';
import SharePermissionChecker from './share-permission-checker.vue';

defineOptions({
  name: 'ShareToDept'
});

interface Props {
  fileId: number;
}

const props = defineProps<Props>();

const { startLoading, endLoading } = useLoading();

const selectedDeptIds = ref<number[]>([]);
const selectedRole = ref<Api.Disk.ShareRole>('viewer');
const existingTargets = ref<Api.Disk.FileShareTargetItem[]>([]);
const deptTreeOptions = ref<TreeSelectOption[]>([]);
const deptLoading = ref(false);

const canSubmit = computed(() => selectedDeptIds.value.length > 0);

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
    deptTreeOptions.value = data as TreeSelectOption[];
  }
  deptLoading.value = false;
}

async function handleSubmit() {
  if (!canSubmit.value) return;

  startLoading();
  const targets = selectedDeptIds.value.map(id => ({ targetId: id }));

  const { error } = await fetchCreateInternalShare({
    fileId: props.fileId,
    shareType: 'dept',
    targets,
    role: selectedRole.value
  });

  endLoading();
  if (!error) {
    window.$message?.success($t('page.disk.share.shareSuccess'));
    selectedDeptIds.value = [];
    await loadExistingTargets();
  }
}

async function handleUpdateTargetRole(id: number, role: Api.Disk.ShareRole) {
  startLoading();
  const { error } = await fetchUpdateShareRole(id, role);
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
    <div class="flex flex-col gap-8px">
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
        <NButton
          type="primary"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ $t('common.confirm') }}
        </NButton>
      </div>
      <SharePermissionChecker v-model:role="selectedRole" />
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
        :role="target.role"
        @update="handleUpdateTargetRole"
        @remove="handleRemoveTarget"
      />
    </div>
    <div v-else class="py-24px text-center text-13px opacity-40">
      {{ $t('page.disk.share.noSharedDepts') }}
    </div>
  </div>
</template>
