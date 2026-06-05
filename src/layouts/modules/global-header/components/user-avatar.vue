<script setup lang="ts">
import { computed, h } from 'vue';
import { useRouter } from 'vue-router';
import type { VNode } from 'vue';
import { useBoolean } from '@sa/hooks';
import { useAuthStore } from '@/store/modules/auth';
import { useRouteStore } from '@/store/modules/route';
import { useAppStore } from '@/store/modules/app';
import { useDiskStore } from '@/store/modules/disk';
import { useRouterPush, useSharedPageNav } from '@/hooks/common/router';
import { useSvgIcon } from '@/hooks/common/icon';
import defaultAvatar from '@/assets/imgs/soybean.jpg';
import { $t } from '@/locales';

defineOptions({
  name: 'UserAvatar'
});

const router = useRouter();
const authStore = useAuthStore();
const routeStore = useRouteStore();
const appStore = useAppStore();
const { toLogin } = useRouterPush();
const { SvgIconVNode } = useSvgIcon();
const { navigateToSharedPage, currentModule } = useSharedPageNav();

const { bool: avatarError, setTrue: setError, setFalse: clearError } = useBoolean(false);

// 移动端存储空间信息
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const storageInfo = computed(() => {
  if (!appStore.isMobile) return null;
  const diskStore = useDiskStore();
  const quota = diskStore.quotaInfo;
  const used = formatBytes(quota.usedSpace);
  const total = quota.unlimited ? '无限制' : formatBytes(quota.quota);
  const percent = quota.unlimited || quota.quota === 0 ? 0 : Math.min(Math.round((quota.usedSpace / quota.quota) * 100), 100);
  const color = percent >= 90 ? '#ef4444' : percent >= 80 ? '#f97316' : '#22c55e';
  return { label: `已使用 ${used} / ${total}`, percent, color };
});

function loginOrRegister() {
  toLogin();
}

function handleAvatarLoad() {
  clearError();
}

function handleAvatarError() {
  setError();
}

type DropdownKey = 'userCenter' | 'switchRole' | 'toAdmin' | 'toDisk' | 'logout' | 'storage-info';

type DropdownOption =
  | {
      key: DropdownKey;
      label: string;
      icon?: () => VNode;
      disabled?: boolean;
      type?: string;
      render?: () => VNode;
    }
  | {
      type: 'divider';
      key: string;
    }
  | {
      type: 'render';
      key: string;
      render: () => VNode;
    };

// 判断当前模块
const isDiskPage = computed(() => currentModule.value === 'disk');
const isAdminPage = computed(() => currentModule.value === 'admin');

// 判断用户是否有 admin 模块的路由（排除共享页面 user-center/notice-user）
const hasAdminPermission = computed(() => {
  const routes = routeStore.authRoutes;
  if (!routes || routes.length === 0) return false;
  return routes.some(route => {
    const meta = route.meta as Record<string, unknown> | undefined;
    if (!meta) return false;
    // 共享页面属于所有模块但 hideInMenu=true，不应作为 admin 权限依据
    if (meta.hideInMenu) return false;
    const mod = meta.module as string | undefined;
    const mods = meta.modules as string[] | undefined;
    return mod === 'admin' || (mods && mods.includes('admin'));
  });
});

const options = computed(() => {
  const opts: DropdownOption[] = [];

  // 移动端：显示存储空间信息（含进度条）
  if (storageInfo.value) {
    const info = storageInfo.value;
    opts.push({
      type: 'render',
      key: 'storage-info',
      render: () =>
        h('div', { class: 'px-12px py-6px' }, [
          h('div', { class: 'flex items-center gap-6px text-12px mb-6px text-gray-500 dark:text-gray-400' }, [
            SvgIconVNode({ icon: 'mdi:cloud-outline', fontSize: 16 })?.(),
            h('span', { class: 'truncate' }, info.label)
          ]),
          h('div', { class: 'relative h-4px rd-2px overflow-hidden bg-gray-200 dark:bg-gray-700' }, [
            h('div', {
              class: 'absolute left-0 top-0 bottom-0 rd-2px transition-all duration-500',
              style: { width: `${info.percent}%`, background: info.color }
            })
          ])
        ])
    });
    opts.push({ type: 'divider', key: 'divider-storage' });
  }

  // 不在 disk 页面时，显示"我的网盘"
  if (!isDiskPage.value) {
    opts.push({
      label: '我的网盘',
      key: 'toDisk',
      icon: SvgIconVNode({ icon: 'mdi:harddisk', fontSize: 18 })
    });
  }

  // 不在 admin/manage 页面，且有权限时，显示"管理中心"
  if (!isAdminPage.value && hasAdminPermission.value) {
    opts.push({
      label: '管理中心',
      key: 'toAdmin',
      icon: SvgIconVNode({ icon: 'mdi:monitor-dashboard', fontSize: 18 })
    });
  }

  // 如果有导航项，添加分隔线
  if (opts.length > 0) {
    opts.push({ type: 'divider', key: 'divider-nav' });
  }

  // 通用选项
  opts.push(
    {
      label: $t('common.userCenter'),
      key: 'userCenter',
      icon: SvgIconVNode({ icon: 'ph:user-circle', fontSize: 18 })
    },
    {
      label: $t('common.switchRole'),
      key: 'switchRole',
      icon: SvgIconVNode({ icon: 'ph:swap', fontSize: 18 })
    },
    {
      type: 'divider',
      key: 'divider'
    },
    {
      label: $t('common.logout'),
      key: 'logout',
      icon: SvgIconVNode({ icon: 'ph:sign-out', fontSize: 18 })
    }
  );

  return opts;
});

function logout() {
  window.$dialog?.info({
    title: $t('common.tip'),
    content: $t('common.logoutConfirm'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: () => {
      authStore.resetStore();
    }
  });
}

function handleUserCenter() {
  navigateToSharedPage('user-center');
}

function handleSwitchRole() {
  window.$message?.destroyAll();
  window.$message?.warning($t('common.switchRole') + ' - 功能开发中');
}

function goToAdmin() {
  router.push({ name: 'admin' });
}

function goToDisk() {
  router.push({ name: 'disk' });
}

function handleDropdown(key: DropdownKey) {
  switch (key) {
    case 'logout':
      logout();
      break;
    case 'userCenter':
      handleUserCenter();
      break;
    case 'switchRole':
      handleSwitchRole();
      break;
    case 'toAdmin':
      goToAdmin();
      break;
    case 'toDisk':
      goToDisk();
      break;
  }
}
</script>

<template>
  <NButton v-if="!authStore.isLogin" quaternary @click="loginOrRegister">
    {{ $t('page.login.common.loginOrRegister') }}
  </NButton>
  <NDropdown v-else placement="bottom" trigger="click" :options="options" @select="handleDropdown">
    <div class="flex cursor-pointer items-center rounded-md px-2 py-1 transition-colors duration-300 hover:bg-black/6">
      <div class="flex items-center gap-2" :class="{ 'opacity-50': avatarError }">
        <NAvatar
          v-if="authStore.userInfo.userAvatar"
          :size="24"
          round
          :src="authStore.userInfo.userAvatar"
          @load="handleAvatarLoad"
          @error="handleAvatarError"
        />
        <NAvatar v-else :size="32" round :src="defaultAvatar" @load="handleAvatarLoad" @error="handleAvatarError" />
        <span class="max-w-120px truncate text-14px font-medium">
          {{ authStore.userInfo.nickName }}
        </span>
      </div>
    </div>
  </NDropdown>
</template>

<style scoped></style>