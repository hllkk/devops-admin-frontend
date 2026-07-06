declare namespace Api {
  /**
   * namespace Gateway
   *
   * AI 网关模块
   */
  namespace Gateway {
    /** 供应商(与后端 ProviderResponse 一一对应) */
    interface Provider {
      id: number;
      name: string;
      providerType: string;
      billingType: string;
      monthlyBudget: string;
      monthlyUsed: string;
      isActive: boolean;
      description: string;
      config: Record<string, unknown>;
      credentialCount: number;
      createTime: string;
      updateTime: string;
    }

    /** 供应商分页响应(与后端 PageResponse 一一对应) */
    interface ProviderList {
      rows: Provider[];
      total: number;
      pageNum: number;
      pageSize: number;
    }

    /** 供应商搜索参数 */
    interface ProviderSearchParams {
      pageNum: number;
      pageSize: number;
      name?: string | null;
      providerType?: string | null;
      isActive?: boolean | null;
    }

    /** 供应商新增/编辑参数(与后端 Create/UpdateProviderRequest 一一对应) */
    interface ProviderOperateParams {
      id?: number;
      name: string;
      providerType: string;
      billingType: string;
      monthlyBudget?: string | null;
      isActive?: boolean;
      description?: string;
      config: Record<string, unknown> | null;
    }

    /** Dashboard 核心指标(1:1 对齐 AIHelms DashboardStatus) */
    interface DashboardStatus {
      activeUsers: number;
      activeUsersChange: number;
      todayRequests: number;
      totalRequests: number;
      llmRequests: number;
      mcpRequests: number;
      todayCost: number;
      internalCost: number;
      externalCost: number;
      costDiff: number;
      costChangePercent: number;
      pendingCount: number;
      pendingApprovals: number;
      pendingAlerts: number;
    }

    interface DashboardPeriod {
      startDate: string;
      endDate: string;
      label: string;
    }

    interface TrendPoint {
      label: string;
      hour: number;
      requests: number;
    }

    interface ResourceSummary {
      name: string;
      icon: string;
      total: number;
      active: number | null;
      activeLabel: string;
      linkPath: string;
    }

    interface RecentActivity {
      actor: string;
      action: string;
      timeAgo: string;
    }

    interface ServiceStatusItem {
      key: string;
      label: string;
      healthy: number;
      total: number;
      state: 'healthy' | 'warning' | 'danger' | 'empty';
      description: string;
    }

    interface PendingItem {
      id?: number;
      type: 'approval' | 'budget_alert';
      applicant?: string;
      resourceType?: string;
      resourceTypeLabel?: string;
      resourceName?: string;
      reason?: string;
      createdAt?: string | null;
      timeAgo: string;
      linkUrl: string;
    }

    /** Dashboard 聚合数据(1:1 对齐 AIHelms DashboardData，与后端 response 一一对应) */
    interface DashboardData {
      period: DashboardPeriod;
      lastUpdatedAt: string | null;
      lastUpdatedLabel: string;
      status: DashboardStatus;
      pendingItems: PendingItem[];
      pendingApprovalsList: PendingItem[];
      hourlyTrend: TrendPoint[];
      requestTrend: TrendPoint[];
      resources: ResourceSummary[];
      recentActivities: RecentActivity[];
      serviceStatus: ServiceStatusItem[];
    }
  }
}
