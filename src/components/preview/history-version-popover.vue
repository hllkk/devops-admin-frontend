<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue';
import { useDialog } from 'naive-ui';
import { storeToRefs } from 'pinia';
import {
  fetchHistoryList,
  fetchHistoryContent,
  fetchDeleteHistory
} from '@/service/api/disk/editor';
import { fetchGetUserInfo } from '@/service/api/system/user';
import { useAuthStore } from '@/store/modules/auth';
import { formatFileSize } from '@/utils/format';

defineOptions({
  name: 'HistoryVersionPopover'
});

interface HistoryVersion {
  id: CommonType.IdType;
  fileId: CommonType.IdType;
  fileName: string;
  size: number;
  operator: string;
  createTime: string;
}

interface UserInfoMap {
  nickName: string;
  avatar: string;
}

const props = defineProps<{
  fileId?: CommonType.IdType;
  activeVersionId?: CommonType.IdType;
  /** 为 true 时预览不加载内容，直接触发事件交给父组件处理（适用于 Office 文件） */
  emitOnly?: boolean;
  /** 为 true 时不显示触发按钮，通过 toggle() 手动控制（用于 OnlyOffice iframe 内注入按钮场景） */
  invisibleTrigger?: boolean;
}>();

const emit = defineEmits<{
  preview: [content: string, version: HistoryVersion];
  restore: [version: HistoryVersion];
  delete: [versionId: CommonType.IdType];
  emptied: [];
}>();

const dialog = useDialog();
const authStore = useAuthStore();
const { userInfo: currentUser } = storeToRefs(authStore);

const popoverVisible = ref(false);
const historyList = shallowRef<HistoryVersion[]>([]);
const historyLoading = ref(false);
const userInfoMap = ref<Map<string, UserInfoMap>>(new Map());

function getUserDisplay(operator: string): UserInfoMap {
  const cached = userInfoMap.value.get(operator);
  if (cached) return cached;

  const uid = String(currentUser.value?.userId);
  if (operator === uid) {
    return {
      nickName: currentUser.value?.nickName || currentUser.value?.userName || operator,
      avatar: currentUser.value?.userAvatar || ''
    };
  }

  return { nickName: operator, avatar: '' };
}

async function resolveUserOperators(versions: HistoryVersion[]) {
  const currentUserId = String(currentUser.value?.userId);
  const unresolvedIds = [...new Set(versions.map(v => v.operator))].filter(
    id => id !== currentUserId && !userInfoMap.value.has(id)
  );

  if (unresolvedIds.length === 0) return;

  const results = await Promise.allSettled(
    unresolvedIds.map(async id => {
      const { data, error } = await fetchGetUserInfo(Number(id));
      return { id, data, error };
    })
  );

  const newMap = new Map(userInfoMap.value);
  for (const result of results) {
    if (result.status === 'fulfilled' && !result.value.error && result.value.data) {
      const user = result.value.data as unknown as Api.System.User;
      newMap.set(result.value.id, {
        nickName: user.nickName || user.userName || result.value.id,
        avatar: user.avatar || ''
      });
    }
  }
  userInfoMap.value = newMap;
}

async function loadHistoryVersions() {
  if (!props.fileId) return;
  historyLoading.value = true;
  try {
    const { data, error } = await fetchHistoryList(props.fileId);
    if (!error && data) {
      historyList.value = data;
      await resolveUserOperators(data);
    } else {
      historyList.value = [];
    }
  } catch {
    historyList.value = [];
  } finally {
    historyLoading.value = false;
  }
}

async function handlePreview(version: HistoryVersion) {
  if (props.emitOnly) {
    emit('preview', '', version);
    popoverVisible.value = false;
    return;
  }
  historyLoading.value = true;
  try {
    const { data, error } = await fetchHistoryContent(version.id);
    if (!error && data) {
      emit('preview', data, version);
      popoverVisible.value = false;
    }
  } catch {
    window.$message?.error('获取历史版本内容失败');
  } finally {
    historyLoading.value = false;
  }
}

function handleRestore(version: HistoryVersion) {
  dialog.warning({
    title: '恢复历史版本',
    content: `确定要恢复到 ${version.createTime} 的版本吗？当前未保存的修改将被覆盖。`,
    positiveText: '恢复',
    negativeText: '取消',
    onPositiveClick: () => {
      emit('restore', version);
      popoverVisible.value = false;
    }
  });
}

