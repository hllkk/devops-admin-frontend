<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { $t } from '@/locales';
import { useLoading } from '@sa/hooks';
import {
  fetchCreateInternalShare,
  fetchGetFileShareTargets,
  fetchUpdateTargetPermissions,
  fetchRemoveShareTarget
} from '@/service/api/disk/internal-share';
import { fetchGetUserSelect } from '@/service/api/system/user';
import ShareUserSearch from './share-user-search.vue';
import SharePermissionChecker from './share-permission-checker.vue';
import ShareTargetItem from './share-target-item.vue';

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

const { loading, startLoading, endLoading } = useLoading();
const selectedPermissions = ref<string[]>(['DOWNLOAD']);
const existingTargets = ref<Api.Disk.FileShareTargetItem[]>([]);
const userOptions = ref<UserOption[]>([]);
const showUserSearch = ref(false);

const permLabelMap: Record<string, string> = {
  DOWNLOAD: $t('page.disk.sharedWithMe.permDownload'),
  UPLOAD: $t('page.disk.sharedWithMe.permUpload'),
  PUT: $t('page.disk.sharedWithMe.permEdit'),
  DELETE: $t('page.disk.sharedWithMe.permDelete')
};

const permissionOptions = computed(() => [
  { label: permLabelMap.DOWNLOAD, value: 'DOWNLOAD' },
  { label: permLabelMap.UPLOAD, value: 'UPLOAD' },
  { label: permLabelMap.PUT, value: 'PUT' },
  { label: permLabelMap.DELETE, value: 'DELETE' }
]);

async function loadExistingTargets() {
  const { data } = await fetchGetFileShareTargets(props.fileId);
  if (data) {
    existingTargets.value = data.filter(t => t.targetType === 'user');
  }
}

async function loadUserOptions() {
  if (userOptions.value.length > 0) return;
  const { data } = await fetchGetUserSelect();
  if (data) {
    userOptions.value = data.map(u => ({
      label: u.nickName ? `${u.nickName}（${u.userName}）` : u.userName,
      value: u.userId as number,
      avatar: u.avatar
    }));
  }
}

async function handleUserSelect(users: UserOption[]) {
  if (users.length === 0) return;

  startLoading();
  const targets = users.map(u => ({
    targetId: u.value,
    permissions: selectedPermissions.value
  }));

  const { error } = await fetchCreateInternalShare({
    fileId: props.fileId,
    shareType: 'user',
    targets
  });

  endLoading();
  if (!error) {
    window.$message?.success($t('page.disk.share.shareSuccess'));
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

function getUserAvatar(userId: number) {
  const user = userOptions.value.find(u => u.value === userId);
  return user?.avatar;
}

function getUserName(userId: number) {
  const user = userOptions.value.find(u => u.value === userId);
  return user?.label || String(userId);
}

onMounted(() => {
  loadExistingTargets();
  loadUserOptions();
});
</script>

<template>
  <div class="flex flex-col gap-16px">
    <div v-if="existingTargets.length > 0" class="flex flex-col gap-8px">
      <div class="text-12px opacity-50">{{ $t('page.disk.share.sharedUsers') }}</div>
      <ShareTargetItem
        v-for="target in existingTargets"
        :key="target.targetId"
        :target-id="target.targetId"
        :target-name="target.targetName"
        target-type="user"
        :permissions="target.permissions"
        :avatar="getUserAvatar(target.targetId)"
        @update="handleUpdateTargetPermissions"
        @remove="handleRemoveTarget"
      />
    </div>

    <div class="flex flex-col gap-12px p-12px rounded bg-gray-50 dark:bg-gray-800">
      <div class="text-13px opacity-70 mb-8px">{{ $t('page.disk.share.addUser') }}</div>

      <div>
        <div class="text-12px opacity-70 mb-8px">{{ $t('page.disk.share.permissions') }}</div>
        <SharePermissionChecker
          v-model:permissions="selectedPermissions"
        />
      </div>

      <NButton @click="showUserSearch = !showUserSearch">
        {{ showUserSearch ? $t('common.cancel') : $t('page.disk.share.selectUser') }}
      </NButton>

      <ShareUserSearch
        v-if="showUserSearch"
        @select="handleUserSelect"
      />
    </div>
  </div>
</template>
