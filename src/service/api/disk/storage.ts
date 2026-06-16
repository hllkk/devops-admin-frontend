import { request } from '@/service/request';

/** 资料库列表(存储管理) */
export function fetchGetStorageLibraries(params: {
  pageNum: number;
  pageSize: number;
  keyword?: string;
  deptId?: number;
  quotaState?: string;
}) {
  return request<Api.Disk.StorageAdmin.LibraryListResponse>({
    url: '/manage/storage/libraries',
    method: 'get',
    params
  });
}

/** 所有权转移 */
export function fetchTransferStorageLibrary(data: Api.Disk.StorageAdmin.TransferLibraryRequest) {
  return request<Api.Disk.StorageAdmin.TransferLibraryResponse>({
    url: '/manage/storage/libraries/transfer',
    method: 'post',
    data
  });
}

/** 删除资料库(清空用户网盘) */
export function fetchDeleteStorageLibrary(userId: number) {
  return request<boolean>({
    url: `/manage/storage/libraries/${userId}`,
    method: 'delete'
  });
}

/** 转移记录列表 */
export function fetchGetStorageTransferRecords(params: {
  pageNum: number;
  pageSize: number;
  userId?: number;
}) {
  return request<{ total: number; rows: Api.Disk.StorageAdmin.TransferRecord[] }>({
    url: '/manage/storage/transfers',
    method: 'get',
    params
  });
}