function handleDelete(version: HistoryVersion) {
  dialog.warning({
    title: '删除历史版本',
    content: `确定要删除 ${version.createTime} 的版本吗？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const { error } = await fetchDeleteHistory([version.id]);
        if (!error) {
          window.$message?.success('删除成功');
          historyList.value = historyList.value.filter(v => v.id !== version.id);
          emit('delete', version.id);
          if (historyList.value.length === 0) {
            emit('emptied');
            popoverVisible.value = false;
          }
        } else {
          window.$message?.error('删除失败');
        }
      } catch {
        window.$message?.error('删除失败');
      }
    }
  });
}

watch(popoverVisible, show => {
  if (show) {
    loadHistoryVersions();
  }
});

watch(
  () => props.fileId,
  () => {
    popoverVisible.value = false;
  }
);

function toggle() {
  popoverVisible.value = !popoverVisible.value;
}

defineExpose({ toggle });
</script>

<template>
  <NPopover
    v-model:show="popoverVisible"
    :trigger="invisibleTrigger ? 'manual' : 'click'"
    placement="bottom-end"
    :width="420"
    :style="{ maxHeight: '480px' }"
    :content-style="{ padding: 0 }"
  >
    <template #trigger>
      <slot v-if="!invisibleTrigger" />
      <span v-else style="position:absolute;width:0;height:0;overflow:hidden;" />
    </template>

    <div class="history-popover">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <span class="text-sm font-medium text-gray-800 dark:text-gray-200">历史版本</span>
        <NButton quaternary circle size="tiny" @click="popoverVisible = false">
          <template #icon>
            <icon-mdi-close class="text-base text-gray-400" />
          </template>
        </NButton>
      </div>

      <!-- 加载中 -->
      <div v-if="historyLoading && historyList.length === 0" class="flex items-center justify-center py-8">
        <NSpin size="small" />
      </div>

      <!-- 空状态 -->
      <div v-else-if="historyList.length === 0" class="flex flex-col items-center justify-center py-8 text-gray-400">
        <icon-mdi-history class="text-3xl mb-2 opacity-50" />
        <span class="text-xs">暂无历史版本</span>
      </div>

      <!-- 版本列表 -->
      <div v-else class="history-list">
        <div
          v-for="version in historyList"
          :key="version.id"
          class="history-item"
          :class="{ 'history-item--active': activeVersionId === version.id }"
        >
          <!-- 左侧头像 -->
          <div class="flex-shrink-0">
            <NAvatar
              v-if="getUserDisplay(version.operator).avatar"
              :src="getUserDisplay(version.operator).avatar"
              :size="36"
              round
            />
            <NAvatar v-else :size="36" round class="bg-primary">
              {{ getUserDisplay(version.operator).nickName?.charAt(0) || '?' }}
            </NAvatar>
          </div>

          <!-- 中间信息 -->
          <div class="flex-1 min-w-0 ml-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                {{ getUserDisplay(version.operator).nickName }}
              </span>
              <span class="text-xs text-gray-400 flex-shrink-0 ml-2">
                {{ formatFileSize(version.size) }}
              </span>
            </div>
            <div class="text-xs text-gray-400 mt-0.5 truncate">
              {{ version.fileName }}
            </div>
            <div class="text-xs text-gray-400 mt-0.5">
              {{ version.createTime }}
            </div>
          </div>

          <!-- 右侧操作按钮 -->
          <div class="flex-shrink-0 flex items-center gap-1.5 ml-3">
            <NButton size="tiny" quaternary @click="handlePreview(version)">
              预览
            </NButton>
            <NButton size="tiny" type="warning" @click="handleRestore(version)">
              恢复
            </NButton>
            <NButton size="tiny" type="error" quaternary @click="handleDelete(version)">
              删除
            </NButton>
          </div>
        </div>
      </div>
    </div>
  </NPopover>
</template>

<style scoped lang="scss">
.history-popover {
  overflow: hidden;
  border-radius: var(--n-border-radius, 3px);
}

.history-list {
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
}

.history-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  border-left: 3px solid transparent;
  border-bottom: 1px solid var(--n-border-color, #efeff1);
  box-sizing: border-box;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: var(--n-td-color-hover, #f5f5f5);
  }

  &--active {
    background-color: rgba(var(--primary-color-rgb, 46, 96, 214), 0.08);
    border-left-color: var(--primary-color, #2e60d6);

    &:hover {
      background-color: rgba(var(--primary-color-rgb, 46, 96, 214), 0.12);
    }
  }
}
</style>
