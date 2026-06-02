import { request } from '@/service/request';

/** 创建分享 */
export function fetchCreateShare(data: Api.Disk.CreateShareParams) {
  return request<Api.Disk.ShareResult>({
    url: '/share/create',
    method: 'post',
    data
  });
}

/** 获取分享信息 */
export function fetchGetShareInfo(fileId: CommonType.IdType) {
  // 确保 fileId 为数字类型（后端期望 int64）
  const fileIdNum = typeof fileId === 'string' ? parseInt(fileId, 10) : fileId;
  return request<Api.Disk.ShareResult>({
    url: '/share/info',
    method: 'post',
    data: { fileId: fileIdNum }
  });
}

/** 取消分享 */
export function fetchCancelShare(shareId: CommonType.IdType) {
  // 确保 shareId 为数字类型（后端期望 int64）
  const shareIdNum = typeof shareId === 'string' ? parseInt(shareId, 10) : shareId;
  return request<boolean>({
    url: '/share/cancel',
    method: 'post',
    data: { shareId: shareIdNum }
  });
}

/** 更新分享 */
export function fetchUpdateShare(data: Api.Disk.UpdateShareParams) {
  return request<Api.Disk.ShareResult>({
    url: '/share/update',
    method: 'post',
    data
  });
}

/** 获取用户的分享列表 */
export function fetchGetMyShareList(params: Api.Disk.MyShareListParams) {
  return request<Api.Disk.MyShareList>({
    url: '/share/my-list',
    method: 'post',
    data: params
  });
}