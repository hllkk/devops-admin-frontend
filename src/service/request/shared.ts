import { useAuthStore } from '@/store/modules/auth';
import { getToken } from '@/store/modules/auth/shared';
import { localStg } from '@/utils/storage';
import { fetchRefreshToken } from '../api';
import type { RequestInstanceState } from './type';

export function getAuthorization(): null {
  return null;
}

let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let scheduledExpiresAt: number | null = null;

/** Schedule proactive token refresh at 80% of token lifetime */
export function scheduleProactiveRefresh(expiresAtMs: number) {
  if (!expiresAtMs) return;

  if (scheduledExpiresAt === expiresAtMs && proactiveRefreshTimer) return;

  clearProactiveRefreshTimer();

  const now = Date.now();
  const tokenLifetime = expiresAtMs - now;

  if (tokenLifetime <= 60000) return;

  const delay = tokenLifetime * 0.8;

  if (delay <= 0) return;

  scheduledExpiresAt = expiresAtMs;
  proactiveRefreshTimer = setTimeout(async () => {
    proactiveRefreshTimer = null;
    scheduledExpiresAt = null;

    if (!getToken()) return;

    try {
      const { error, data } = await fetchRefreshToken();
      if (!error && data?.expiresAt) {
        localStg.set('tokenExpiresAt', data.expiresAt);
        scheduleProactiveRefresh(data.expiresAt);
      }
    } catch {
      // Silent failure - the reactive path will handle it
    }
  }, delay);
}

export function clearProactiveRefreshTimer() {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
  scheduledExpiresAt = null;
}

/** refresh token */
async function handleRefreshToken() {
  const { resetStore } = useAuthStore();

  // Refresh token is sent via HttpOnly cookie by the browser
  const { data, error } = await fetchRefreshToken();
  if (!error && data) {
    if (data.expiresAt) {
      localStg.set('tokenExpiresAt', data.expiresAt);
      scheduleProactiveRefresh(data.expiresAt);
    }
    return true;
  }

  // 清除认证信息，resetStore 内部会尝试跳转登录页
  try {
    await resetStore('session_expired');
  } catch {
    localStg.remove('isAuthenticated');
    localStg.remove('tokenExpiresAt');
    window.$notification?.error({
      title: '会话已过期',
      content: '请重新登录以继续使用',
      duration: 3000
    });
    window.location.href = '/login';
  }

  return false;
}

export async function handleExpiredRequest(state: RequestInstanceState) {
  if (!state.refreshTokenPromise) {
    state.refreshTokenPromise = handleRefreshToken();
  }

  const success = await state.refreshTokenPromise;

  setTimeout(() => {
    state.refreshTokenPromise = null;
  }, 1000);

  return success;
}

export function showErrorMsg(state: RequestInstanceState, message: string) {
  if (!state.errMsgStack?.length) {
    state.errMsgStack = [];
  }

  const isExist = state.errMsgStack.includes(message);

  if (!isExist) {
    state.errMsgStack.push(message);

    window.$message?.error(message, {
      onLeave: () => {
        state.errMsgStack = state.errMsgStack.filter(msg => msg !== message);

        setTimeout(() => {
          state.errMsgStack = [];
        }, 5000);
      }
    });
  }
}
