import SparkMD5 from 'spark-md5';

const HASH_CHUNK_SIZE = 2 * 1024 * 1024;

interface HashWorkerMessage {
  type: 'compute';
  file: File;
}

interface HashWorkerResult {
  type: 'progress';
  progress: number;
}

interface HashWorkerComplete {
  type: 'done';
  hash: string;
}

interface HashWorkerError {
  type: 'error';
  message: string;
}

self.addEventListener('message', async (e: MessageEvent<HashWorkerMessage>) => {
  if (e.data.type !== 'compute') return;

  const { file } = e.data;
  const chunks = Math.ceil(file.size / HASH_CHUNK_SIZE);
  let currentChunk = 0;
  const spark = new SparkMD5.ArrayBuffer();

  try {
    while (currentChunk < chunks) {
      const start = currentChunk * HASH_CHUNK_SIZE;
      const end = Math.min(start + HASH_CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);
      const buffer = await blob.arrayBuffer();
      spark.append(buffer);
      currentChunk++;
      // eslint-disable-next-line unicorn/require-post-message-target-origin
      self.postMessage({ type: 'progress', progress: Math.round((currentChunk / chunks) * 100) } as HashWorkerResult);
    }
    // eslint-disable-next-line unicorn/require-post-message-target-origin
    self.postMessage({ type: 'done', hash: spark.end() } as HashWorkerComplete);
  } catch (err) {
    /* eslint-disable unicorn/require-post-message-target-origin */
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : '文件哈希计算失败' } as HashWorkerError);
    /* eslint-enable unicorn/require-post-message-target-origin */
  }
});
