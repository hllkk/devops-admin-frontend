/**
 * Namespace Api
 *
 * All backend api type
 */
declare namespace Api {
  /**
   * namespace Disk
   *
   * backend api module: "disk"
   */
  namespace Disk {
    /** 文件类型枚举 */
    type FileType = 'all' | 'image' | 'document' | 'video' | 'audio' | 'other' | 'shared-with-me' | 'my-shared';

    /** 文件项 */
    type FileItem = Common.CommonRecord<{
      /** 文件ID */
      fileId: CommonType.IdType;
      /** 访问记录ID（最近访问场景使用，用于删除记录而非文件） */
      recordId?: CommonType.IdType;
      /** 文件名 */
      fileName: string;
      /** 文件类型 (folder/image/document/video/audio/other) */
      fileType: string;
      /** 文件大小 (字节) */
      fileSize: number;
      /** 文件扩展名 */
      fileExtension?: string;
      /** 父文件夹ID */
      parentId: CommonType.IdType | null;
      /** 文件路径 */
      filePath: string;
      /** 修改时间 */
      modifyTime: string;
      /** 是否为文件夹 */
      isFolder: boolean;
      /** 文件URL (非文件夹) */
      fileUrl?: string;
      /** 文件图标 */
      icon?: string;
      /** 是否有媒体封面/缩略图 */
      mediaCover?: boolean;
      /** 是否显示封面 */
      showCover?: boolean;
      /** 音乐信息 */
      music?: MusicInfo;
      /** 视频信息 */
      video?: VideoInfo;
      /** MIME类型 (后端返回) */
      contentType?: string;
      /** 是否已收藏 */
      isFavorite?: boolean;
      /** 是否已分享（外链） */
      isShare?: boolean;
      /** 已共享给用户数 */
      sharedUserCount?: number;
      /** 已共享给部门数 */
      sharedDeptCount?: number;
    }> & {
      /** 兼容属性: 文件ID别名 */
      id?: CommonType.IdType;
      /** 兼容属性: 文件名别名 */
      name?: string;
      /** 兼容属性: 文件大小别名 */
      size?: number;
      /** 兼容属性: 是否文件夹别名 */
      isDir?: boolean;
      /** 兼容属性: 扩展名别名 */
      extendName?: string;
    };

    /** 音乐信息 */
    type MusicInfo = {
      /** 歌曲名称 */
      songName: string;
      /** 歌手 */
      singer: string;
      /** 专辑 */
      album: string;
      /** 封面 Base64 编码 */
      coverBase64?: string;
    };

    /** 视频信息 */
    type VideoInfo = {
      /** 视频宽度 */
      width?: number;
      /** 视频高度 */
      height?: number;
      /** 视频码率 */
      bitrate?: string;
      /** 视频格式 */
      format?: string;
      /** 视频帧率 */
      frameRate?: number;
      /** 视频时长 */
      duration?: string;
    };

    /** 文件列表响应 */
    type FileList = Common.PaginatingQueryRecord<FileItem>;

    /** 文件搜索参数 */
    type FileSearchParams = CommonType.RecordNullable<{
      /** 文件类型筛选 */
      fileType: FileType | null;
      /** 搜索关键词 */
      keyword: string | null;
      /** 父文件夹ID */
      parentId: CommonType.IdType | null;
      /** 排序字段 */
      sortField: 'name' | 'size' | 'modifyTime' | 'type' | null;
      /** 排序方式 */
      sortOrder: 'asc' | 'desc' | null;
      /** 分页参数 */
      pageNum: number;
      pageSize: number;
    }>;

    /** 上传文件参数 */
    type UploadFileParams = {
      /** 文件 */
      file: File;
      /** 目标文件夹ID */
      parentId: CommonType.IdType | null;
    };

    /** 新建文件夹参数 */
    type CreateFolderParams = {
      /** 文件夹名称 */
      fileName: string;
      /** 当前目录路径 */
      folderPath: string;
    };

