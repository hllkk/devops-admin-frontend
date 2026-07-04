import { createInitialGroups } from './group-mock';
import { mockRequest } from './request';

const NAMES = [
  'web-prod-01', 'web-prod-02', 'web-prod-03',
  'db-master', 'db-slave-01', 'db-slave-02',
  'cache-01', 'cache-02', 'k8s-master', 'k8s-node-01', 'k8s-node-02',
  'gateway-01', 'gateway-02', 'mq-01', 'mq-02',
  'web-dev-01', 'web-dev-02', 'db-dev-01',
  'web-test-01', 'web-test-02',
  'aliyun-web-01', 'aliyun-web-02', 'aliyun-db-01',
  'aliyun-cache-01', 'aliyun-mq-01', 'aliyun-gw-01', 'aliyun-gw-02',
  'monitor-01', 'log-01', 'backup-01'
];
const OSS = ['Ubuntu 22.04', 'CentOS 7', 'Debian 12', 'Rocky 9', 'Windows Server 2022'];

// 初始分组 -> 主机的简单映射(基于下标分配)
const GROUP_IDS_FOR_SERVERS = [
  13, 13, 13, 13, 13, 13, 13, 11, 11, 11, 11, 11, 11, 11, 11,
  12, 12, 12,
  12, 12,
  21, 21, 22,
  22, 22, 23, 23, 23, 23, 23
];

function rand(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}
function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

function makeServer(id: number, groupId: CommonType.IdType): Api.Server.Server {
  const r = Math.random();
  const status: Api.Server.Status = r > 0.85 ? 'offline' : r > 0.7 ? 'warning' : 'online';
  return {
    id,
    name: NAMES[id - 1] ?? `server-${id}`,
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
    netOutKbps: rand(100, 3000),
    groupId
  };
}

interface MockState {
  groups: Api.Server.ServerGroup[];
  servers: Api.Server.Server[];
  nextServerId: number;
}

function createInitialState(): MockState {
  const groups = createInitialGroups();
  const servers: Api.Server.Server[] = [];
  for (let i = 0; i < NAMES.length; i += 1) {
    const groupId = GROUP_IDS_FOR_SERVERS[i] ?? 13;
    servers.push(makeServer(i + 1, groupId));
  }
  return { groups, servers, nextServerId: NAMES.length + 1 };
}

// 使用 globalThis 避免 HMR 重复创建
declare global {
  // eslint-disable-next-line no-var
  var devopsAdminServerMockState: MockState | undefined;
}

function getState(): MockState {
  if (!globalThis.devopsAdminServerMockState) {
    globalThis.devopsAdminServerMockState = createInitialState();
  }
  return globalThis.devopsAdminServerMockState;
}

function setState(next: MockState): void {
  globalThis.devopsAdminServerMockState = next;
}

export function getMockState(): MockState {
  return getState();
}

export function setMockState(next: MockState): void {
  setState(next);
}

// ============ 分组 API ============

function buildGroupTreeWithCount(state: MockState): Api.Server.ServerGroup[] {
  const countMap = new Map<CommonType.IdType, number>();
  for (const s of state.servers) {
    const groupId = s.groupId ?? 0;
    countMap.set(groupId, (countMap.get(groupId) ?? 0) + 1);
  }
  const attach = (nodes: Api.Server.ServerGroup[]): Api.Server.ServerGroup[] =>
    nodes.map(n => ({
      ...n,
      serverCount: countMap.get(n.id) ?? 0,
      children: n.children ? attach(n.children) : undefined
    }));
  return attach(state.groups);
}

/** 拉取分组树 */
export function getGroupTree() {
  return mockRequest<Api.Server.ServerGroupTree>(() => buildGroupTreeWithCount(getState()));
}

/** 创建子分组 */
export function createGroup(params: { parentId: CommonType.IdType; name: string }) {
  return mockRequest<{ id: CommonType.IdType }>(() => {
    const state = getState();
    const newId = Math.max(0, ...state.groups.flatMap(g => collectIds(g)).map(Number)) + 1;
    const next: MockState = {
      ...state,
      groups: addChild(state.groups, params.parentId, {
        id: newId,
        parentId: params.parentId,
        name: params.name,
        orderNum: 99
      })
    };
    setState(next);
    return { id: newId };
  });
}

/** 重命名分组 */
export function renameGroup(params: { id: CommonType.IdType; name: string }) {
  return mockRequest<null>(() => {
    const state = getState();
    setState({ ...state, groups: renameNode(state.groups, params.id, params.name) });
    return null;
  });
}

