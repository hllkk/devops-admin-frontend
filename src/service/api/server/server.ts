import { request } from '@/service/request';

// ============ 服务器列表/详情/指标/日志 ============

/** 服务器列表（分页） */
export function fetchGetServerList(params: Api.Server.ServerSearchParams) {
  return request<Api.Server.ServerList>({ url: '/server/list', method: 'get', params });
}

/** 服务器详情 */
export function fetchGetServerDetail(id: CommonType.IdType) {
  return request<Api.Server.ServerDetail>({ url: `/server/${id}`, method: 'get' });
}

/** 服务器历史指标 */
export function fetchGetServerMetrics(id: CommonType.IdType, range: Api.Server.MetricRange) {
  return request<Api.Server.ServerMetrics>({ url: `/server/${id}/metrics`, method: 'get', params: { range } });
}

/** 服务器操作日志 */
export function fetchGetServerOpLogs(id: CommonType.IdType) {
  return request<Api.Server.OpLog[]>({ url: `/server/${id}/opLogs`, method: 'get' });
}

/** 主机凭证（脱敏） */
export function fetchGetServerCredential(id: CommonType.IdType) {
  return request<Api.Server.HostCredential>({ url: `/server/${id}/credential`, method: 'get' });
}

// ============ 分组 API ============

/** 获取分组树 */
export function fetchGetGroupTree() {
  return request<Api.Server.ServerGroupTree>({ url: '/server/group/tree', method: 'get' });
}

/** 创建分组 */
export function fetchCreateGroup(params: { parentId: CommonType.IdType; name: string }) {
  return request<{ id: CommonType.IdType }>({ url: '/server/group', method: 'post', data: params });
}

/** 重命名分组 */
export function fetchRenameGroup(params: { id: CommonType.IdType; name: string }) {
  return request<null>({ url: '/server/group/rename', method: 'put', data: params });
}

/** 删除分组 */
export function fetchDeleteGroup(id: CommonType.IdType) {
  return request<null>({ url: `/server/group/${id}`, method: 'delete' });
}

// ============ 服务器 CRUD ============

/** 新增服务器 */
export function fetchAddServer(params: Api.Server.ServerOperateParams) {
  return request<{ id: CommonType.IdType }>({ url: '/server', method: 'post', data: params });
}

/** 更新服务器 */
export function fetchUpdateServer(params: Api.Server.ServerOperateParams & { id: CommonType.IdType }) {
  return request<null>({ url: '/server', method: 'put', data: params });
}

/** 批量删除服务器 */
export function fetchBatchDeleteServer(ids: CommonType.IdType[]) {
  return request<null>({ url: '/server', method: 'delete', data: { ids } });
}

/** 移动服务器 */
export function fetchMoveServers(params: { ids: CommonType.IdType[]; targetGroupId: CommonType.IdType }) {
  return request<null>({ url: '/server/move', method: 'put', data: params });
}

/** 批量导入服务器 */
export function fetchBatchImportServers(params: {
  items: Api.Server.ServerImportItem[];
  groupId: CommonType.IdType;
}) {
  return request<Api.Server.ServerImportResponse>({ url: '/server/import', method: 'post', data: params });
}
