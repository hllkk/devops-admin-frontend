import { ref, watch } from 'vue';
import { fetchTaskStatus } from '@/service/api/disk/file';

interface AsyncTaskOptions {
  /** 轮询间隔(ms), 默认 2000 */
  interval?: number;
  /** 最大轮询次数, 默认 300 (10分钟@2s) */
  maxRetries?: number;
}

interface AsyncTaskResult {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'idle';
  progress: number;
  total: number;
  error: string;
  isPolling: boolean;
}

/**
 * 通用异步任务轮询 hook
 * 用于解压、删除回收站、清空回收站等后台任务的进度追踪
 */
export function useAsyncTask(options: AsyncTaskOptions = {}) {
  const { interval = 2000, maxRetries = 300 } = options;

  const status = ref<AsyncTaskResult['status']>('idle');
  const progress = ref(0);
  const total = ref(0);
  const error = ref('');
  const isPolling = ref(false);

  let timer: ReturnType<typeof setInterval> | null = null;
  let retries = 0;
  let currentTaskId: string | null = null;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    isPolling.value = false;
  }

  function start(taskId: string, onComplete?: () => void, onError?: (err: string) => void) {
    // 清理之前的轮询
    stop();

    currentTaskId = taskId;
    status.value = 'processing';
    progress.value = 0;
    total.value = 0;
    error.value = '';
    isPolling.value = true;
    retries = 0;

    timer = setInterval(async () => {
      if (!currentTaskId) {
        stop();
        return;
      }

      retries++;
      if (retries > maxRetries) {
        stop();
        status.value = 'failed';
        error.value = '任务超时，请稍后刷新查看结果';
        onError?.(error.value);
        return;
      }

      try {
        const { data } = await fetchTaskStatus(currentTaskId);
        if (!data) return;

        status.value = data.status as AsyncTaskResult['status'];
        progress.value = data.processed || 0;
        total.value = data.total || 0;

        if (data.status === 'completed') {
          stop();
          onComplete?.();
        } else if (data.status === 'failed') {
          stop();
          error.value = data.error || '任务执行失败';
          onError?.(error.value);
        }
      } catch {
        // 网络错误时继续轮询, 不立即失败
        retries--;
      }
    }, interval);
  }

  // 组件卸载时清理
  watch(
    () => isPolling.value,
    val => {
      if (!val && timer) {
        clearInterval(timer);
        timer = null;
      }
    }
  );

  return { status, progress, total, error, isPolling, start, stop };
}