/** 删除分组 */
export function deleteGroup(id: CommonType.IdType) {
  return mockRequest<null>(() => {
    const state = getState();
    if (hasChildren(state.groups, id)) throw new Error('请先删除子分组');
    if (state.servers.some(s => s.groupId === id)) throw new Error('该分组下还有主机');
    setState({ ...state, groups: removeNode(state.groups, id) });
    return null;
  });
}

function collectIds(node: Api.Server.ServerGroup): CommonType.IdType[] {
  const ids: CommonType.IdType[] = [node.id];
  if (node.children) for (const c of node.children) ids.push(...collectIds(c));
  return ids;
}
function addChild(
  nodes: Api.Server.ServerGroup[],
  parentId: CommonType.IdType,
  child: Api.Server.ServerGroup
): Api.Server.ServerGroup[] {
  return nodes.map(n => {
    if (n.id === parentId) {
      return { ...n, children: [...(n.children ?? []), child] };
    }
    if (n.children) return { ...n, children: addChild(n.children, parentId, child) };
    return n;
  });
}
function renameNode(
  nodes: Api.Server.ServerGroup[],
  id: CommonType.IdType,
  name: string
): Api.Server.ServerGroup[] {
  return nodes.map(n => {
    if (n.id === id) return { ...n, name };
    if (n.children) return { ...n, children: renameNode(n.children, id, name) };
    return n;
  });
}
function hasChildren(nodes: Api.Server.ServerGroup[], id: CommonType.IdType): boolean {
  for (const n of nodes) {
    if (n.id === id) return (n.children?.length ?? 0) > 0;
    if (n.children && hasChildren(n.children, id)) return true;
  }
  return false;
}
function removeNode(
  nodes: Api.Server.ServerGroup[],
  id: CommonType.IdType
): Api.Server.ServerGroup[] {
  return nodes
    .filter(n => n.id !== id)
    .map(n => (n.children ? { ...n, children: removeNode(n.children, id) } : n));
}

// ============ 服务器 API ============

/** 服务器列表(分页 + 过滤) */
export function getServerList(params: Api.Server.ServerSearchParams) {
  return mockRequest<Api.Server.ServerList>(() => {
    const state = getState();
    let rows = state.servers.slice();
    if (params.groupId != null && params.groupId !== 0) {
      if (params.includeSubGroups === false) {
        // 仅直属主机
        rows = rows.filter(s => (s.groupId ?? 0) === params.groupId);
      } else {
        // 含子分组（保持现状）
        const groupId = params.groupId ?? 0;
        const ids = new Set(collectAllChildIds(state.groups, groupId));
        ids.add(groupId);
        rows = rows.filter(s => ids.has(s.groupId ?? 0));
      }
    }
    if (params.name) rows = rows.filter(s => s.name.toLowerCase().includes(params.name!.toLowerCase()));
    if (params.ip) rows = rows.filter(s => s.ip.includes(params.ip!));
    if (params.status) rows = rows.filter(s => s.status === params.status);
    if (params.os) rows = rows.filter(s => s.os === params.os);
    const total = rows.length;
    const pageNum = params.pageNum ?? 1;
    const pageSize = params.pageSize ?? 10;
    const start = (pageNum - 1) * pageSize;
    rows = rows.slice(start, start + pageSize);
    return { rows, pageNum, pageSize, total };
  });
}

function collectAllChildIds(
  nodes: Api.Server.ServerGroup[],
  id: CommonType.IdType
): Set<CommonType.IdType> {
  const ids = new Set<CommonType.IdType>();
  const walk = (n: Api.Server.ServerGroup) => {
    ids.add(n.id);
    n.children?.forEach(walk);
  };
  for (const n of nodes) {
    if (n.id === id) {
      n.children?.forEach(walk);
      return ids;
    }
    if (n.children) {
      for (const c of n.children) {
        if (c.id === id) {
          walk(c);
          return ids;
        }
      }
    }
  }
  return ids;
}

/** 新增服务器 */
export function addServer(params: Api.Server.ServerOperateParams) {
  return mockRequest<{ id: CommonType.IdType }>(() => {
    const state = getState();
    const id = state.nextServerId;
    const newServer: Api.Server.Server = {
      id,
      name: params.name ?? `server-${id}`,
      ip: params.ip ?? '',
      status: 'online',
      os: params.os ?? 'Ubuntu 22.04',
      hostname: params.hostname ?? `host-${id.toString().padStart(2, '0')}`,
      location: params.location ?? '',
      uptimeSeconds: params.uptimeSeconds ?? 0,
      cpuUsage: rand(10, 60),
      memUsage: rand(20, 60),
      memTotalGB: 32,
      diskUsage: rand(20, 60),
      diskTotalGB: 512,
      netInKbps: rand(100, 1000),
      netOutKbps: rand(100, 1000),
      groupId: params.groupId ?? 13
    };
    setState({ ...state, servers: [...state.servers, newServer], nextServerId: id + 1 });
    return { id };
  });
}

