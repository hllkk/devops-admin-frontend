import { mockRequest } from './_mock/request';
import { makeAlertTrend, makeOverviewStats, makeRealtimeMetrics, makeRecentAlerts, makeTaskTrend } from './_mock/monitor-mock';

/** 概览统计（仪表盘顶部 4 卡 + 资源占用） */
export function fetchGetOverviewStats() {
  return mockRequest<Api.Server.OverviewStats>(makeOverviewStats);
}

/** 实时资源指标（大屏高频轮询） */
export function fetchGetRealtimeMetrics() {
  return mockRequest<Api.Server.RealtimeMetrics>(makeRealtimeMetrics, { min: 80, max: 200 });
}

/** 告警趋势 */
export function fetchGetAlertTrend(days = 7) {
  return mockRequest<Api.Server.AlertTrendItem[]>(() => makeAlertTrend(days));
}

/** 任务趋势 */
export function fetchGetTaskTrend(days = 7) {
  return mockRequest<Api.Server.TaskTrendItem[]>(() => makeTaskTrend(days));
}

/** 最近告警列表 */
export function fetchGetRecentAlerts(limit = 8) {
  return mockRequest<Api.Server.AlertItem[]>(() => makeRecentAlerts(limit));
}

/** 实时告警流（大屏滚动） */
export function fetchGetRealtimeAlerts() {
  return mockRequest<Api.Server.AlertItem[]>(() => makeRecentAlerts(12), { min: 60, max: 180 });
}
