import { isCancel } from 'axios';
import type { AxiosError } from 'axios';
import SparkMD5 from 'spark-md5';
import { fetchCheckFile, fetchMergeChunks, fetchUploadChunk } from '@/service/api/disk/file';
import { useDiskStore } from '@/store/modules/disk';
import { useAuthStore } from '@/store/modules/auth';
import { computeFileHash, computeQuickHash, computeStrongHash } from './instant-check';
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

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
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
      this.syncToStore(task);
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

    task.abortController?.abort();
    this.taskMap.delete(task.taskId);
    this.queue = this.queue.filter(t => t.taskId !== taskId);
    this.activePool.delete(task.taskId);
    this.speedTrackers.delete(task.taskId);

    getStore().removeTransferItem(task.taskId);
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

  /** Get all tasks */
  getAllTasks(): Api.Disk.UploadTask[] {
    return Array.from(this.taskMap.values());
  }

  /** Clear completed tasks */
  clearCompleted(): void {
    for (const task of this.taskMap.values()) {
      if (task.status === 'completed') {
        this.taskMap.delete(task.taskId);
        getStore().removeTransferItem(task.taskId);
      }
    }
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
      const quickHash = await computeQuickHash(task.file);
      task.quickHash = quickHash;

      // strongHash 失败不影响主流程（crypto.subtle 在非 HTTPS 环境可能不可用）
      try {
        task.strongHash = await computeStrongHash(task.file);
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
        folderPath: task.folderName
      });

      return data?.pass === true && data?.exist === true;
    } catch {
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

    const fileHash = await computeFileHash(task.file, undefined, abortController.signal);

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
      folderPath: task.folderName
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
      folderPath: task.folderName
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
      file: task.file,
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
      quickHash: task.quickHash
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
        const chunk = sliceChunk(task.file, chunkIndex, chunkSize);
        const currentChunkSize = chunk.size;

        // 计算单个分片的 MD5，用于服务端写入后校验
        const chunkArrayBuffer = await chunk.arrayBuffer();

        const chunkSpark = new SparkMD5.ArrayBuffer();
        chunkSpark.append(chunkArrayBuffer);
        const chunkHash = chunkSpark.end();

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
          quickHash: task.quickHash
        });

        if (error) {
          throw new Error(getErrorMessage(error, '分片上传失败'));
        }

        // Record uploaded chunk (always track for resume, even if paused)
        task.uploadedChunks = [...task.uploadedChunks, chunkIndex];

        // Suppress progress update if task was paused mid-flight
        if (signal.aborted) return;

        this.recalcChunkProgress(task);
        this.updateSpeed(task, task.transferredSize);
        this.syncToStore(task);
        return;
      } catch (error: unknown) {
        if (isCancel(error) || signal.aborted) return;

        lastError = new Error(getErrorMessage(error, '分片上传失败'));

        if (attempt < CHUNK_MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY * 2 ** attempt; // 1s, 2s, 4s
          await sleep(delay);
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
      const data = msg.data as { identifier?: string; progress?: number; phase?: string } | undefined;
      if (data && data.identifier === sseMatchId && typeof data.progress === 'number') {
        task.progress = data.progress;
        this.syncToStore(task);
      }
    });

    const userId = getUserId();
    const currentDirectory = getCurrentDirectory();

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MERGE_MAX_RETRIES; attempt += 1) {
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
          strongHash: task.strongHash
        });

        if (error) {
          throw new Error(getErrorMessage(error, '合并分片失败'));
        }

        offSSE();
        return;
      } catch (error: unknown) {
        lastError = new Error(getErrorMessage(error, '合并分片失败'));

        if (attempt < MERGE_MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY * 2 ** attempt;
          await sleep(delay);
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

  /** Map UploadTask to TransferItem and sync to disk store */
  private syncToStore(task: Api.Disk.UploadTask): void {
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

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /** Release an active slot and trigger scheduling */
  private finishTask(taskId: string): void {
    this.activePool.delete(taskId);
    this.speedTrackers.delete(taskId);
    const task = this.taskMap.get(taskId);
    if (task) {
      task.abortController = undefined;
    }
    this.schedule();
  }
}
