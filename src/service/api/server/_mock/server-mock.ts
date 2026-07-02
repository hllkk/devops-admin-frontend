const NAMES = ['web-prod-01', 'web-prod-02', 'db-master', 'db-slave-01', 'cache-01', 'cache-02', 'k8s-master', 'k8s-node-01', 'k8s-node-02', 'gateway-01', 'gateway-02', 'mq-01'];
const OSS = ['Ubuntu 22.04', 'CentOS 7', 'Debian 12', 'Rocky 9', 'Windows Server 2022'];

function rand(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}
function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

function makeServer(id: number): Api.Server.Server {
  const r = Math.random();
  const status: Api.Server.Status = r > 0.85 ? 'offline' : r > 0.7 ? 'warning' : 'online';
  return {
    id,
    name: NAMES[id % NAMES.length]!,
    ip: `10.0.${rand(0, 32)}.${rand(2, 254)}`,
    status,
    os: pick(OSS, id),
    hostname: `host-${id.toString().padStart(2, '0')}`,
    location: ['机房A-机柜1', '机房A-机柜2', '机房B-机柜1', '机房B-机柜3'][id % 4]!,
    uptimeSeconds: rand(3600, 8000000),
    cpuUsage: status === 'offline' ? 0 : rand(5, 95),
    memUsage: status === 'offline' ? 0 : rand(20, 92),
    memTotalGB: pick([16, 32, 64, 128], id),
    diskUsage: status === 'offline' ? 0 : rand(25, 88),
    diskTotalGB: pick([256, 512, 1024, 2048], id),
    netInKbps: rand(100, 5000),
    netOutKbps: rand(100, 3000)
  };
}

export function makeServerList(): Api.Server.ServerList {
  const rows = Array.from({ length: 12 }).map((_, i) => makeServer(i + 1));
  return { rows, pageNum: 1, pageSize: rows.length, total: rows.length };
}

export function makeServerDetail(id: CommonType.IdType): Api.Server.ServerDetail {
  const base = makeServer(Number(id) || 1);
  return {
    ...base,
    id,
    cpuModel: `Intel Xeon Gold ${pick(['6248R', '6338', '8358'], Number(id))}`,
    coreCount: pick([8, 16, 32, 64], Number(id)),
    createdAt: '2024-09-01 10:20:30',
    credential: {
      id,
      type: Number(id) % 2 === 0 ? 'ssh' : 'rdp',
      username: 'root',
      port: 22,
      maskedSecret: '••••••••••3f2a'
    }
  };
}

export function makeServerMetrics(range: Api.Server.MetricRange): Api.Server.ServerMetrics {
  const points = range === '7d' ? 28 : range === '24h' ? 24 : range === '6h' ? 12 : 12;
  const gen = (base: number, spread: number): Api.Server.MetricPoint[] =>
    Array.from({ length: points }).map((_, i) => ({
      time: range === '7d' ? `D-${points - i}` : `${i * (range === '24h' ? 1 : range === '6h' ? 30 : 5)}m`,
      value: Math.max(0, Math.min(100, base + rand(-spread, spread)))
    }));
  return { cpu: gen(45, 25), mem: gen(62, 15), disk: gen(70, 8), net: gen(60, 30) };
}

export function makeServerOpLogs(): Api.Server.OpLog[] {
  const actions = ['重启服务', '更新配置', '清理日志', '扩容磁盘', '执行备份', '升级内核'];
  return Array.from({ length: 8 }).map((_, i) => ({
    id: i + 1,
    time: new Date(Date.now() - i * rand(3600000, 7200000)).toISOString(),
    action: actions[i % actions.length]!,
    operator: ['admin', 'ops-li', 'system'][i % 3]!,
    result: i % 5 === 0 ? 'failed' : 'success'
  }));
}

export function makeServerCredential(id: CommonType.IdType): Api.Server.HostCredential {
  const detail = makeServerDetail(id);
  return detail.credential!;
}
