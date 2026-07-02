// 复用跨调用：本轮实时指标
let realtime: Api.Server.RealtimeMetrics = {
  timestamp: new Date().toISOString(),
  cpu: 42,
  mem: 63,
  disk: 71,
  netInKbps: 1820,
  netOutKbps: 940
};

function rand(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

export function makeOverviewStats(): Api.Server.OverviewStats {
  return {
    serverCount: 12,
    containerCount: 86,
    databaseCount: 5,
    alertCount: rand(1, 6),
    cpuUsage: realtime.cpu,
    memUsage: realtime.mem,
    diskUsage: realtime.disk
  };
}

export function makeRealtimeMetrics(): Api.Server.RealtimeMetrics {
  realtime = {
    timestamp: new Date().toISOString(),
    cpu: Math.min(99, Math.max(5, realtime.cpu + rand(-6, 7))),
    mem: Math.min(98, Math.max(10, realtime.mem + rand(-4, 5))),
    disk: Math.min(96, Math.max(20, realtime.disk + rand(-2, 3))),
    netInKbps: rand(800, 4200),
    netOutKbps: rand(400, 2600)
  };
  return realtime;
}

const ALERT_TITLES = [
  'CPU 使用率超过 90%',
  '内存可用不足 10%',
  '磁盘空间告警',
  '服务无响应',
  '网络延迟异常',
  '容器意外退出',
  '数据库连接数过高'
];
const SOURCES = ['web-prod-01', 'db-master', 'cache-02', 'k8s-node-3', 'gateway-01'];

export function makeRecentAlerts(limit = 8): Api.Server.AlertItem[] {
  return Array.from({ length: limit }).map((_, i) => {
    const r = Math.random();
    const level: Api.Server.AlertLevel = r > 0.8 ? 'critical' : r > 0.4 ? 'warning' : 'info';
    return {
      id: i + 1,
      level,
      title: ALERT_TITLES[i % ALERT_TITLES.length],
      source: SOURCES[i % SOURCES.length],
      time: new Date(Date.now() - i * rand(60000, 900000)).toISOString()
    };
  });
}

export function makeAlertTrend(days = 7): Api.Server.AlertTrendItem[] {
  return Array.from({ length: days }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      critical: rand(0, 4),
      warning: rand(2, 9),
      info: rand(5, 16)
    };
  });
}

export function makeTaskTrend(days = 7): Api.Server.TaskTrendItem[] {
  return Array.from({ length: days }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      success: rand(40, 120),
      failed: rand(0, 8)
    };
  });
}
