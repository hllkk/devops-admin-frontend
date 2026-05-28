import { useAuthStore } from '@/store/modules/auth';
import { useDiskStore } from '@/store/modules/disk';
import { request } from '@/service/request';
import { getServiceBaseURL } from '@/utils/service';

/** 获取文件列表 */
export function fetchGetFileList(params?: Api.Disk.FileSearchParams) {
  const diskStore = useDiskStore();
  const userId = Number(useAuthStore().userInfo.userId);

  const currentDirectory = diskStore.currentPath.length > 0
    ? `/${diskStore.currentPath.map(item => item.fileName).join('/')}`
    : '/';

  const queryType = params?.fileType && params.fileType !== 'all' ? params.fileType : '';

  return request<any>({
    url: '/file-meta/list',
    method: 'get',
    params: {
      userId,
      currentDirectory,
      queryType,
      keyword: params?.keyword || '',
      page: params?.pageNum || 1,
      pageSize: params?.pageSize || 50,
      sortBy: params?.sortField === 'modifyTime' ? 'time' : params?.sortField,
      sortOrder: params?.sortOrder
    }
  });
}

/** 将 MIME 类型转换为前端文件分类 */
function contentTypeToFileType(contentType: string): string {
  if (!contentType) return 'other';
  const ct = contentType.toLowerCase();
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('video/')) return 'video';
  if (ct.startsWith('audio/')) return 'audio';
  if (ct === 'application/pdf') return 'document';
  if (ct.startsWith('text/')) return 'document';
  if (ct.includes('word') || ct.includes('spreadsheet') || ct.includes('presentation') || ct.includes('document')) return 'document';
  return 'other';
}

/** 将后端 FileListResponse 转换为前端 FileItem 格式 */
export function mapBackendFileList(backendData: { list: any[]; total: number }) {
  const list: Api.Disk.FileItem[] = (backendData.list || []).map(item => {
    // 处理扩展名：去掉前导的点号（如 '.md' -> 'md'）
    const cleanExtension = item.extendName ? item.extendName.replace(/^\./, '') : undefined;

    return {
      createBy: '',
      createTime: item.createTime || '',
      updateBy: '',
      updateTime: item.updateTime || '',
      fileId: item.id,
      fileName: item.name,
      fileType: item.isDir ? 'folder' : contentTypeToFileType(item.contentType),
      fileSize: item.size,
      fileExtension: cleanExtension,
      extendName: item.extendName, // 保留原始值供其他组件使用
      parentId: null,
      filePath: item.filePath,
      modifyTime: item.updateTime,
      isFolder: item.isDir,
      icon: item.isDir ? 'material-symbols:folder' : getFileIcon(cleanExtension),
      mediaCover: item.mediaCover || false,
      showCover: item.showCover || false,
      music: item.music,
      video: item.video,
      isFavorite: item.isFavorite || false,
      isShare: item.isShare || false
    };
  });

  return { rows: list, total: backendData.total || 0 };
}

function getFileIcon(ext?: string): string {
  if (!ext) return 'material-symbols:description';
  // 处理扩展名：去掉前导的点号（如 '.md' -> 'md'）
  const lower = ext.toLowerCase().replace(/^\./, '');
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(lower)) return 'material-symbols:image';
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'].includes(lower)) return 'material-symbols:videocam';
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(lower)) return 'material-symbols:audiotrack';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'txt', 'md'].includes(lower)) return 'material-symbols:description';
  return 'material-symbols:description';
}

/** 获取上传配置 (GET /file-meta/upload-config) */
export function fetchUploadConfig() {
  return request<Api.Disk.UploadConfig>({
    url: '/file-meta/upload-config',
    method: 'get'
  });
}

/** 秒传/断点检测 (GET /file-meta/upload) */
export function fetchCheckFile(params: Api.Disk.FileCheckParams) {
  return request<Api.Disk.FileCheckResponse>({
    url: '/file-meta/upload',
    method: 'get',
    params
  });
}