/** 更新服务器 */
export function updateServer(params: Api.Server.ServerOperateParams & { id: CommonType.IdType }) {
  return mockRequest<null>(() => {
    const state = getState();
    const next: Api.Server.Server[] = state.servers.map(s =>
      s.id === params.id
        ? {
            ...s,
            name: params.name ?? s.name,
            ip: params.ip ?? s.ip,
            os: params.os ?? s.os,
            hostname: params.hostname ?? s.hostname,
            location: params.location ?? s.location,
            groupId: params.groupId ?? s.groupId
          }
        : s
    );
    setState({ ...state, servers: next });
    return null;
  });
}

/** 批量删除服务器 */
export function batchDeleteServer(ids: CommonType.IdType[]) {
  return mockRequest<null>(() => {
    const state = getState();
    setState({ ...state, servers: state.servers.filter(s => !ids.includes(s.id)) });
    return null;
  });
}

/** 批量移动服务器 */
export function moveServers(params: { ids: CommonType.IdType[]; targetGroupId: CommonType.IdType }) {
  return mockRequest<null>(() => {
    const state = getState();
    setState({
      ...state,
      servers: state.servers.map(s => (params.ids.includes(s.id) ? { ...s, groupId: params.targetGroupId } : s))
    });
    return null;
  });
}

/** 批量导入服务器 */
export function batchImportServers(params: {
  items: Api.Server.ServerImportItem[];
  groupId: CommonType.IdType;
}) {
  return mockRequest<Api.Server.ServerImportResponse>(() => {
    const state = getState();
    let nextId = state.nextServerId;
    const success: number[] = [];
    const errors: { row: number; message: string }[] = [];
    const newServers: Api.Server.Server[] = [];
    params.items.forEach((item, idx) => {
      if (!item.valid) {
        errors.push({ row: idx + 2, message: item.errorMessage ?? 'invalid' });
        return;
      }
      success.push(nextId);
      newServers.push({
        id: nextId,
        name: item.name,
        ip: item.ip,
        status: 'online',
        os: item.os,
        hostname: item.hostname ?? `host-${nextId.toString().padStart(2, '0')}`,
        location: item.location ?? '',
        uptimeSeconds: 0,
        cpuUsage: rand(10, 50),
        memUsage: rand(20, 50),
        memTotalGB: 32,
        diskUsage: rand(20, 50),
        diskTotalGB: 512,
        netInKbps: rand(100, 500),
        netOutKbps: rand(100, 500),
        groupId: params.groupId
      });
      nextId += 1;
    });
    setState({ ...state, servers: [...state.servers, ...newServers], nextServerId: nextId });
    return { success: success.length, failed: errors.length, errors };
  });
}

// ============ 保留原有函数(兼容 batch 1) ============

/** 服务器列表(向后兼容,返回第一页) */
export function makeServerList(): Api.Server.ServerList {
  const state = getState();
  const pageSize = 10;
  const rows = state.servers.slice(0, pageSize);
  return { rows, pageNum: 1, pageSize, total: state.servers.length };
}

/** 服务器详情(从 state 查找或生成) */
export function makeServerDetail(id: CommonType.IdType): Api.Server.ServerDetail {
  const state = getState();
  const base = state.servers.find(s => s.id === id) ?? makeServer(1, 13);
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

/** 服务器指标(历史数据) */
export function makeServerMetrics(range: Api.Server.MetricRange): Api.Server.ServerMetrics {
  const points = range === '7d' ? 28 : range === '24h' ? 24 : range === '6h' ? 12 : 12;
  const gen = (base: number, spread: number): Api.Server.MetricPoint[] =>
    Array.from({ length: points }).map((_, i) => ({
      time: range === '7d' ? `D-${points - i}` : `${i * (range === '24h' ? 1 : range === '6h' ? 30 : 5)}m`,
      value: Math.max(0, Math.min(100, base + rand(-spread, spread)))
    }));
  return { cpu: gen(45, 25), mem: gen(62, 15), disk: gen(70, 8), net: gen(60, 30) };
}

/** 操作日志 */
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

/** 主机凭据(从详情派生) */
export function makeServerCredential(id: CommonType.IdType): Api.Server.HostCredential {
  const detail = makeServerDetail(id);
  return detail.credential!;
}