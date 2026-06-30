import { request } from '@/service/request';

/** 创建内部共享 */
export function fetchCreateInternalShare(data: {
  fileId: number;
  shareType: 'user' | 'dept';
  targets: { targetId: number }[];
  role: Api.Disk.ShareRole;
  expireDate?: string;
  remark?: string;
}) {
  return request<boolean>({
    url: '/share/internal/create',
    method: 'post',
    data
  });
}

/** 批量保存到我的网盘 */
export function fetchBatchSaveToDrive(
  items: Array<{ shareId: number; fileId: number }>,
  targetFolderId: number
) {
  return request<{
    results: Array<{ shareId: number; fileId: number; originalName: string; savedName: string; isRenamed: boolean }>;
    renamedCount: number;
    totalCount: number;
  }>({
    url: '/share/internal/save-to-drive',
    method: 'post',
    data: { items, targetFolderId }
  });
}

/** 获取文件已有共享目标 */
export function fetchGetFileShareTargets(fileId: number) {
  return request<Api.Disk.FileShareTargetItem[]>({
    url: '/share/internal/targets',
    method: 'post',
    data: { fileId }
  });
}

/** 获取我发起的共享列表 */
export function fetchGetMySharedList(params: { pageNum: number; pageSize: number }) {
  return request<{ total: number; rows: Api.Disk.SharedWithMeItem[]; pageNum: number; pageSize: number }>({
    url: '/share/internal/my-shared',
    method: 'post',
    data: params
  });
}

/** 获取共享给我的列表 */
export function fetchGetSharedWithMeList(params: {
  pageNum: number;
  pageSize: number;
  shareType?: string;
  keyword?: string;
  contentType?: string;
}) {
  return request<Api.Disk.SharedWithMeList>({
    url: '/share/internal/shared-with-me',
    method: 'post',
    data: params
  });
}

/** 获取共享文件夹内容列表 */
export function fetchGetSharedFolderContents(params: {
  fileId: number;
  path?: string;
  pageNum?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
}) {
  return request<{ list: Api.Disk.BackendFileItem[]; total: number; page: number; size: number }>({
    url: '/share/internal/folder',
    method: 'post',
    data: params
  }).then(res => {
    // 将后端的字段名映射为前端期望的字段名
    if (res.data) {
      const mappedList = (res.data.list || []).map(item => {
        // 处理扩展名：去掉前导的点号（如 '.md' -> 'md'）
        const cleanExtension = item.extendName ? item.extendName.replace(/^\./, '') : undefined;

        return {
          createBy: '',
          createTime: item.createTime || '',
          updateBy: '',
          updateTime: item.updateTime || '',
          fileId: item.id,
          fileName: item.name,
          fileType: item.isDir ? 'folder' : 'other',
          fileExtension: cleanExtension,
          extendName: item.extendName, // 保留原始值
          fileSize: item.size,
          filePath: item.filePath,
          parentId: null,
          isFolder: item.isDir,
          isDir: item.isDir,
          modifyTime: item.updateTime,
          contentType: item.contentType,
          mediaCover: item.mediaCover || false
        };
      });
      return {
        ...res,
        data: {
          rows: mappedList,
          total: res.data.total || 0,
          pageNum: res.data.page || 1,
          pageSize: res.data.size || 50
        }
      };
    }
    return res;
  });
}

/** 上传文件到共享文件夹 */
export function fetchUploadToShareFolder(data: {
  shareFileId: number;
  relativePath?: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append('shareFileId', data.shareFileId.toString());
  if (data.relativePath) {
    formData.append('relativePath', data.relativePath);
  }
  formData.append('file', data.file);

  return request<{
    fileId: number;
    fileName: string;
    filePath: string;
    fileSize: number;
    contentType: string;
    operationId: number;
  }>({
    url: '/share/internal/upload',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}

/** 在共享文件夹内创建子文件夹 */
export function fetchCreateShareFolder(data: {
  shareFileId: number;
  folderName: string;
  parentPath?: string;
}) {
  return request<{
    folderId: number;
    folderName: string;
    folderPath: string;
    operationId: number;
  }>({
    url: '/share/internal/create-folder',
    method: 'post',
    data
  });
}

/** 更新共享角色 */
export function fetchUpdateShareRole(shareId: number, role: Api.Disk.ShareRole) {
  return request<boolean>({
    url: '/share/internal/role',
    method: 'put',
    data: { shareId, role }
  });
}

/** 移除共享目标 */
export function fetchRemoveShareTarget(targetId: number) {
  return request<boolean>({
    url: '/share/internal/target',
    method: 'delete',
    data: { targetId }
  });
}

/** 根据共享ID获取单条共享详情 */
export function fetchGetShareById(fileShareId: number) {
  return request<Api.Disk.SharedWithMeItem>({
    url: '/share/internal/detail',
    method: 'post',
    data: { fileShareId }
  });
}
