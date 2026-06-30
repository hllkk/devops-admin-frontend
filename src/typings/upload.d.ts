declare namespace Api {
  namespace Disk {
    /** 上传配置（从后端获取） */
    type UploadConfig = {
      /** 分片并发上传数 */
      chunkConcurrency: number;
      /** 10-100MB 文件分片大小 (MB) */
      chunkSizeSmall: number;
      /** 100MB-1GB 文件分片大小 (MB) */
      chunkSizeMedium: number;
      /** 1-5GB 文件分片大小 (MB) */
      chunkSizeLarge: number;
      /** >5GB 文件分片大小 (MB) */
      chunkSizeHuge?: number;
      /** 最大上传大小 (MB)，联动网盘系统设置 */
      maxUploadSize?: number;
    };

    /** 上传任务状态 */
    type UploadTaskStatus =
      | 'pending'
      | 'hashing'
      | 'checking'
      | 'uploading'
      | 'merging'
      | 'paused'
      | 'completed'
      | 'failed';

    /** 秒传/断点检测请求参数 (匹配后端 FileUploadRequest query) */
    type FileCheckParams = {
      /** 文件MD5标识 */
      identifier: string;
      /** 文件名 */
      fileName: string;
      /** 文件总大小 */
      totalSize: number;
      /** 总分片数 */
      totalChunks: number;
      /** 当前用户ID */
      userId: number;
      /** 当前目录 */
      currentDirectory?: string;
      /** 相对路径 */
      relativePath?: string;
      /** 是否文件夹 */
      isFolder?: boolean;
      /** 文件夹路径 */
      folderPath?: string;
      /** 快速指纹（首尾采样 MD5，用于秒传预检） */
      quickHash?: string;
      /** SHA-256 强指纹（与 quickHash 配合消除碰撞风险） */
      strongHash?: string;
      /** 是否覆盖同名文件（覆盖时跳过秒传，强制重新上传） */
      override?: boolean;
    };

    /** 秒传/断点检测响应 (匹配后端 CheckFileExistResponse) */
    type FileCheckResponse = {
      /** 是否秒传通过（文件已存在） */
      pass: boolean;
      /** 文件是否存在 */
      exist: boolean;
      /** 已上传的分片编号列表（用于断点续传） */
      resume: number[];
      /** 是否需要上传 */
      upload: boolean;
      /** 是否所有分片已上传完毕，可以合并 */
      merge: boolean;
      /** 跨用户秒传待验证信息：存在则需上传首尾采样由服务端实测后才复用（信任锚服务端化） */
      crossUserVerify?: CrossUserVerifyInfo;
    };

    /** 跨用户秒传待验证信息（匹配后端 CrossUserVerifyInfo） */
    type CrossUserVerifyInfo = {
      /** 源文件(他人)ID */
      fileId: number;
      /** 文件大小 */
      size: number;
      /** 源文件快速指纹 */
      quickHash: string;
      /** 源文件强指纹 */
      strongHash: string;
    };

    /** 分片上传参数 (匹配后端 FileUploadRequest form fields) */
    type ChunkUploadParams = {
      /** 文件分片 */
      file: Blob;
      /** 文件MD5标识 */
      identifier: string;
      /** 当前分片编号（从0开始） */
      chunkNumber: number;
      /** 标准分片大小 */
      chunkSize: number;
      /** 当前分片实际大小 */
      currentChunkSize: number;
      /** 文件总大小 */
      totalSize: number;
      /** 文件名 */
      fileName: string;
      /** 相对路径 */
      relativePath: string;
      /** 总分片数 */
      totalChunks: number;
      /** 当前用户ID */
      userId: number;
      /** 当前目录 */
      currentDirectory?: string;
      /** 是否文件夹 */
      isFolder?: boolean;
      /** 文件夹路径 */
      folderPath?: string;
      /** 单个分片的 MD5，用于写入后校验 */
      chunkHash?: string;
      /** SHA-256 强指纹 */
      strongHash?: string;
      /** 快速指纹（首尾采样 MD5） */
      quickHash?: string;
      /** 是否覆盖同名文件 */
      override?: boolean;
    };

    /** 分块去重检查请求 */
    type CheckChunksParams = {
      chunks: { index: number; hash: string }[];
    };

    /** 分块去重检查响应 */
    type CheckChunksResponse = {
      existing: number[];
    };

    /** 合并分片请求参数 (匹配后端 FileMergeRequest) */
    type MergeChunksParams = {
      /** 文件MD5标识 */
      identifier: string;
      /** 文件名 */
      fileName: string;
      /** 文件总大小 */
      totalSize: number;
      /** 总分片数 */
      totalChunks?: number;
      /** 当前用户ID */
      userId: number;
      /** 当前目录 */
      currentDirectory?: string;
      /** 相对路径 */
      relativePath?: string;
      /** 是否文件夹 */
      isFolder?: boolean;
      /** 文件夹路径 */
      folder: string;
      /** 是否覆盖 */
      override?: boolean;
      /** 上传会话ID (quickHash)，用于定位chunk目录 */
      uploadId?: string;
      /** SHA-256 强指纹 */
      strongHash?: string;
    };

    /** 合并分片响应 */
    type MergeChunksResponse = {
      fileId: string;
      url: string;
    };

    /** 上传任务（引擎内部使用） */
    type UploadTask = {
      taskId: string;
      /** 上传文件；任务结束后由引擎置 null 以释放引用，避免 taskMap 长期持有 File 导致内存累积 */
      file: File | null;
      fileName: string;
      fileSize: number;
      fileType: string;
      parentId: number;
      fileHash: string;
      status: UploadTaskStatus;
      progress: number;
      transferredSize: number;
      speed: number;
      remainingTime: number;
      uploadedChunks: number[];
      totalChunks: number;
      retryCount: number;
      abortController?: AbortController;
      error?: string;
      /** 所属文件夹分组ID */
      folderId?: string;
      /** 所属文件夹名称 */
      folderName?: string;
      /** 文件相对路径（文件夹上传时保留目录结构） */
      relativePath?: string;
      /** 是否覆盖同名文件 */
      override?: boolean;
      /** 快速指纹 (quickHash)，用于上传阶段的临时标识 */
      quickHash?: string;
      /** SHA-256 强指纹 */
      strongHash?: string;
      /** 各分片的 MD5 hash，按 chunkIndex 索引 */
      chunkHashes?: string[];
    };

  }
}