    /** 新建文件参数 */
    type CreateFileParams = {
      /** 文件名（含扩展名） */
      fileName: string;
      /** 当前目录路径 */
      folderPath: string;
    };

    /** 传输项 */
    type TransferItem = {
      /** 传输ID */
      transferId: string;
      /** 文件名 */
      fileName: string;
      /** 文件类型 */
      fileType: string;
      /** 传输类型 (upload/download) */
      transferType: 'upload' | 'download';
      /** 传输状态 */
      status: 'pending' | 'hashing' | 'checking' | 'uploading' | 'transferring' | 'merging' | 'paused' | 'completed' | 'failed';
      /** 进度百分比 */
      progress: number;
      /** 已传输大小 */
      transferredSize: number;
      /** 总大小 */
      totalSize: number;
      /** 传输速度 */
      speed: number;
      /** 剩余时间 */
      remainingTime: number;
      /** 分片进度描述 */
      chunkProgress?: string;
      /** 错误信息 */
      error?: string;
      /** 所属文件夹分组ID */
      folderId?: string;
      /** 所属文件夹名称 */
      folderName?: string;
    };

    /** 面包屑项 */
    type BreadcrumbItem = {
      /** 文件夹ID (null表示根目录) */
      fileId: CommonType.IdType | null;
      /** 文件夹名称 */
      fileName: string;
      /** 路径字符串 */
      filePath: string;
    };

    /** 路径解析响应 */
    type PathResolveResponse = {
      /** 最终文件夹ID */
      fileId: CommonType.IdType;
      /** 文件夹名称 */
      fileName: string;
      /** 父目录ID */
      parentId: CommonType.IdType | null;
      /** 路径字符串 */
      filePath: string;
      /** 面包屑链 */
      breadcrumb: BreadcrumbItem[];
    };

    /** 文件夹项（选择器用） */
    type FolderItem = {
      id: CommonType.IdType;
      name: string;
      path: string;
      parentId: CommonType.IdType | null;
      depth: number;
    };

    /** 复制文件参数 */
    type CopyFileParams = {
      fileIds: CommonType.IdType[];
      targetPath: string;
    };

    /** 移动文件参数 */
    type MoveFileParams = {
      fileIds: CommonType.IdType[];
      targetPath: string;
    };

    /** 配额信息 */
    type QuotaInfo = {
      /** 已用空间（字节） */
      usedSpace: number;
      /** 配额上限（字节） */
      quota: number;
      /** 是否无限制 */
      unlimited: boolean;
      /** 配额来源 */
      quotaSource: 'personal' | 'global' | 'none';
    };

    /** 配额校验请求 */
    type QuotaCheckParams = {
      /** 文件大小（字节） */
      fileSize: number;
    };

    /** 配额校验响应 */
    type QuotaCheckResponse = {
      /** 是否允许 */
      allowed: boolean;
      /** 拒绝原因 */
      reason?: string;
      /** 剩余空间（字节） */
      remainingSpace: number;
    };

    /** 单文件下载响应 */
    type DownloadResponse = {
      /** 是否允许下载 */
      allowDownload: boolean;
      /** 是否重定向 */
      isRedirect: boolean;
      /** 重定向地址 */
      redirectUrl: string;
      /** 下载地址（含 token） */
      downloadUrl: string;
    };

    /** 打包下载响应 */
    type PackageDownloadResponse = {
      /** 是否允许下载 */
      allowDownload: boolean;
      /** 下载地址（含 token） */
      downloadUrl: string;
      /** 文件数量 */
      fileCount: number;
      /** 文件夹数量 */
      folderCount: number;
      /** 总大小（字节） */
      totalSize: number;
      /** 扫描耗时（毫秒） */
      scanTime: number;
    };

    /** 预览文件信息 */
    type PreviewFileInfo = {
      /** 文件ID */
      fileId: CommonType.IdType;
      /** 文件名 */
      fileName: string;
      /** 文件大小（字节） */
      fileSize: number;
      /** 文件扩展名 */
      fileExtension?: string;
      /** 文件路径 */
      filePath?: string;
    };

