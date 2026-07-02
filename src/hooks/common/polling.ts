import { onScopeDispose } from 'vue';
import { useBoolean } from '@sa/hooks';
import type { Ref } from 'vue';

export interface PollingOptions {
  /** 是否在 hide 时暂停、show 时恢复，默认 true */
  pauseOnHidden?: boolean;
  /** 是否立即执行一次，默认 true */
  immediate?: boolean;
}

export interface UsePollingReturn {
  start: () => void;
  stop: () => void;
  isRunning: Ref<boolean>;
}

/**
 * 定时轮询：标签页隐藏自动暂停，组件销毁自动清理。
 *
 * @param fn 轮询回调；错误需在内部捕获并展示，hook 内部仅静默吞掉以免中断下一轮
 * @param interval 轮询间隔（ms），默认 10000
 * @param options 行为开关
 */
export function usePolling(
  fn: () => void | Promise<void>,
  interval = 10000,
  options: PollingOptions = {}
): UsePollingReturn {
  const { pauseOnHidden = true, immediate = true } = options;
  const { bool: isRunning, setTrue, setFalse } = useBoolean(false);

  let timer: ReturnType<typeof setInterval> | null = null;

  function clearTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  async function tick() {
    try {
      await fn();
    } catch (err) {
      // 轮询错误不中断下一轮；上层应在 fn 内处理 error 态展示
      void err;
    }
  }

  function start() {
    if (timer) return;
    setTrue();
    if (immediate) {
      tick();
    }
    timer = setInterval(tick, interval);
  }

  function stop() {
    clearTimer();
    setFalse();
  }

  if (pauseOnHidden) {
    const onVisibility = () => {
      if (document.hidden) {
        clearTimer();
      } else if (isRunning.value && !timer) {
        timer = setInterval(tick, interval);
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    onScopeDispose(() => document.removeEventListener('visibilitychange', onVisibility));
  }

  onScopeDispose(stop);

  return { start, stop, isRunning };
}
