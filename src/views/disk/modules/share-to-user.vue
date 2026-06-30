<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { $t } from '@/locales';
import { useLoading } from '@sa/hooks';
import {
  fetchCreateInternalShare,
  fetchGetFileShareTargets,
  fetchUpdateShareRole,
  fetchRemoveShareTarget
} from '@/service/api/disk/internal-share';
import { fetchGetUserSelect } from '@/service/api/system/user';
import ShareTargetItem from './share-target-item.vue';
import SharePermissionChecker from './share-permission-checker.vue';

defineOptions({
  name: 'ShareToUser'
});

interface Props {
  fileId: number;
}

const props = defineProps<Props>();

interface UserOption {
  label: string;
  value: number;
  avatar?: string;
}

const { startLoading, endLoading } = useLoading();

const selectedUserIds = ref<number[]>([]);
const selectedRole = ref<Api.Disk.ShareRole>('viewer');
const existingTargets = ref<Api.Disk.FileShareTargetItem[]>([]);
const userOptions = ref<UserOption[]>([]);
const userLoading = ref(false);

const existingTargetIds = computed(() => new Set(existingTargets.value.map(t => t.targetId)));

const availableUserOptions = computed(() =>
  userOptions.value.filter(u => !existingTargetIds.value.has(u.value))
);

const canSubmit = computed(() => selectedUserIds.value.length > 0);

async function loadExistingTargets() {
  const { data } = await fetchGetFileShareTargets(props.fileId);
  if (data) {
    existingTargets.value = data.filter(t => t.targetType === 'user');
  }
}

async function loadUserOptions() {
  if (userOptions.value.length > 0) return;
  userLoading.value = true;
  const { data } = await fetchGetUserSelect();
  if (data) {
    userOptions.value = data.map(u => ({
      label: u.nickName ? `${u.nickName}（${u.userName}）` : u.userName,
      value: u.userId as number,
      avatar: u.avatar
    }));
  }
  userLoading.value = false;
}

async function handleSearch(query: string) {
  if (query.trim()) {
    await loadUserOptions();
  }
}

async function handleSubmit() {
  if (!canSubmit.value) return;

  startLoading();
  const targets = selectedUserIds.value.map(id => ({ targetId: id }));

  const { error } = await fetchCreateInternalShare({
    fileId: props.fileId,
    shareType: 'user',
    targets,
    role: selectedRole.value
  });

  endLoading();
  if (!error) {
    window.$message?.success($t('page.disk.share.shareSuccess'));
    selectedUserIds.value = [];
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
  startLoading();
  const { error } = await fetchRemoveShareTarget(id);
  endLoading();
  if (!error) {
    existingTargets.value = existingTargets.value.filter(t => t.id !== id);
    window.$message?.success($t('page.disk.myShare.cancelSuccess'));
  }
}

function getUserAvatar(userId: number) {
  const user = userOptions.value.find(u => u.value === userId);
  return user?.avatar;
}

onMounted(() => {
  loadExistingTargets();
});
</script>

<template>
  <div class="flex flex-col gap-16px">
    <div class="flex flex-col gap-8px">
      <div class="flex items-center gap-8px">
        <NSelect
          v-model:value="selectedUserIds"
          multiple
          filterable
          :placeholder="$t('page.disk.share.searchUser')"
          :options="availableUserOptions"
          :loading="userLoading"
          class="flex-1"
          @focus="loadUserOptions"
          @search="handleSearch"
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
      <div class="text-12px opacity-50">{{ $t('page.disk.share.sharedUsers') }}</div>
      <div class="flex flex-col gap-8px max-h-240px overflow-y-auto">
        <ShareTargetItem
          v-for="target in existingTargets"
          :id="target.id"
          :key="target.id"
          :target-id="target.targetId"
          :target-name="target.targetName"
          target-type="user"
          :role="target.role"
          :avatar="getUserAvatar(target.targetId)"
          @update="handleUpdateTargetRole"
          @remove="handleRemoveTarget"
        />
      </div>
    </div>
    <div v-else class="py-24px text-center text-13px opacity-40">
      {{ $t('page.disk.share.noSharedUsers') }}
    </div>
  </div>
</template>
