import SparkMD5 from 'spark-md5';

const HASH_CHUNK_SIZE = 2 * 1024 * 1024;
const QUICK_SAMPLE_SIZE = 2 * 1024 * 1024;

// 主线程 → Worker 的哈希请求（统一 id 协议，支持并发请求匹配响应）
type HashRequest =
  | { id: number; type: 'full'; file: File }
  | { id: number; type: 'chunk'; blob: Blob }
  | { id: number; type: 'quick'; file: File }
  | { id: number; type: 'strong'; file: File };

// Worker → 主线程的响应（progress 仅 full 模式发送）
type HashResponse =
  | { id: number; type: 'progress'; progress: number }
  | { id: number; type: 'done'; hash: string }
  | { id: number; type: 'error'; message: string };

function post(msg: HashResponse) {
  // eslint-disable-next-line unicorn/require-post-message-target-origin
  self.postMessage(msg);
}

/** 组装首尾采样缓冲（quickHash 与 strongHash 共用，含 fileSize 防碰撞） */
async function buildSampleBuffer(file: File): Promise<ArrayBuffer> {
  const headBlob = file.slice(0, Math.min(QUICK_SAMPLE_SIZE, file.size));
  const tailStart = Math.max(0, file.size - QUICK_SAMPLE_SIZE);
  const tailBlob = file.size > QUICK_SAMPLE_SIZE ? file.slice(tailStart) : new Blob();
  const [headBuf, tailBuf] = await Promise.all([headBlob.arrayBuffer(), tailBlob.arrayBuffer()]);

  const sizeBuf = new ArrayBuffer(8);
  new DataView(sizeBuf).setBigUint64(0, BigInt(file.size), true);

  const combined = new Uint8Array(headBuf.byteLength + 8 + tailBuf.byteLength);
  combined.set(new Uint8Array(headBuf), 0);
  combined.set(new Uint8Array(sizeBuf), headBuf.byteLength);
  combined.set(new Uint8Array(tailBuf), headBuf.byteLength + 8);
  return combined.buffer;
}

self.addEventListener('message', async (e: MessageEvent<HashRequest>) => {
  const req = e.data;
  // 提前保存 id，避免 try 内 exhaustive switch 把 req 收窄为 never 后 catch 取不到 id
  const reqId = req.id;
  try {
    let hash: string;
    switch (req.type) {
      case 'full': {
        // 全文件 MD5：流式分片累加，周期性上报进度
        const chunks = Math.ceil(req.file.size / HASH_CHUNK_SIZE);
        const spark = new SparkMD5.ArrayBuffer();
        for (let i = 0; i < chunks; i += 1) {
          const start = i * HASH_CHUNK_SIZE;
          const end = Math.min(start + HASH_CHUNK_SIZE, req.file.size);
          spark.append(await req.file.slice(start, end).arrayBuffer());
          post({ id: reqId, type: 'progress', progress: Math.round(((i + 1) / chunks) * 100) });
        }
        hash = spark.end();
        break;
      }
      case 'chunk': {
        // 单个分片 MD5（上传分片校验）
        const spark = new SparkMD5.ArrayBuffer();
        spark.append(await req.blob.arrayBuffer());
        hash = spark.end();
        break;
      }
      case 'quick': {
        // 采样快速指纹 MD5
        const spark = new SparkMD5.ArrayBuffer();
        spark.append(await buildSampleBuffer(req.file));
        hash = spark.end();
        break;
      }
      case 'strong': {
        // SHA-256 强指纹（与 quickHash 配合消除碰撞）
        const digest = await crypto.subtle.digest('SHA-256', await buildSampleBuffer(req.file));
        hash = Array.from(new Uint8Array(digest))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        break;
      }
      default:
        post({ id: reqId, type: 'error', message: '未知哈希类型' });
        return;
    }
    post({ id: reqId, type: 'done', hash });
  } catch (err) {
    post({ id: reqId, type: 'error', message: err instanceof Error ? err.message : '哈希计算失败' });
  }
});
