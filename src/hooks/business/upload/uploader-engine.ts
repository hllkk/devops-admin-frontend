import { isCancel } from 'axios';
import type { AxiosError } from 'axios';
import { fetchCancelUploadChunks, fetchCheckFile, fetchMergeChunks, fetchUploadChunk, fetchVerifyCrossUserInstantUpload } from '@/service/api/disk/file';
import { useDiskStore } from '@/store/modules/disk';
import { useAuthStore } from '@/store/modules/auth';
import { computeChunkHash, computeFileHash, computeQuickHash, computeStrongHash } from './instant-check';
import { onSSEMessage } from '@/hooks/common/sse';
import {
  getChunkSize,
  getConcurrency,
  needsChunking,
  getTotalChunks,
  sliceChunk,
  getFileExtension
} from './chunk-manager';
import { BACKEND_ERROR_CODE } from '@sa/axios';

/** Chunk retry limit */
const CHUNK_MAX_RETRIES = 3;

/** Merge retry limit */
const MERGE_MAX_RETRIES = 2;

/** Retry base delay in ms (exponential backoff: 1s, 2s, 4s) */
const RETRY_BASE_DELAY = 1000;

/** Speed tracking window in ms — longer window gives smoother results */
const SPEED_WINDOW = 3000;

/** 判断错误是否可重试：4xx 确定性业务错误不重试，5xx/网络超时重试 */
function isRetryableError(error: unknown): boolean {
  if (isCancel(error)) return false;
  const { response } = error as AxiosError;
  const status = response?.status;
  // 408（请求超时）和 429（限流）仍可重试
  if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return false;
  }
  return true;
}

/** 带 jitter 的指数退避延迟 */
function retryDelay(attempt: number): number {
  const base = RETRY_BASE_DELAY * 2 ** attempt;
  return base * (0.8 + Math.random() * 0.4); // ±20% jitter
}

/** EMA smoothing factor for speed — lower = smoother, higher = more responsive */
const SPEED_EMA_ALPHA = 0.25;

/** Unique ID counter */
let idCounter = 0;

/** Generate a unique task ID */
function generateId(): string {
  idCounter += 1;
  return `upload_${Date.now()}_${idCounter}`;
}

/** Lazily resolve the disk store (avoids circular init) */
function getStore() {
  return useDiskStore();
}

/** Get current user ID from auth store */
function getUserId(): number {
  return Number(useAuthStore().userInfo.userId);
}

/** Build current directory path from disk store breadcrumbs */
function getCurrentDirectory(): string {
  const store = getStore();
  if (store.currentPath.length === 0) return '/';
  const parts = store.currentPath.map(item => item.fileName);
  return `/${parts.join('/')}`;
}

/** Sleep helper for retry backoff */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/** Extract actual error message from axios error (backend response or default) */
function getErrorMessage(error: unknown, defaultMessage: string): string {
  if (!error) return defaultMessage;

  // Handle AxiosError with backend response
  const axiosError = error as AxiosError<{ msg?: string }>;
  if (axiosError.code === BACKEND_ERROR_CODE && axiosError.response?.data?.msg) {
    return axiosError.response.data.msg;
  }

  // Standard Error object
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return defaultMessage;
}

/**
 * UploaderEngine
 *
 * Manages the upload queue, file-level concurrency, chunked uploads with retry,
 * state machine transitions, and syncs state to the Pinia disk store.
 */
export class UploaderEngine {
  /** Maximum number of files uploading concurrently */
  private maxConcurrent: number;

  /** Pending task queue */
  private queue: Api.Disk.UploadTask[] = [];

  /** Currently active upload tasks */
  private activePool: Set<string> = new Set();

  /** Task map for fast lookup */
  private taskMap: Map<string, Api.Disk.UploadTask> = new Map();

  /** Speed tracking state per task */
  private speedTrackers: Map<
    string,
    {
      lastTime: number;
      lastTransferred: number;
      /** EMA-smoothed speed (bytes/sec) for stable display */
      emaSpeed: number;
      samples: { time: number; bytes: number }[];
    }
  > = new Map();

  /** Folder-level speed tracking (measures aggregate transferred bytes over time) */
  private folderSpeedTrackers: Map<
    string,
    {
      lastTime: number;
      lastTransferred: number;
      emaSpeed: number;
    }
  > = new Map();

  /** Throttle timer for per-chunk progress sync (200ms batch window) */
  private syncTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /** 清理指定任务的进度节流定时器（cancel/finish 调用，防幽灵任务与状态覆盖） */
  private clearSyncTimer(taskId: string): void {
    const tid = this.syncTimers.get(taskId);
    if (tid) {
      clearTimeout(tid);
      this.syncTimers.delete(taskId);
    }
  }

