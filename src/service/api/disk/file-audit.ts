import { request } from '@/service/request';

/** 获取文件操作审计列表 */
export function fetchGetFileAuditList(params?: Api.Disk.FileAuditSearchParams) {
  return request<Api.Disk.FileAuditList>({
    url: '/disk/fileAudit/list',
    method: 'get',
    params
  });
}

/** 删除文件操作审计 */
export function fetchDeleteFileAudit(id: CommonType.IdType) {
  return request<boolean>({
    url: `/disk/fileAudit/${id}`,
    method: 'delete'
  });
}

/** 批量删除文件操作审计 */
export function fetchBatchDeleteFileAudit(ids: CommonType.IdType[]) {
  return request<boolean>({
    url: `/disk/fileAudit/${ids.join(',')}`,
    method: 'delete'
  });
}

/** 清空文件操作审计 */
export function fetchCleanFileAudit() {
  return request<boolean>({
    url: '/disk/fileAudit/clean',
    method: 'delete'
  });
}
