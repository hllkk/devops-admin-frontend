import { h, ref } from 'vue';
import { NButton } from 'naive-ui';
import { useNoticeStore } from '@/store/modules/notice';
import { getToken } from '@/store/modules/auth/shared';
import { router } from '@/router';
import { $t } from '@/locales';

interface SSEMessage {
  type: string;
  data?: unknown;
  message?: string;
  timestamp: number;
}

interface ShareNotificationData {
  shareId: number;
  fileId: number;
  fileName: string;
  shareUser: string;
}

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_TIMEOUT = 45000;

let es: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let intentionalClose = false;

export const connected = ref(false);

/** 注册型 SSE 消息监听器，用于业务模块订阅特定类型的 SSE 事件 */
type SSEListener = (msg: SSEMessage) => void;
const listeners: Map<string, Set<SSEListener>> = new Map();

/** 注册监听指定类型的 SSE 消息，返回取消注册函数 */
export function onSSEMessage(type: string, listener: SSEListener): () => void {
  if (!listeners.has(type)) {
    listeners.set(type, new Set());
  }
  listeners.get(type)!.add(listener);
  return () => {
    listeners.get(type)?.delete(listener);
  };
}

function getSSEUrl(): string {
  const backendUrl = import.meta.env.VITE_SERVICE_BASE_URL || '';
  const basePath = import.meta.env.VITE_APP_BASE_API || '/api/v1';
  return `${backendUrl}${basePath}/sse/connect`;
}

function showShareNotification(data: ShareNotificationData) {
  const n = window.$notification?.create({
    title: $t('page.disk.sharedWithMe.newShareTitle'),
    content: $t('page.disk.sharedWithMe.newShareContent', { user: data.shareUser, file: data.fileName }),
    duration: 0, // 不自动关闭，需要用户手动点击
    closable: true,
    action() {
      return h('div', { style: { display: 'flex', justifyContent: 'end', gap: '12px' } }, [
        h(
          NButton,
          {
            onClick() {
              n?.destroy();
              router.push('/shared-with-me');
            }
          },
          () => $t('page.disk.sharedWithMe.viewNow')
        ),
        h(
          NButton,
          {
            onClick() {
              n?.destroy();
            }
          },
          () => $t('common.close')
        )
      ]);
    }
  });
}

function handleMessage(event: MessageEvent) {
  resetHeartbeat();

  const raw = event.data;
  if (!raw) return;

  let msg: SSEMessage;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    msg = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
  } catch {
    return;
  }

  if (msg.type === 'heartbeat') return;

  // 服务器关闭通知
  if (msg.type === 'server_shutdown') {
    window.$message?.warning((msg as { message?: string }).message || '服务器正在关闭，请保存数据');
    // 不设置 intentionalClose，保持自动重连机制，等待后端重启后自动恢复连接
    return;
  }

  if (msg.type === 'share_notification') {
    const noticeStore = useNoticeStore();
    noticeStore.fetchUnreadCount();
    noticeStore.fetchMyNotices();

    // 弹窗提醒用户
    const shareData = msg.data as ShareNotificationData;
    if (shareData) {
      showShareNotification(shareData);
    }
  }

  // 分发到注册的监听器
  const typeListeners = listeners.get(msg.type);
  if (typeListeners) {
    for (const listener of typeListeners) {
      listener(msg);
    }
  }
}

function resetHeartbeat() {
  if (heartbeatTimer) clearTimeout(heartbeatTimer);
  heartbeatTimer = setTimeout(() => {
    reconnect();
  }, HEARTBEAT_TIMEOUT);
}

function clearTimers() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function reconnect() {
  if (intentionalClose) return;
  if (!getToken()) return;

  const delay = Math.min(RECONNECT_DELAY * Math.pow(2, reconnectAttempt), MAX_RECONNECT_DELAY);
  reconnectAttempt++;

  reconnectTimer = setTimeout(() => {
    connectSSE();
  }, delay);
}

export function connectSSE() {
  if (es) return;
  if (!getToken()) return;

  intentionalClose = false;
  reconnectAttempt = 0;

  const url = getSSEUrl();

  es = new EventSource(url, { withCredentials: true });

  es.addEventListener('open', () => {
    connected.value = true;
    reconnectAttempt = 0;
    resetHeartbeat();
  });

  es.addEventListener('message', handleMessage);

  es.addEventListener('error', () => {
    connected.value = false;
    es?.close();
    es = null;
    clearTimers();
    reconnect();
  });
}

export function disconnectSSE() {
  intentionalClose = true;
  clearTimers();
  if (es) {
    es.close();
    es = null;
  }
  connected.value = false;
}