    /** 创建分享请求参数 */
    type CreateShareParams = {
      /** 文件ID（必须为数字，后端期望 int64） */
      fileId: number;
      /** 是否私密分享 */
      isPrivate: boolean;
      /** 有效期 */
      validity: string;
      /** 自定义天数（可选） */
      customDays?: number;
      /** 提取码（私密分享时） */
      extractionCode?: string;
      /** 自动生成提取码 */
      autoFillExtractCode?: boolean;
      /** 自定义分享地址 */
      customAddress?: string;
    };

    /** 分享结果 */
    type ShareResult = {
      /** 分享ID */
      shareId: number;
      /** 短链接ID */
      shortId: string;
      /** 分享链接 */
      link: string;
      /** 二维码 */
      qrCode?: string;
      /** 提取码 */
      extractionCode: string;
      /** 过期时间 */
      expireDate?: string | null;
      /** 是否私密 */
      isPrivate: boolean;
      /** 操作权限列表 */
      operationPermissionList?: string[];
    };

    /** 更新分享参数 */
    type UpdateShareParams = {
      /** 分享ID */
      shareId: number;
      /** 是否私密 */
      isPrivate?: boolean;
      /** 过期时间戳（秒） */
      expireAt?: number;
      /** 提取码 */
      extractionCode?: string;
      /** 操作权限列表 */
      operationPermissionList?: string[];
    };

    /** 公开分享信息 */
    type SharePublicInfo = {
      /** 分享ID */
      shareId: number;
      /** 短链接ID */
      shortId: string;
      /** 文件名 */
      fileName: string;
      /** 是否文件夹 */
      isFolder: boolean;
      /** 是否私密 */
      isPrivate: boolean;
      /** 分享者用户名 */
      sharerName: string;
      /** 过期时间 */
      expireDate?: string | null;
      /** 访问次数 */
      viewCount: number;
      /** 下载次数 */
      downloadCount: number;
      /** 文件类型 */
      fileType: string;
      /** 文件扩展名 */
      fileExtension?: string;
      /** 文件列表 */
      files: ShareFileItem[];
    };

    /** 分享文件项 */
    type ShareFileItem = {
      /** 文件ID */
      fileId: number;
      /** 文件名 */
      fileName: string;
      /** 文件大小（字节） */
      fileSize: number;
      /** 是否文件夹 */
      isFolder: boolean;
      /** 文件类型 */
      fileType: string;
      /** 文件扩展名 */
      fileExtension?: string;
      /** 修改时间 */
      modifyTime?: string;
    };

    /** 用户分享列表项 */
    type MyShareItem = {
      /** 分享ID */
      shareId: number;
      /** 文件ID */
      fileId: number;
      /** 短链接ID */
      shortId: string;
      /** 文件名 */
      fileName: string;
      /** 文件大小 */
      fileSize: number;
      /** 文件MIME类型 */
      contentType: string;
      /** 文件扩展名 */
      fileExtension: string;
      /** 是否文件夹 */
      isFolder: boolean;
      /** 创建时间 */
      createDate: string;
      /** 过期时间 */
      expireDate?: string | null;
      /** 是否私密 */
      isPrivate: boolean;
      /** 访问次数 */
      viewCount: number;
      /** 下载次数 */
      downloadCount: number;
    };

    /** 用户分享列表请求参数 */
    type MyShareListParams = {
      /** 页码 */
      pageNum: number;
      /** 每页数量 */
      pageSize: number;
      /** 排序字段 */
      sortField?: 'fileName' | 'createDate' | null;
      /** 排序方式 */
      sortOrder?: 'asc' | 'desc' | null;
    };

    /** 用户分享列表响应 */
    type MyShareList = Common.PaginatingQueryRecord<MyShareItem>;

