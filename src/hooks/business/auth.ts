import { localStg } from '@/utils/storage';
import { getToken } from '@/store/modules/auth/shared';
import { scheduleProactiveRefresh } from '@/service/request/shared';
import { useAuthStore } from '@/store/modules/auth';

export function useAuth() {
  const authStore = useAuthStore();

  function hasAuth(codes: string | string[]) {
    if (!authStore.isLogin) {
      return false;
    }

    const { buttons } = authStore.userInfo;

    // 超级管理员拥有所有权限
    if (buttons.includes('*:*:*')) {
      return true;
    }

    // 将单个权限转换为数组统一处理
    const codeList = Array.isArray(codes) ? codes : [codes];

    return codeList.some(code => buttons.includes(code));
  }

  function hasRole(roleCodes: string | string[]) {
    if (!authStore.isLogin) {
      return false;
    }

    const { roles } = authStore.userInfo;

    // 超级管理员拥有所有角色权限
    if (roles.includes('superadmin') || roles.includes('admin')) {
      return true;
    }

    // 将单个角色转换为数组统一处理
    const codeList = Array.isArray(roleCodes) ? roleCodes : [roleCodes];

    return codeList.some(code => roles.includes(code));
  }

  return {
    hasAuth,
    hasRole
  };
}

let visibilityHandlerBound = false;
let cachedExpiresAt: number | null = null;

/** Restore proactive token refresh timer on app startup */
export function initProactiveRefresh() {
  if (!getToken()) return;

  const expiresAt = localStg.get('tokenExpiresAt');
  if (expiresAt && expiresAt !== cachedExpiresAt) {
    cachedExpiresAt = expiresAt;
    scheduleProactiveRefresh(expiresAt);
  }

  if (!visibilityHandlerBound) {
    visibilityHandlerBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;

      if (!getToken()) return;

      const storedExpiresAt = localStg.get('tokenExpiresAt');
      if (!storedExpiresAt) return;

      cachedExpiresAt = storedExpiresAt;
      const remaining = storedExpiresAt - Date.now();

      if (remaining <= 0) {
        // Token 可能已在后台期间过期，主动尝试刷新
        import('@/service/api').then(({ fetchRefreshToken }) => {
          fetchRefreshToken().then(({ error, data }) => {
            if (!error && data?.expiresAt) {
              localStg.set('tokenExpiresAt', data.expiresAt);
              scheduleProactiveRefresh(data.expiresAt);
            }
          }).catch(() => {});
        });
      } else {
        // Token 仍在有效期内，同步定时器
        scheduleProactiveRefresh(storedExpiresAt);
      }
    });
  }
}

/** Invalidate cached expiresAt (call after login/refresh sets new value) */
export function invalidateRefreshCache() {
  cachedExpiresAt = null;
}
