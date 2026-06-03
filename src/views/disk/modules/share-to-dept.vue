<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { $t } from '@/locales';
import { useLoading } from '@sa/hooks';
import {
  fetchCreateInternalShare,
  fetchGetFileShareTargets,
  fetchUpdateTargetPermissions,
  fetchRemoveShareTarget
} from '@/service/api/disk/internal-share';
import SharePermissionChecker from './share-permission-checker.vue';
import ShareTargetItem from './share-target-item.vue';
import DeptTree from '@/components/custom/dept-tree.vue';

defineOptions({
  name: 'ShareToDept'
});

interface Props {
  fileId: number;
}

const props = defineProps<Props>();

const { loading, startLoading, endLoading } = useLoading();
const selectedPermissions = ref<string[]>(['DOWNLOAD']);
const selectedDeptIds = ref<number[]>([]);
const existingTargets = ref<Api.Disk.FileShareTargetItem[]>([]);
const deptOptions = ref<any[]>([]);

async function loadExistingTargets() {
  const { data } = await fetchGetFileShareTargets(props.fileId);
  if (data) {
    existingTargets.value = data.filter(t => t.targetType === 'dept');
  }
}

async function handleConfirmShare() {
  if (selectedDeptIds.value.length === 0) {
    window.$message?.warning($t('page.disk.share.selectDept'));
    return;
  }

  startLoading();
  const targets = selectedDeptIds.value.map(deptId => ({
    targetId: deptId,
    permissions: selectedPermissions.value
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

async function handleUpdateTargetPermissions(targetId: number, permissions: string[]) {
  startLoading();
  const { error } = await fetchUpdateTargetPermissions(targetId, permissions);
  endLoading();
  if (!error) {
    window.$message?.success($t('page.disk.share.updateSuccess'));
    await loadExistingTargets();
  }
}

async function handleRemoveTarget(targetId: number) {
  startLoading();
  const { error } = await fetchRemoveShareTarget(targetId);
  endLoading();
  if (!error) {
    window.$message?.success($t('page.disk.myShare.cancelSuccess'));
    await loadExistingTargets();
  }
}

onMounted(() => {
  loadExistingTargets();
});
</script>

<template>
  <div class="flex flex-col gap-16px">
    <div v-if="existingTargets.length > 0" class="flex flex-col gap-8px">
      <div class="text-12px opacity-50">{{ $t('page.disk.share.sharedDepts') }}</div>
      <ShareTargetItem
        v-for="target in existingTargets"
        :key="target.targetId"
        :target-id="target.targetId"
        :target-name="target.targetName"
        target-type="dept"
        :permissions="target.permissions"
        @update="handleUpdateTargetPermissions"
        @remove="handleRemoveTarget"
      />
    </div>

    <div class="flex flex-col gap-12px p-12px rounded bg-gray-50 dark:bg-gray-800">
      <div class="text-13px opacity-70 mb-8px">{{ $t('page.disk.share.selectDept') }}</div>

      <DeptTree v-model:value="selectedDeptIds" v-model:options="deptOptions" :immediate="true" />

      <div>
        <div class="text-12px opacity-70 mb-8px">{{ $t('page.disk.share.permissions') }}</div>
        <SharePermissionChecker
          v-model:permissions="selectedPermissions"
        />
      </div>

      <NButton
        type="primary"
        :disabled="selectedDeptIds.length === 0"
        :loading="loading"
        @click="handleConfirmShare"
      >
        {{ $t('page.disk.share.shareToDept') }}
      </NButton>
    </div>
  </div>
</template>