    /** 最近访问项 */
    type RecentItem = {
      /** 记录ID */
      recordId: CommonType.IdType;
      /** 文件ID */
      fileId: CommonType.IdType;
      /** 文件名 */
      fileName: string;
      /** 文件类型 */
      fileType: string;
      /** 文件扩展名 */
      fileExtension?: string;
      /** 是否文件夹 */
      isFolder: boolean;
      /** 文件大小 */
      fileSize: number;
      /** 访问时间 */
      visitTime: string;
      /** 原路径 */
      filePath: string;
      /** 是否有媒体封面 */
      hasMediaCover?: boolean;
      /** 是否已收藏 */
      isFavorite?: boolean;
      /** 是否已分享（外链） */
      isShare?: boolean;
    };

    /** 最近访问列表参数 */
    type RecentListParams = {
      pageNum: number;
      pageSize: number;
      sortField?: 'fileName' | 'visitTime' | 'size' | null;
      sortOrder?: 'asc' | 'desc' | null;
    };

    /** 最近访问列表响应 */
    type RecentList = Common.PaginatingQueryRecord<RecentItem>;

    /** 回收站项 */
    type RecycleItem = {
      /** 回收站记录ID */
      recycleId: CommonType.IdType;
      /** 原文件ID */
      fileId: CommonType.IdType;
      /** 文件名 */
      fileName: string;
      /** 文件类型 */
      fileType: string;
      /** 文件扩展名 */
      fileExtension?: string;
      /** 是否文件夹 */
      isFolder: boolean;
      /** 文件大小 */
      fileSize: number;
      /** 删除时间 */
      deleteTime: string;
      /** 原路径 */
      originalPath: string;
      /** 剩余保留天数 */
      expireDays: number;
      /** 是否有媒体封面 */
      mediaCover?: boolean;
    };

    /** 回收站列表参数 */
    type RecycleListParams = {
      pageNum: number;
      pageSize: number;
      sortField?: 'fileName' | 'deleteTime' | 'size' | null;
      sortOrder?: 'asc' | 'desc' | null;
    };

    /** 回收站列表响应 */
    type RecycleList = Common.PaginatingQueryRecord<RecycleItem>;

    /** 收藏列表请求参数 */
    type FavoriteListParams = {
      pageNum: number;
      pageSize: number;
      sortField: 'name' | 'size' | 'modifyTime' | 'type' | null;
      sortOrder: 'asc' | 'desc' | null;
    };

    /** 收藏列表响应（后端原始格式） */
    type FavoriteList = {
      list: FileItem[];
      total: number;
      page: number;
      size: number;
    };

    /** 收藏操作请求参数 */
    type FavoriteOperationParams = {
      fileIds: number[];
    };

    /** 共享给我的列表项 */
    type SharedWithMeItem = {
      /** 分享记录ID */
      fileShareId: number;
      /** 文件ID */
      fileId: number;
      /** 文件名 */
      fileName: string;
      /** 是否文件夹 */
      isFolder: boolean;
      /** 文件MIME类型 */
      contentType: string;
      /** 文件大小（字节） */
      size: number;
      /** 分享者用户ID */
      shareUserId: number;
      /** 分享者昵称 */
      shareUserName: string;
      /** 分享类型 (user/dept) */
      shareType: 'user' | 'dept';
      /** 权限列表 */
      permissions: string[];
      /** 过期时间 */
      expireDate?: string | null;
      /** 状态 */
      status: string;
      /** 当前用户对此共享的接收状态 */
      targetStatus: 'pending' | 'active' | 'rejected';
      /** 来源标签 (直接分享 / 部门: XX) */
      sourceLabel?: string;
      /** 备注 */
      remark?: string;
      /** 创建时间 */
      createdAt: string;
      /** 是否有媒体封面 */
      mediaCover?: boolean;
    };

    /** 共享给我的列表响应 */
    type SharedWithMeList = {
      total: number;
      rows: SharedWithMeItem[];
      pageNum: number;
      pageSize: number;
    };

    /** 文件共享目标项（回显用） */
    type FileShareTargetItem = {
      fileShareId: number;
      shareType: string;
      targetType: string;
      targetId: number;
      targetName: string;
      permissions: string[];
      status: string;
    };
  }
}
