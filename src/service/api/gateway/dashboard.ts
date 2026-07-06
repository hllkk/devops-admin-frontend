import { request } from '@/service/request';

/** Dashboard 查询参数(对齐 AIHelms period/start_date/end_date) */
export interface DashboardQuery {
  period?: string;
  start_date?: string;
  end_date?: string;
}

/** 获取 Dashboard 聚合数据 */
export function fetchGetDashboard(params: DashboardQuery = {}) {
  return request<Api.Gateway.DashboardData>({
    url: '/gateway/dashboard',
    method: 'get',
    params
  });
}

/** 刷新 Dashboard 效能数据(首版占位) */
export function fetchRefreshDashboard() {
  return request<{ status: string; taskId: string; reason: string }>({
    url: '/gateway/dashboard/refresh',
    method: 'post'
  });
}
