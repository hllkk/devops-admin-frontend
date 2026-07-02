import { mockRequest } from './_mock/request';
import { makeServerCredential, makeServerDetail, makeServerList, makeServerMetrics, makeServerOpLogs } from './_mock/server-mock';

/** 服务器列表（分页） */
export function fetchGetServerList(params: Api.Server.ServerSearchParams) {
  return mockRequest<Api.Server.ServerList>(() => {
    void params;
    return makeServerList();
  });
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
