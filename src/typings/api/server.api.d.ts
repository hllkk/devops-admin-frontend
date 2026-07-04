/**
 * Namespace Api
 *
 * All backend api type
 */
declare namespace Api {
  /**
   * namespace Server
   *
   * backend api module: "server" (服务器管理)
   */
  namespace Server {
    /** 服务器状态 */
    type Status = 'online' | 'offline' | 'warning';

    /** 告警级别 */
    type AlertLevel = 'critical' | 'warning' | 'info';

    /** 指标时间范围 */
    type MetricRange = '1h' | '6h' | '24h' | '7d';

    /** 服务器 */
    interface Server {
      id: CommonType.IdType;
      name: string;
      ip: string;
      status: Status;
      os: string;
      hostname: string;
      location?: string;
      uptimeSeconds: number;
      cpuUsage: number;
      memUsage: number;
      memTotalGB: number;
      diskUsage: number;
      diskTotalGB: number;
      netInKbps?: number;
      netOutKbps?: number;
      groupId?: CommonType.IdType;
    }

    /** server search params */
    type ServerSearchParams = CommonType.RecordNullable<
      Pick<Server, 'name' | 'ip' | 'status'> & {
        groupId?: CommonType.IdType | null;
        os?: string | null;
        /** 是否包含子分组主机，默认 true（含子分组）；false=仅直属 */
        includeSubGroups?: boolean;
      } & Api.Common.CommonSearchParams
    >;

    /** server list */
    type ServerList = Api.Common.PaginatingQueryRecord<Server>;

    /** 主机凭据 */
    interface HostCredential {
      id: CommonType.IdType;
      type: 'ssh' | 'rdp';
      username: string;
      port: number;
      maskedSecret: string;
    }

    /** 服务器详情 */
    interface ServerDetail extends Server {
      cpuModel?: string;
      coreCount?: number;
      createdAt?: string;
      credential?: HostCredential;
    }

    /** 指标点 */
    interface MetricPoint {
      time: string;
      value: number;
    }

    /** 服务器指标 */
    interface ServerMetrics {
      cpu: MetricPoint[];
      mem: MetricPoint[];
      disk: MetricPoint[];
      net: MetricPoint[];
    }

    /** 总览统计 */
    interface OverviewStats {
      serverCount: number;
      containerCount: number;
      databaseCount: number;
      alertCount: number;
      cpuUsage: number;
      memUsage: number;
      diskUsage: number;
    }

    /** 实时指标 */
    interface RealtimeMetrics {
      timestamp: string;
      cpu: number;
      mem: number;
      disk: number;
      netInKbps: number;
      netOutKbps: number;
    }

    /** 告警项 */
    interface AlertItem {
      id: CommonType.IdType;
      level: AlertLevel;
      title: string;
      source: string;
      time: string;
    }

    /** 告警趋势项 */
    interface AlertTrendItem {
      date: string;
      critical: number;
      warning: number;
      info: number;
    }

    /** 任务趋势项 */
    interface TaskTrendItem {
      date: string;
      success: number;
      failed: number;
    }

    /** 操作日志 */
    interface OpLog {
      id: CommonType.IdType;
      time: string;
      action: string;
      operator: string;
      result: 'success' | 'failed';
    }

    /** 服务器分组(多级树) */
    interface ServerGroup {
      id: CommonType.IdType;
      parentId: CommonType.IdType;
      name: string;
      orderNum?: number;
      children?: ServerGroup[];
      serverCount?: number;
    }

    /** 分组树形数据 */
    type ServerGroupTree = ServerGroup[];

    /** 服务器操作系统(下拉选项) */
    type ServerOs = 'Ubuntu 22.04' | 'CentOS 7' | 'Debian 12' | 'Rocky 9' | 'Windows Server 2022' | string;

    /** 主机新增/编辑参数 */
    type ServerOperateParams = CommonType.RecordNullable<
      Pick<Server, 'name' | 'ip' | 'os' | 'hostname' | 'location' | 'uptimeSeconds'> & {
        groupId: CommonType.IdType;
        username: string;
        password?: string;
      }
    >;

    /** 导入单行(从 xlsx 解析) */
    interface ServerImportItem {
      name: string;
      ip: string;
      os: string;
      hostname?: string;
      location?: string;
      valid?: boolean;
      errorMessage?: string;
    }

    /** 导入响应 */
    interface ServerImportResponse {
      success: number;
      failed: number;
      errors: { row: number; message: string }[];
    }
  }
}
