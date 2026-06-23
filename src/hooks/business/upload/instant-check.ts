// 哈希计算统一走 Web Worker 单例（full/chunk/quick/strong），避免主线程同步哈希阻塞 UI。
// 所有哈希（分片 MD5、采样 quickHash、SHA-256 strongHash、全文件 MD5）均在此调度，
// 通过递增 id 匹配请求与响应，单 Worker 串行处理但完全不阻塞主线程。

type HashKind = 'full' | 'chunk' | 'quick' | 'strong';

interface HashWorkerRequest {
  id: number;
  type: HashKind;
  file?: File;
  blob?: Blob;
}

interface PendingTask {
  resolve: (hash: string) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

let hashWorker: Worker | null = null;
let hashWorkerSupported = true;
let hashRequestId = 0;
const pendingHashTasks = new Map<number, PendingTask>();

/** 懒加载哈希 Worker 单例；创建失败则标记不可用，后续请求直接 reject */
function getHashWorker(): Worker | null {
  if (!hashWorkerSupported) return null;
  if (hashWorker) return hashWorker;

  try {
    hashWorker = new Worker(new URL('./hash-worker.ts', import.meta.url), { type: 'module' });

    hashWorker.addEventListener('message', (e: MessageEvent) => {
      const data = e.data as { id: number; type: string; hash?: string; message?: string; progress?: number };
      const task = pendingHashTasks.get(data.id);
      if (!task) return;
      if (data.type === 'done' && data.hash !== undefined) {
        pendingHashTasks.delete(data.id);
        task.resolve(data.hash);
      } else if (data.type === 'error') {
        pendingHashTasks.delete(data.id);
        task.reject(new Error(data.message || '哈希计算失败'));
      } else if (data.type === 'progress' && data.progress !== undefined) {
        task.onProgress?.(data.progress);
      }
    });

    hashWorker.addEventListener('error', () => {
      // Worker 崩溃：拒绝所有在途任务并降级，避免永久挂起
      hashWorkerSupported = false;
      for (const [, task] of pendingHashTasks) task.reject(new Error('哈希 Worker 不可用'));
      pendingHashTasks.clear();
      hashWorker = null;
    });
  } catch {
    hashWorkerSupported = false;
    hashWorker = null;
  }

  return hashWorker;
}

interface RequestHashOptions {
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

/** 向 Worker 提交一次哈希请求，返回 Promise；支持进度回调和取消 */
function requestHash(payload: Omit<HashWorkerRequest, 'id'>, options: RequestHashOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = getHashWorker();
    if (!worker) {
      reject(new Error('哈希 Worker 不可用'));
      return;
    }

    const id = ++hashRequestId;
    pendingHashTasks.set(id, { resolve, reject, onProgress: options.onProgress });

    if (options.signal) {
      if (options.signal.aborted) {
        pendingHashTasks.delete(id);
        reject(new Error('Aborted'));
        return;
      }
      options.signal.addEventListener(
        'abort',
        () => {
          if (pendingHashTasks.has(id)) {
            pendingHashTasks.delete(id);
            reject(new Error('Aborted'));
          }
        },
        { once: true }
      );
    }

    // eslint-disable-next-line unicorn/require-post-message-target-origin
    worker.postMessage({ id, ...payload });
  });
}

/** 分片 MD5（Web Worker，不阻塞主线程）—— 供上传分片哈希校验使用 */
export function computeChunkHash(blob: Blob): Promise<string> {
  return requestHash({ type: 'chunk', blob });
}

/** 采样快速指纹：MD5(首 2MB + fileSize + 尾 2MB)（Web Worker） */
export function computeQuickHash(file: File): Promise<string> {
  return requestHash({ type: 'quick', file });
}

/** SHA-256 强指纹：对同采样数据计算（Web Worker；非 HTTPS 环境可能不可用，调用方需 catch） */
export function computeStrongHash(file: File): Promise<string> {
  return requestHash({ type: 'strong', file });
}

/** 全文件 MD5（Web Worker，带进度与取消） */
export function computeFileHash(
  file: File,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<string> {
  return requestHash({ type: 'full', file }, { onProgress, signal });
}
