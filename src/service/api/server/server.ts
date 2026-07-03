import { mockRequest } from './_mock/request';
import {
  makeServerDetail,
  makeServerMetrics,
  makeServerOpLogs,
  makeServerCredential
} from './_mock/server-mock';
import {
  getServerList,
  getGroupTree,
  createGroup,
  renameGroup,
  deleteGroup,
  addServer,
  updateServer,
  batchDeleteServer,
  moveServers,
  batchImportServers
} from './_mock/server-mock';

// ============ 服务器列表/详情/指标/日志(保持原签名) ============

/** 服务器列表（分页） */
export function fetchGetServerList(params: Api.Server.ServerSearchParams) {
  return getServerList(params);
}

/** 服务器详情 */
export function fetchGetServerDetail(id: CommonType.IdType) {
  return mockRequest<Api.Server.ServerDetail>(() => makeServerDetail(id));
}

/** 服务器历史指标 */
export function fetchGetServerMetrics(id: CommonType.IdType, range: Api.Server.MetricRange) {
  return mockRequest<Api.Server.ServerMetrics>(() => {
    void id;
    return makeServerMetrics(range);
  });
}

/** 服务器操作日志 */
export function fetchGetServerOpLogs(id: CommonType.IdType) {
  return mockRequest<Api.Server.OpLog[]>(() => {
    void id;
    return makeServerOpLogs();
  });
}

/** 主机凭证（脱敏） */
export function fetchGetServerCredential(id: CommonType.IdType) {
  return mockRequest<Api.Server.HostCredential>(() => makeServerCredential(id));
}

// ============ 分组 API ============

/** 获取分组树 */
export function fetchGetGroupTree() {
  return getGroupTree();
}

/** 创建分组 */
export function fetchCreateGroup(params: { parentId: CommonType.IdType; name: string }) {
  return createGroup(params);
}

/** 重命名分组 */
export function fetchRenameGroup(params: { id: CommonType.IdType; name: string }) {
  return renameGroup(params);
}

/** 删除分组 */
export function fetchDeleteGroup(id: CommonType.IdType) {
  return deleteGroup(id);
}

// ============ 服务器 CRUD ============

/** 新增服务器 */
export function fetchAddServer(params: Api.Server.ServerOperateParams) {
  return addServer(params);
}

/** 更新服务器 */
export function fetchUpdateServer(params: Api.Server.ServerOperateParams & { id: CommonType.IdType }) {
  return updateServer(params);
}

/** 批量删除服务器 */
export function fetchBatchDeleteServer(ids: CommonType.IdType[]) {
  return batchDeleteServer(ids);
}

/** 移动服务器 */
export function fetchMoveServers(params: { ids: CommonType.IdType[]; targetGroupId: CommonType.IdType }) {
  return moveServers(params);
}

/** 批量导入服务器 */
export function fetchBatchImportServers(params: {
  items: Api.Server.ServerImportItem[];
  groupId: CommonType.IdType;
}) {
  return batchImportServers(params);
}