/** 上传文件/分片 (POST /file-meta/upload) */
export function fetchUploadChunk(data: Api.Disk.ChunkUploadParams) {
  const formData = new FormData();
  formData.append('file', data.file);
  formData.append('identifier', data.identifier);
  formData.append('chunkNumber', String(data.chunkNumber));
  formData.append('chunkSize', String(data.chunkSize));
  formData.append('currentChunkSize', String(data.currentChunkSize));
  formData.append('totalSize', String(data.totalSize));
  formData.append('filename', data.fileName);
  formData.append('relativePath', data.relativePath);
  formData.append('totalChunks', String(data.totalChunks));
  formData.append('userId', String(data.userId));

  if (data.currentDirectory) formData.append('currentDirectory', data.currentDirectory);
  if (data.isFolder) formData.append('isFolder', 'true');
  if (data.folderPath) formData.append('folderPath', data.folderPath);
  if (data.chunkHash) formData.append('chunkHash', data.chunkHash);

  return request<{ pass: boolean; upload: boolean; merge: boolean }>({
    url: '/file-meta/upload',
    method: 'post',
    data: formData,
    timeout: 5 * 60 * 1000,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}

/** 批量检查分片是否已存在于服务端去重池 (POST /file-meta/check-chunks) */
export function fetchCheckChunks(chunks: { index: number; hash: string }[]) {
  return request<Api.Disk.CheckChunksResponse>({
    url: '/file-meta/check-chunks',
    method: 'post',
    data: { chunks }
  });
}

/** 合并分片 (POST /file-meta/merge) */
export function fetchMergeChunks(data: Api.Disk.MergeChunksParams) {
  return request<boolean>({
    url: '/file-meta/merge',
    method: 'post',
    data,
    timeout: 15 * 60 * 1000
  });
}

/** 新建文件夹 */
export function fetchCreateFolder(data: Api.Disk.CreateFolderParams) {
  return request<boolean>({
    url: '/file-meta/createFolder',
    method: 'post',
    data: { ...data, isFolder: true }
  });
}

/** 新建空文件 */
export function fetchCreateFile(data: Api.Disk.CreateFileParams) {
  const userId = Number(useAuthStore().userInfo.userId);
  return request<boolean>({
    url: '/file-meta/create',
    method: 'post',
    data: { ...data, userId }
  });
}

/** 重命名文件 */
export function fetchRenameFile(fileId: CommonType.IdType, newName: string) {
  return request<boolean>({
    url: '/file-meta/rename',
    method: 'post',
    data: { fileId, newName }
  });
}

/** 删除文件(移到回收站或彻底删除) */
export function fetchDeleteFile(fileIds: CommonType.IdType[], sweep = false) {
  const numericIds = fileIds.map(id => (typeof id === 'string' ? parseInt(id, 10) : id));
  // 后端现在支持两种方式:
  // - sweep=false: 发送 fileIds (移入回收站)
  // - sweep=true: 发送 fileIds (直接彻底删除，后端会先移入回收站再删除)
  return request<{ success: boolean; message: string }>({
    url: `/file-meta/delete${sweep ? '?sweep=true' : ''}`,
    method: 'delete',
    data: { fileIds: numericIds }
  });
}

/** 将后端 TrashListResponse 转换为前端 RecycleItem 格式 */
export function mapBackendTrashList(backendData: { list: any[]; total: number }) {
  const list: Api.Disk.RecycleItem[] = (backendData.list || []).map(item => {
    const purgeAt = item.purgeAt ? new Date(item.purgeAt) : null;
    const expireDays = purgeAt
      ? Math.max(0, Math.ceil((purgeAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 30;

    return {
      recycleId: item.id,
      fileId: item.fileId,
      fileName: item.name,
      fileType: item.isDir ? 'folder' : contentTypeToFileType(item.contentType),
      fileExtension: item.suffix || undefined,
      isFolder: item.isDir,
      fileSize: item.size,
      deleteTime: item.trashedAt,
      originalPath: item.originalPath || '',
      expireDays,
      mediaCover: false
    };
  });

  return { rows: list, total: backendData.total || 0 };
}

/** 获取回收站列表 */
export function fetchGetTrashList(params?: Api.Disk.RecycleListParams) {
  const userId = Number(useAuthStore().userInfo.userId);
  return request<any>({
    url: '/file-meta/trash/list',
    method: 'get',
    params: {
      userId,
      page: params?.pageNum || 1,
      pageSize: params?.pageSize || 50
    }
  });
}

/** 从回收站恢复文件 */
export function fetchRestoreTrash(trashIds: CommonType.IdType[]) {
  const userId = Number(useAuthStore().userInfo.userId);
  const numericIds = trashIds.map(id => (typeof id === 'string' ? parseInt(id, 10) : id));
  return request<{ success: boolean; message: string }>({
    url: '/file-meta/trash/restore',
    method: 'post',
    data: { userId, trashIds: numericIds }
  });
}

/** 彻底删除回收站文件 */
export function fetchDeleteTrash(trashIds: CommonType.IdType[]) {
  const userId = Number(useAuthStore().userInfo.userId);
  const numericIds = trashIds.map(id => (typeof id === 'string' ? parseInt(id, 10) : id));
  return request<{ success: boolean; message: string }>({
    url: '/file-meta/trash/delete',
    method: 'post',
    data: { userId, trashIds: numericIds }
  });
}

/** 清空回收站 */
export function fetchEmptyTrash() {
  const userId = Number(useAuthStore().userInfo.userId);
  return request<{ success: boolean; message: string }>({
    url: '/file-meta/trash/empty',
    method: 'delete',
    data: { userId }
  });
}

/** 移动文件 */
export function fetchMoveFile(data: Api.Disk.MoveFileParams) {
  return request<boolean>({
    url: '/file-meta/move',
    method: 'put',
    data
  });
}

/** 复制文件 */
export function fetchCopyFile(data: Api.Disk.CopyFileParams) {
  return request<boolean>({
    url: '/file-meta/copy',
    method: 'post',
    data
  });
}

/** 获取文件夹列表（供目标选择器使用） */
export function fetchGetFolderList(path?: string) {
  return request<{ list: Api.Disk.FolderItem[] }>({
    url: '/file-meta/folders',
    method: 'get',
    params: { path: path || '/' }
  });
}

/** 路径解析 - 用于URL导航恢复 */
export function fetchResolvePath(path: string) {
  return request<Api.Disk.PathResolveResponse>({
    url: '/file-meta/path-resolve',
    method: 'get',
    params: { path }
  });
}

/** 获取文件预览URL */
export function getPreviewUrl(fileId: CommonType.IdType): string {
  const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
  const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);
  return `${baseURL}/preview/file/${fileId}`;
}

/** 保存文件内容 */
export function fetchSaveFileContent(data: { fileId: string | number; content: string }) {
  // 后端期望 fileId 为 string 类型
  const fileIdStr = String(data.fileId);
  return request<boolean>({
    url: '/file-meta/updateContent',
    method: 'post',
    data: { fileId: fileIdStr, content: data.content }
  });
}

/** 请求单文件下载令牌 */
export function fetchIsAllowDownload(fileIds: CommonType.IdType[]) {
  const userId = Number(useAuthStore().userInfo.userId);
  return request<Api.Disk.DownloadResponse>({
    url: '/file-meta/isAllowDownload',
    method: 'post',
    data: { userId, fileIds: fileIds.map(String) }
  });
}

/** 请求打包下载令牌 */
export function fetchIsAllowPackageDownload(fileIds: CommonType.IdType[]) {
  const userId = Number(useAuthStore().userInfo.userId);
  return request<Api.Disk.PackageDownloadResponse>({
    url: '/file-meta/isAllowPackageDownload',
    method: 'post',
    data: { userId, fileIds: fileIds.map(String) }
  });
}

/** 生成视频流播放 token */
export function fetchGenerateStreamToken(fileId: string) {
  return request<{ token: string; expiresIn: number }>({
    url: '/stream/token',
    method: 'post',
    data: { fileId }
  });
}

/** 续期视频流播放 token */
export function fetchRenewStreamToken(token: string) {
  return request<{ token: string; expiresIn: number }>({
    url: '/stream/renew',
    method: 'post',
    data: { token }
  });
}