  /** Periodic timer to refresh active folder aggregates (speed/progress sampling) */
  private folderSyncTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  /** Ensure periodic folder aggregate refresh is running while folder uploads are active */
  private ensureFolderSyncTimer(): void {
    if (this.folderSyncTimer) return;
    this.folderSyncTimer = setInterval(() => {
      // Collect active folderIds (folders with non-completed child tasks)
      const activeFolderIds = new Set<string>();
      let hasActive = false;
      for (const task of this.taskMap.values()) {
        if (task.folderId) {
          activeFolderIds.add(task.folderId);
          if (task.status !== 'completed' && task.status !== 'failed') {
            hasActive = true;
          }
        }
      }
      if (!hasActive) {
        // No active folder uploads — stop the timer
        if (this.folderSyncTimer) {
          clearInterval(this.folderSyncTimer);
          this.folderSyncTimer = null;
        }
        return;
      }
      // Re-sync each active folder aggregate (updates speed/progress between file completions)
      for (const folderId of activeFolderIds) {
        this.syncFolderToStore(folderId);
      }
    }, 500);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Add files to the upload queue. Folder entries (size 0, no extension, no MIME) are skipped. */
  addFiles(
    files: { file: File; resolvedName?: string; override?: boolean; relativePath?: string }[],
    parentId: number,
    folderInfo?: { id: string; name: string }
  ): string[] {
    const ids: string[] = [];

    for (const entry of files) {
      // Skip folder entries from drag-drop (size 0, no type, no extension)
      const ext = getFileExtension(entry.file.name);
      if (entry.file.size === 0 && entry.file.type === '' && !ext) continue;

      const task = this.createTask(entry.file, parentId, folderInfo, entry.relativePath);
      if (entry.resolvedName) {
        task.fileName = entry.resolvedName;
      }
      if (entry.override) {
        task.override = true;
      }
      this.taskMap.set(task.taskId, task);
      this.queue.push(task);
      ids.push(task.taskId);
      // 文件夹上传：子文件不逐个同步到 store，只更新文件夹级聚合条目
      if (!task.folderId) {
        this.syncToStore(task);
      }
    }

    // 文件夹上传：添加文件夹级聚合条目到 store
    if (folderInfo) {
      this.syncFolderToStore(folderInfo.id);
      // 启动周期性聚合刷新（采样速度/进度，覆盖小文件上传间隙）
      this.ensureFolderSyncTimer();
    }

    this.schedule();
    return ids;
  }

  /** Pause a specific task */
  pause(taskId: string): void {
    const task = this.taskMap.get(taskId);
    if (!task) return;
    if (task.status === 'completed' || task.status === 'paused') return;

    // Abort any in-flight request
    task.abortController?.abort();
    task.abortController = undefined;

    task.status = 'paused';
    task.speed = 0;
    this.syncToStore(task);
  }

  /** Pause all active tasks */
  pauseAll(): void {
    for (const task of this.taskMap.values()) {
      if (task.status === 'uploading' || task.status === 'hashing' || task.status === 'checking' || task.status === 'merging') {
        this.pause(task.taskId);
      }
    }
  }

  /** Resume a paused task */
  resume(taskId: string): void {
    const task = this.taskMap.get(taskId);
    if (!task || task.status !== 'paused') return;

    task.status = 'pending';
    task.error = undefined;
    this.syncToStore(task);

    // Re-enter the queue if not already there and not in active pool
    if (!this.queue.some(t => t.taskId === taskId) && !this.activePool.has(taskId)) {
      this.queue.push(task);
    }

    this.schedule();
  }

  /** Cancel and remove a task entirely */
  cancel(taskId: string): void {
    const task = this.taskMap.get(taskId);
    if (!task) return;

    // 清理进度节流定时器，避免取消后定时器触发把任务重新加回列表（幽灵任务）
    this.clearSyncTimer(taskId);

    const folderId = task.folderId;

    task.abortController?.abort();
    this.taskMap.delete(task.taskId);
    this.queue = this.queue.filter(t => t.taskId !== taskId);
    this.activePool.delete(task.taskId);
    this.speedTrackers.delete(task.taskId);

    // 文件夹子文件不在 store 中，只需更新文件夹级聚合条目
    if (folderId) {
      this.syncFolderToStore(folderId);
    } else {
      getStore().removeTransferItem(task.taskId);
    }

    // fire-and-forget 清理服务端分片（失败由 24h 过期机制兜底）
    const identifier = task.quickHash || task.fileHash;
    if (identifier) {
      fetchCancelUploadChunks({ identifier }).catch(() => {
        // 网络失败不做处理
      });
    }
  }

  /** Retry a failed task */
  retry(taskId: string): void {
    const task = this.taskMap.get(taskId);
    if (!task || task.status !== 'failed') return;

    task.status = 'pending';
    task.error = undefined;
    task.retryCount = 0;
    this.syncToStore(task);

    if (!this.queue.some(t => t.taskId === taskId)) {
      this.queue.push(task);
    }

    this.schedule();
  }

  /** Get a task by ID */
  getTask(taskId: string): Api.Disk.UploadTask | undefined {
    return this.taskMap.get(taskId);
  }

  /** Get all tasks belonging to a folder (for panel expansion) */
  getFolderTasks(folderId: string): Api.Disk.UploadTask[] {
    const tasks: Api.Disk.UploadTask[] = [];
    for (const task of this.taskMap.values()) {
      if (task.folderId === folderId) {
        tasks.push(task);
      }
    }
    return tasks;
  }

  /** Get all tasks */
  getAllTasks(): Api.Disk.UploadTask[] {
    return Array.from(this.taskMap.values());
  }

  /** Clear completed tasks. Folder child tasks stay in taskMap for aggregate counting. */
  clearCompleted(): void {
    for (const task of this.taskMap.values()) {
      if (task.status === 'completed') {
        if (task.folderId) {
          // 文件夹子文件：保留在 taskMap 中以维持聚合计数
          // 仅在用户手动清除文件夹传输条目时才清除（通过 clearFolderTasks）
        } else {
          getStore().removeTransferItem(task.taskId);
          this.taskMap.delete(task.taskId);
        }
      }
    }
  }

  /** Clear all tasks belonging to a completed folder (called when user dismisses folder item). */
  clearFolderTasks(folderId: string): void {
    for (const task of this.taskMap.values()) {
      if (task.folderId === folderId) {
        this.taskMap.delete(task.taskId);
      }
    }
    getStore().removeTransferItem(folderId);
  }

  // ---------------------------------------------------------------------------
  // Scheduling
  // ---------------------------------------------------------------------------

  /** Schedule tasks from the queue up to maxConcurrent */
  private schedule(): void {
    while (this.activePool.size < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift()!;
      if (task.status !== 'pending') continue;

      this.activePool.add(task.taskId);
      this.processTask(task).catch(() => {
        // processTask handles its own errors
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Task lifecycle
  // ---------------------------------------------------------------------------

  /** Create a new upload task from a file */
  private createTask(
    file: File,
    parentId: number,
    folderInfo?: { id: string; name: string },
    explicitRelativePath?: string
  ): Api.Disk.UploadTask {
    return {
      taskId: generateId(),
      file,
      fileName: file.name,
      fileSize: file.size,
      fileType: getFileExtension(file.name),
      parentId,
      fileHash: '',
      status: 'pending',
      progress: 0,
      transferredSize: 0,
      speed: 0,
      remainingTime: 0,
      uploadedChunks: [],
      totalChunks: 1,
      retryCount: 0,
      abortController: undefined,
      error: undefined,
      folderId: folderInfo?.id,
      folderName: folderInfo?.name,
      relativePath: explicitRelativePath || file.webkitRelativePath || undefined
    };
  }

  /** Main task processing state machine */
  private async processTask(task: Api.Disk.UploadTask): Promise<void> {
    try {
      // Phase 0: Quick check — 秒传预检（< 100ms）
      const instantUpload = await this.quickCheckPhase(task);
      if (instantUpload) {
        task.status = 'completed';
        task.progress = 100;
        task.transferredSize = task.fileSize;
        this.syncToStore(task);
        this.finishTask(task.taskId);
        return;
      }

      // Phase 1: Hash-while-upload for large files, full hash for small files
      if (needsChunking(task.fileSize)) {
        // Hash-while-upload: skip separate hash pass, compute MD5 incrementally during chunk upload
        // quickHash already computed by quickCheckPhase, use as upload session identifier
        const quickHash = task.quickHash!;

        // Quick resume check using quickHash as identifier
        const quickCheck = await this.checkPhaseWithHash(task, quickHash);

        // Pre-compute totalChunks so progress display is accurate even for resume/merge paths
        const chunkSize = await getChunkSize(task.fileSize);
        task.totalChunks = getTotalChunks(task.fileSize, chunkSize);

        if (quickCheck.merge) {
          // 分片已存在，跳过上传直接合并。identifier 置空，由后端自行计算完整 MD5
          task.fileHash = '';
          if (quickCheck.resume && quickCheck.resume.length > 0) {
            task.uploadedChunks = [...quickCheck.resume];
          }
          this.recalcChunkProgress(task);
          await this.mergePhase(task);
        } else {
          if (quickCheck.resume && quickCheck.resume.length > 0) {
            task.uploadedChunks = [...quickCheck.resume];
            this.recalcChunkProgress(task);
          }
          // Upload with quickHash as temporary identifier; backend computes full MD5 during merge
          await this.uploadChunkedPhase(task);
          // Set fileHash to empty so mergePhase sends empty identifier — backend will compute actual MD5
          task.fileHash = '';
          await this.mergePhase(task);
        }
      } else {
        // Small files: skip full MD5, use quickHash as identifier
        // Backend will compute actual MD5 server-side
        task.fileHash = task.quickHash!;

        // Phase 2: Check (instant upload / resume)
        const checkResult = await this.checkPhaseWithHash(task, task.quickHash!);

        if (checkResult.pass && checkResult.exist) {
          // File already exists on server (instant upload / 秒传)
          task.status = 'completed';
          task.progress = 100;
          task.transferredSize = task.fileSize;
          this.syncToStore(task);
          this.finishTask(task.taskId);
          return;
        }

        if (checkResult.merge) {
          await this.mergePhase(task);
        } else {
          await this.uploadWholePhase(task);
        }
      }

      task.status = 'completed';
      task.progress = 100;
      task.transferredSize = task.fileSize;
      task.speed = 0;
      task.remainingTime = 0;
      this.syncToStore(task);
      this.finishTask(task.taskId);
    } catch (error: unknown) {
      // Ignore abort errors from cancel
      if (isCancel(error)) {
        this.finishTask(task.taskId);
        return;
      }

      // pause() sets status to 'paused' before abort propagates here
      // Release the active slot without marking as failed so resume can re-queue
      if (task.status === 'paused') {
        this.finishTask(task.taskId);
        return;
      }

      // cancel() removes from taskMap before abort propagates
      if (!this.taskMap.has(task.taskId)) {
        this.finishTask(task.taskId);
        return;
      }

      const message = getErrorMessage(error, '上传失败');
      task.status = 'failed';
      task.error = message;
      task.speed = 0;
      this.syncToStore(task);
      this.finishTask(task.taskId);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase: Quick check (秒传预检)
  // ---------------------------------------------------------------------------

  private async quickCheckPhase(task: Api.Disk.UploadTask): Promise<boolean> {
    try {
      const quickHash = await computeQuickHash(task.file!);
      task.quickHash = quickHash;

      // strongHash 失败不影响主流程（crypto.subtle 在非 HTTPS 环境可能不可用）
      try {
        task.strongHash = await computeStrongHash(task.file!);
      } catch {
        // strongHash 可选，跳过
      }

      const userId = getUserId();
      const currentDirectory = getCurrentDirectory();

      const { data } = await fetchCheckFile({
        identifier: quickHash,
        quickHash,
        strongHash: task.strongHash,
        fileName: task.fileName,
        totalSize: task.fileSize,
        totalChunks: 1,
        userId,
        currentDirectory,
        relativePath: task.relativePath || task.fileName,
        isFolder: !!task.folderId,
        folderPath: task.folderName,
        override: task.override ?? false
      });

      // 同用户秒传命中（override=true 时后端不会秒传，所以此处安全）
      if (data?.pass === true && data?.exist === true) return true;
      // 跨用户秒传待验证：上传首尾采样由服务端实测哈希，通过则秒传成功
      if (data?.crossUserVerify) {
        return await this.verifyCrossUserPhase(task, data.crossUserVerify);
      }
      return false;
    } catch {
      return false;
    }
  }

  /** 跨用户秒传实测验证：上传首尾各 2MB 采样由服务端实测哈希，通过则复用（信任锚服务端化） */
  private async verifyCrossUserPhase(task: Api.Disk.UploadTask, info: Api.Disk.CrossUserVerifyInfo): Promise<boolean> {
    try {
      const SAMPLE = 2 * 1024 * 1024;
      const file = task.file!;
      const head = file.slice(0, Math.min(SAMPLE, file.size));
      const tail = file.size > SAMPLE ? file.slice(file.size - SAMPLE) : new Blob();
      await fetchVerifyCrossUserInstantUpload({
        head,
        tail,
        userId: getUserId(),
        fileId: info.fileId,
        filename: task.fileName,
        currentDirectory: getCurrentDirectory(),
        relativePath: task.relativePath || task.fileName,
        isFolder: !!task.folderId,
        folderPath: task.folderName,
        fileSize: task.fileSize,
        override: task.override ?? false
      });
      return true;
    } catch {
      // 验证失败/网络错误 → 降级正常上传
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Phase: Hash
  // ---------------------------------------------------------------------------

  private async hashPhase(task: Api.Disk.UploadTask): Promise<void> {
    task.status = 'hashing';
    this.syncToStore(task);

    const abortController = new AbortController();
    task.abortController = abortController;

    const fileHash = await computeFileHash(task.file!, undefined, abortController.signal);

    if (abortController.signal.aborted) {
      throw new Error('Aborted');
    }

    task.fileHash = fileHash;
  }

  // ---------------------------------------------------------------------------
  // Phase: Check (instant upload / resume)
  // ---------------------------------------------------------------------------

  private async checkPhase(task: Api.Disk.UploadTask): Promise<Api.Disk.FileCheckResponse> {
    task.status = 'checking';
    task.progress = 0;
    this.syncToStore(task);

    const userId = getUserId();
    const currentDirectory = getCurrentDirectory();

    const { data, error } = await fetchCheckFile({
      identifier: task.fileHash,
      quickHash: task.quickHash,
      strongHash: task.strongHash,
      fileName: task.fileName,
      totalSize: task.fileSize,
      totalChunks: needsChunking(task.fileSize) ? getTotalChunks(task.fileSize, await getChunkSize(task.fileSize)) : 1,
      userId,
      currentDirectory,
      relativePath: task.relativePath || task.fileName,
      isFolder: !!task.folderId,
      folderPath: task.folderName,
      override: task.override ?? false
    });

    if (error || !data) {
      // On check failure, proceed with upload anyway
      return { pass: false, exist: false, resume: [], upload: true, merge: false };
    }

    return data;
  }

  /** Variant of checkPhase that uses an explicit hash value (quickHash or full MD5) */
  private async checkPhaseWithHash(task: Api.Disk.UploadTask, hash: string): Promise<Api.Disk.FileCheckResponse> {
    const userId = getUserId();
    const currentDirectory = getCurrentDirectory();

    const { data, error } = await fetchCheckFile({
      identifier: hash,
      quickHash: task.quickHash,
      strongHash: task.strongHash,
      fileName: task.fileName,
      totalSize: task.fileSize,
      totalChunks: needsChunking(task.fileSize) ? getTotalChunks(task.fileSize, await getChunkSize(task.fileSize)) : 1,
      userId,
      currentDirectory,
      relativePath: task.relativePath || task.fileName,
      isFolder: !!task.folderId,
      folderPath: task.folderName,
      override: task.override ?? false
    });

    if (error || !data) {
      return { pass: false, exist: false, resume: [], upload: true, merge: false };
    }

    return data;
  }

  // ---------------------------------------------------------------------------
  // Phase: Whole file upload (small files < 10MB)
  // ---------------------------------------------------------------------------

  private async uploadWholePhase(task: Api.Disk.UploadTask): Promise<void> {
    task.status = 'uploading';
    this.syncToStore(task);

    const abortController = new AbortController();
    task.abortController = abortController;

    this.initSpeedTracker(task.taskId);

    const userId = getUserId();
    const currentDirectory = getCurrentDirectory();

    const { error } = await fetchUploadChunk({
      file: task.file!,
      identifier: task.fileHash,
      chunkNumber: 0,
      chunkSize: task.fileSize,
      currentChunkSize: task.fileSize,
      totalSize: task.fileSize,
      fileName: task.fileName,
      relativePath: task.relativePath || task.fileName,
      totalChunks: 1,
      userId,
      currentDirectory,
      isFolder: !!task.folderId,
      folderPath: task.folderName,
      strongHash: task.strongHash,
      quickHash: task.quickHash,
      override: task.override ?? false
    });

    if (abortController.signal.aborted) {
      throw new Error('Aborted');
    }

    if (error) {
      throw new Error(getErrorMessage(error, '上传失败'));
    }

    task.transferredSize = task.fileSize;
    task.progress = 100;
    this.updateSpeed(task, task.transferredSize);
    this.syncToStore(task);
  }

  // ---------------------------------------------------------------------------
  // Phase: Chunked upload
  // ---------------------------------------------------------------------------

  private async uploadChunkedPhase(task: Api.Disk.UploadTask): Promise<void> {
    const abortController = new AbortController();
    task.abortController = abortController;

    const chunkSize = await getChunkSize(task.fileSize);
    task.totalChunks = getTotalChunks(task.fileSize, chunkSize);

    task.chunkHashes = Array.from({ length: task.totalChunks }).fill('') as string[];

    this.initSpeedTracker(task.taskId);

    // Determine which chunks still need uploading
    const pendingChunks: number[] = [];
    for (let i = 0; i < task.totalChunks; i += 1) {
      if (!task.uploadedChunks.includes(i)) {
        pendingChunks.push(i);
      }
    }

    task.status = 'uploading';
    this.syncToStore(task);

    await this.uploadChunksWithConcurrency(task, pendingChunks, chunkSize, abortController.signal);
  }

  /** Upload pending chunks with bounded concurrency */
  private async uploadChunksWithConcurrency(
    task: Api.Disk.UploadTask,
    chunkIndices: number[],
    chunkSize: number,
    signal: AbortSignal
  ): Promise<void> {
    const executing: Promise<void>[] = [];
    let idx = 0;

    const uploadNext = async (): Promise<void> => {
      while (idx < chunkIndices.length) {
        if (signal.aborted) return;

        const currentIndex = idx;
        idx += 1;
        const chunkIndex = chunkIndices[currentIndex];

        await this.uploadSingleChunk(task, chunkIndex, chunkSize, signal);
      }
    };

    const concurrency = Math.min(await getConcurrency(), chunkIndices.length);
    for (let i = 0; i < concurrency; i += 1) {
      executing.push(uploadNext());
    }

    await Promise.all(executing);

    if (signal.aborted) {
      throw new Error('Aborted');
    }
  }

  /** Upload a single chunk with retry logic */
  private async uploadSingleChunk(
    task: Api.Disk.UploadTask,
    chunkIndex: number,
    chunkSize: number,
    signal: AbortSignal
  ): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= CHUNK_MAX_RETRIES; attempt += 1) {
      if (signal.aborted) return;

      try {
        const chunk = sliceChunk(task.file!, chunkIndex, chunkSize);
        const currentChunkSize = chunk.size;

        // 计算单个分片的 MD5（Web Worker，不阻塞主线程），用于服务端写入后校验
        const chunkHash = await computeChunkHash(chunk);

        // Record chunk hash
        if (task.chunkHashes) {
          task.chunkHashes[chunkIndex] = chunkHash;
        }

        const userId = getUserId();
        const currentDirectory = getCurrentDirectory();

        // Use quickHash as identifier during upload phase (hash-while-upload)
        const identifier = task.quickHash || task.fileHash;

        const { error } = await fetchUploadChunk({
          file: chunk,
          identifier,
          chunkNumber: chunkIndex,
          chunkSize,
          currentChunkSize,
          totalSize: task.fileSize,
          fileName: task.fileName,
          relativePath: task.relativePath || task.fileName,
          totalChunks: task.totalChunks,
          userId,
          currentDirectory,
          isFolder: !!task.folderId,
          folderPath: task.folderName,
          chunkHash,
          strongHash: task.strongHash,
          quickHash: task.quickHash,
          override: task.override ?? false
        });

        if (error) {
          throw new Error(getErrorMessage(error, '分片上传失败'));
        }

        // 上传期间若已被取消/暂停，本次成功结果不可信（后端是否真正持久化该分片未知），
        // 不记入本地 uploadedChunks——resume 时由后端 checkPhase 返回的真实 resume 列表校正：
        // 后端已落盘的分片会出现在 resume 列表里(不会漏传)，本地也不信任 abort 后的状态(不会误信)。
        if (signal.aborted) return;

        // Record uploaded chunk
        task.uploadedChunks = [...task.uploadedChunks, chunkIndex];

        // Throttle per-chunk progress sync: 200ms 内最多触发一次 store 更新
        const tid = this.syncTimers.get(task.taskId);
        if (tid) clearTimeout(tid);
        this.syncTimers.set(task.taskId, setTimeout(() => {
          this.syncTimers.delete(task.taskId);
          this.recalcChunkProgress(task);
          this.updateSpeed(task, task.transferredSize);
          this.syncToStore(task);
        }, 200));
        return;
      } catch (error: unknown) {
        if (isCancel(error) || signal.aborted) return;

        lastError = new Error(getErrorMessage(error, '分片上传失败'));

        // 4xx 确定性错误（非 408/429）立即失败，不重试
        if (!isRetryableError(error)) break;

        if (attempt < CHUNK_MAX_RETRIES) {
          await sleep(retryDelay(attempt));
        }
      }
    }

    throw lastError ?? new Error(`分片 ${chunkIndex} 上传失败`);
  }

  // ---------------------------------------------------------------------------
  // Phase: Merge
  // ---------------------------------------------------------------------------

  private async mergePhase(task: Api.Disk.UploadTask): Promise<void> {
    task.status = 'merging';
    this.syncToStore(task);

    // 监听后端 SSE 合并进度 — 后端使用 identifier 或 uploadId 发送进度
    const sseMatchId = task.fileHash || task.quickHash;
    const offSSE = onSSEMessage('merge_progress', msg => {
      const data = msg.data as { identifier?: string; userId?: number; progress?: number; phase?: string } | undefined;
      if (data && data.identifier === sseMatchId && data.userId === Number(useAuthStore().userInfo.userId) && typeof data.progress === 'number') {
        task.progress = data.progress;
        this.syncToStore(task);
      }
    });

    // 为合并请求创建独立的 AbortController，使取消/暂停能中止合并
    task.abortController = new AbortController();

    const userId = getUserId();
    const currentDirectory = getCurrentDirectory();

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MERGE_MAX_RETRIES; attempt += 1) {
      if (task.abortController.signal.aborted) break;
      try {
        const { error } = await fetchMergeChunks({
          identifier: task.fileHash,
          fileName: task.fileName,
          totalSize: task.fileSize,
          totalChunks: task.totalChunks,
          userId,
          currentDirectory,
          relativePath: task.relativePath || task.fileName,
          isFolder: !!task.folderId,
          folder: task.folderName || '',
          override: task.override ?? false,
          uploadId: task.quickHash,
          strongHash: task.strongHash,
          signal: task.abortController.signal
        } as Api.Disk.MergeChunksParams & { signal: AbortSignal });

        if (error) {
          throw new Error(getErrorMessage(error, '合并分片失败'));
        }

        offSSE();
        return;
      } catch (error: unknown) {
        lastError = new Error(getErrorMessage(error, '合并分片失败'));

        // 4xx 确定性错误立即失败，不重试
        if (!isRetryableError(error)) break;

        if (attempt < MERGE_MAX_RETRIES) {
          await sleep(retryDelay(attempt));
        }
      }
    }

    offSSE();
    throw lastError ?? new Error('合并分片失败');
  }

  // ---------------------------------------------------------------------------
  // Speed tracking
  // ---------------------------------------------------------------------------

  private initSpeedTracker(taskId: string): void {
    this.speedTrackers.set(taskId, {
      lastTime: Date.now(),
      lastTransferred: 0,
      emaSpeed: 0,
      samples: []
    });
  }

  /** Update speed and remaining time for a task using EMA smoothing */
  private updateSpeed(task: Api.Disk.UploadTask, currentTransferred: number): void {
    const tracker = this.speedTrackers.get(task.taskId);
    if (!tracker) return;

    const now = Date.now();
    const elapsed = now - tracker.lastTime;

    if (elapsed > 0) {
      const bytesDelta = currentTransferred - tracker.lastTransferred;
      tracker.samples.push({ time: elapsed, bytes: bytesDelta });

      // Keep only samples within the speed window
      let windowTotal = 0;
      const recentSamples: { time: number; bytes: number }[] = [];
      for (let i = tracker.samples.length - 1; i >= 0; i -= 1) {
        windowTotal += tracker.samples[i].time;
        recentSamples.unshift(tracker.samples[i]);
        if (windowTotal >= SPEED_WINDOW) break;
      }
      tracker.samples = recentSamples;

      // Windowed instant speed
      const totalBytes = tracker.samples.reduce((sum, s) => sum + s.bytes, 0);
      const totalTime = tracker.samples.reduce((sum, s) => sum + s.time, 0);

      if (totalTime > 0) {
        const instantSpeed = (totalBytes / totalTime) * 1000;

        // EMA: smooth out jitter — first sample seeds the value
        if (tracker.emaSpeed === 0) {
          tracker.emaSpeed = instantSpeed;
        } else {
          tracker.emaSpeed = SPEED_EMA_ALPHA * instantSpeed + (1 - SPEED_EMA_ALPHA) * tracker.emaSpeed;
        }

        task.speed = Math.round(tracker.emaSpeed);
        const remaining = task.fileSize - currentTransferred;
        task.remainingTime = task.speed > 0 ? Math.round(remaining / tracker.emaSpeed) : 0;
      }
    }

    tracker.lastTime = now;
    tracker.lastTransferred = currentTransferred;
  }

  // ---------------------------------------------------------------------------
  // Progress helpers
  // ---------------------------------------------------------------------------

  /** Recalculate progress based on uploaded chunks (0-100%) */
  private recalcChunkProgress(task: Api.Disk.UploadTask): void {
    if (task.totalChunks === 0) return;
    const uploadedCount = task.uploadedChunks.length;
    task.transferredSize = Math.round((uploadedCount / task.totalChunks) * task.fileSize);
    task.progress = Math.round((uploadedCount / task.totalChunks) * 100);
  }

  // ---------------------------------------------------------------------------
  // Store sync
  // ---------------------------------------------------------------------------

  /** Map UploadTask to TransferItem and sync to disk store.
   *  For folder tasks, delegates to syncFolderToStore (aggregate update). */
  private syncToStore(task: Api.Disk.UploadTask): void {
    // 文件夹上传的子文件 → 更新文件夹级聚合条目
    if (task.folderId) {
      this.syncFolderToStore(task.folderId);
      return;
    }

    const store = getStore();

    const existing = store.transferList.find(item => item.transferId === task.taskId);

    const transferItem: Api.Disk.TransferItem = {
      transferId: task.taskId,
      fileName: task.fileName,
      fileType: task.fileType,
      transferType: 'upload',
      status: (task.status === 'uploading' || task.status === 'hashing' || task.status === 'checking') ? 'transferring' : task.status,
      progress: task.progress,
      transferredSize: task.transferredSize,
      totalSize: task.fileSize,
      speed: task.speed,
      remainingTime: task.remainingTime,
      chunkProgress:
        task.totalChunks > 1
          ? `${task.uploadedChunks.length}/${task.totalChunks}`
          : undefined,
      error: task.error,
      folderId: task.folderId,
      folderName: task.folderName
    };

    if (existing) {
      store.updateTransferItem(task.taskId, transferItem);
    } else {
      store.addTransferItem(transferItem);
    }
  }

  /** Sync folder-level aggregate TransferItem to disk store.
   *  Collects all tasks with the same folderId from taskMap and computes aggregate progress/status. */
  private syncFolderToStore(folderId: string): void {
    const store = getStore();

    // Collect all child tasks belonging to this folder
    const childTasks: Api.Disk.UploadTask[] = [];
    for (const task of this.taskMap.values()) {
      if (task.folderId === folderId) {
        childTasks.push(task);
      }
    }

    if (childTasks.length === 0) {
      // All child tasks removed (e.g. all cancelled) → remove folder item from store
      store.removeTransferItem(folderId);
      return;
    }

    const totalCount = childTasks.length;
    const completedCount = childTasks.filter(t => t.status === 'completed').length;
    const failedCount = childTasks.filter(t => t.status === 'failed').length;
    const pausedCount = childTasks.filter(t => t.status === 'paused').length;

    // Aggregate status
    let status: Api.Disk.TransferItem['status'] = 'transferring';
    if (completedCount === totalCount) status = 'completed';
    else if (pausedCount === totalCount) status = 'paused';
    else if (failedCount > 0) status = 'failed';

    // Aggregate progress: weighted by file size
    const folderTotalSize = childTasks.reduce((sum, t) => sum + t.fileSize, 0);
    const folderTransferredSize = childTasks.reduce((sum, t) => sum + t.transferredSize, 0);
    const progress = folderTotalSize > 0
      ? Math.round((folderTransferredSize / folderTotalSize) * 100)
      : Math.round(childTasks.reduce((sum, t) => sum + t.progress, 0) / totalCount);

    // Folder-level speed: measure aggregate transferred bytes over time (EMA smoothing)
    // 比累加各子任务瞬时速度更稳定——小文件上传太快，子任务 speed 常为 0
    const hasActive = childTasks.some(t => t.status === 'uploading' || t.status === 'hashing' || t.status === 'checking');
    const speed = this.updateFolderSpeed(folderId, folderTransferredSize, status === 'completed' || !hasActive);

    // Remaining time estimate
    const remainingSize = folderTotalSize - folderTransferredSize;
    const remainingTime = speed > 0 ? Math.round(remainingSize / speed) : 0;

    // Get folder name from first child task
    const folderName = childTasks[0]?.folderName || '文件夹';

    const transferItem: Api.Disk.TransferItem = {
      transferId: folderId,
      fileName: folderName,
      fileType: 'folder',
      transferType: 'upload',
      status,
      progress,
      transferredSize: folderTransferredSize,
      totalSize: 0, // individual file sizes tracked in folderTotalSize
      speed,
      remainingTime,
      error: failedCount > 0 ? `${failedCount}个文件上传失败` : undefined,
      folderId,
      folderName,
      completedCount,
      totalCount,
      folderTotalSize,
      folderTransferredSize
    };

    const existing = store.transferList.find(item => item.transferId === folderId);
    if (existing) {
      store.updateTransferItem(folderId, transferItem);
    } else {
      store.addTransferItem(transferItem);
    }
  }

  /** Update folder-level speed using EMA smoothing on aggregate transferred bytes.
   *  Returns smoothed speed (bytes/sec). When stopped, returns 0 and clears tracker. */
  private updateFolderSpeed(folderId: string, currentTransferred: number, stopped: boolean): number {
    if (stopped) {
      this.folderSpeedTrackers.delete(folderId);
      return 0;
    }

    const now = Date.now();
    let tracker = this.folderSpeedTrackers.get(folderId);
    if (!tracker) {
      tracker = { lastTime: now, lastTransferred: currentTransferred, emaSpeed: 0 };
      this.folderSpeedTrackers.set(folderId, tracker);
      return 0;
    }

    const elapsed = now - tracker.lastTime;
    // 至少 400ms 才采样一次，避免高频 syncToStore 导致速度抖动
    if (elapsed >= 400) {
      const delta = currentTransferred - tracker.lastTransferred;
      if (delta > 0) {
        const instantSpeed = (delta / elapsed) * 1000;
        tracker.emaSpeed = tracker.emaSpeed === 0
          ? instantSpeed
          : 0.4 * instantSpeed + 0.6 * tracker.emaSpeed;
      }
      tracker.lastTime = now;
      tracker.lastTransferred = currentTransferred;
    }

    return Math.round(tracker.emaSpeed);
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /** Release an active slot and trigger scheduling */
  private finishTask(taskId: string): void {
    // 任务结束前 flush 进度节流，确保最终状态同步到 store，避免定时器残留覆盖完成态
    this.clearSyncTimer(taskId);
    const flushTask = this.taskMap.get(taskId);
    if (flushTask) {
      // 仅对进行中的任务（如暂停态）重新计算分片进度。
      // 已完成/失败任务的进度已由上传阶段正确设置（progress=100/transferredSize=fileSize），
      // recalcChunkProgress 基于 uploadedChunks 计算，而 uploadWholePhase（小文件整体上传）不维护
      // uploadedChunks，会错误地把已完成文件进度重置为 0，导致文件夹聚合进度始终为 0%。
      if (flushTask.status !== 'completed' && flushTask.status !== 'failed') {
        this.recalcChunkProgress(flushTask);
      }
      this.syncToStore(flushTask);
    }
    this.activePool.delete(taskId);
    this.speedTrackers.delete(taskId);
    const task = this.taskMap.get(taskId);
    if (task) {
      task.abortController = undefined;
      // 仅对已完成/已取消的任务释放 File 引用；失败任务保留引用以便 retry
      if (task.status !== 'failed') {
        task.file = null;
      }
    }
    this.schedule();
  }
}
