/**
 * Disk file list API
 *
 * 导出文件列表和内容更新相关接口
 */
import { request } from '@/service/request';
import { useAuthStore } from '@/store/modules/auth';
import { useDiskStore } from '@/store/modules/disk';

/** 获取文件列表 */
export function fetchGetFileList(params?: {
  userId?: number;
  currentDirectory?: string;
  queryType?: string;
  keyword?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortOrder?: string;
}) {
  const diskStore = useDiskStore();
  const userId = Number(useAuthStore().userInfo.userId);

  const currentDirectory = params?.currentDirectory
    ?? (diskStore.currentPath.length > 0
      ? `/${diskStore.currentPath.map(item => item.fileName).join('/')}`
      : '/');

  const queryType = params?.queryType ?? '';

  return request<Api.Disk.BackendFileListResponse>({
    url: '/file-meta/list',
    method: 'get',
    params: {
      userId: params?.userId ?? userId,
      currentDirectory,
      queryType,
      keyword: params?.keyword ?? '',
      page: params?.page ?? 1,
      pageSize: params?.size ?? 50,
      sortBy: params?.sortBy,
      sortOrder: params?.sortOrder
    }
  });
}

/** 更新文件内容 */
export function fetchUpdateFileContent(data: { fileId: string | number; content: string }) {
  // 后端期望 fileId 为 string 类型
  const fileIdStr = String(data.fileId);
  return request<boolean>({
    url: '/file-meta/updateContent',
    method: 'post',
    data: { fileId: fileIdStr, content: data.content }
  });
}