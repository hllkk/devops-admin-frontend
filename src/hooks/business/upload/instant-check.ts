const HASH_CHUNK_SIZE = 2 * 1024 * 1024;

/** 分片读取文件计算 MD5 hash（Web Worker 版本，不阻塞主线程） */
export function computeFileHash(
  file: File,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }

    // 尝试使用 Web Worker
    try {
      const worker = new Worker(
        new URL('./hash-worker.ts', import.meta.url),
        { type: 'module' }
      );

      const onAbort = () => {
        worker.terminate();
        reject(new Error('Aborted'));
      };

      signal?.addEventListener('abort', onAbort, { once: true });

      worker.addEventListener('message', (e: MessageEvent) => {
        const data = e.data;
        if (data.type === 'progress') {
          onProgress?.(data.progress);
        } else if (data.type === 'done') {
          signal?.removeEventListener('abort', onAbort);
          worker.terminate();
          resolve(data.hash);
        } else if (data.type === 'error') {
          signal?.removeEventListener('abort', onAbort);
          worker.terminate();
          reject(new Error(data.message));
        }
      });

      worker.addEventListener('error', () => {
        signal?.removeEventListener('abort', onAbort);
        worker.terminate();
        // Worker 加载失败，回退到主线程
        computeFileHashMainThread(file, onProgress, signal).then(resolve, reject);
      });

      // DedicatedWorker: postMessage 不需要 targetOrigin 参数
      // eslint-disable-next-line unicorn/require-post-message-target-origin
      worker.postMessage({ type: 'compute', file });
    } catch {
      // Worker 不可用（如某些浏览器环境），回退到主线程
      computeFileHashMainThread(file, onProgress, signal).then(resolve, reject);
    }
  });
}

/** 主线程回退方案（小文件或 Worker 不可用时使用） */
function computeFileHashMainThread(
  file: File,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }

    // 对于小文件（<10MB），直接在主线程计算
    // 动态导入避免不必要的加载
    import('spark-md5').then(({ default: SparkMD5 }) => {
      const chunks = Math.ceil(file.size / HASH_CHUNK_SIZE);
      let currentChunk = 0;
      const spark = new SparkMD5.ArrayBuffer();
      const reader = new FileReader();

      const onAbort = () => {
        reader.abort();
        reject(new Error('Aborted'));
      };

      signal?.addEventListener('abort', onAbort, { once: true });

      reader.addEventListener('load', (e) => {
        if (e.target?.result) {
          spark.append(e.target.result as ArrayBuffer);
        }
        currentChunk++;
        onProgress?.(Math.round((currentChunk / chunks) * 100));

        if (currentChunk < chunks) {
          loadNext();
        } else {
          signal?.removeEventListener('abort', onAbort);
          resolve(spark.end());
        }
      });

      reader.addEventListener('error', () => {
        signal?.removeEventListener('abort', onAbort);
        reject(new Error('文件读取失败'));
      });

      function loadNext() {
        const start = currentChunk * HASH_CHUNK_SIZE;
        const end = Math.min(start + HASH_CHUNK_SIZE, file.size);
        reader.readAsArrayBuffer(file.slice(start, end));
      }

      loadNext();
    }).catch(reject);
  });
}
