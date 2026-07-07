declare namespace Api {
  /**
   * namespace Gateway
   *
   * AI 网关模块
   */
  namespace Gateway {
    /** 供应商(与后端 ProviderResponse 一一对应) */
    interface Provider {
      /** 供应商ID */
      id: number;
      /** 供应商名称 */
      name: string;
      /** 供应商类型(openai/claude/deepseek等) */
      providerType: string;
      /** 计费类型(token/per_call/monthly_quota) */
      billingType: string;
      /** 月度预算 */
      monthlyBudget: string;
      /** 月度已用金额 */
      monthlyUsed: string;
      /** 是否启用 */
      isActive: boolean;
      /** 供应商描述 */
      description: string;
      /** 供应商配置(JSON) */
      config: Record<string, unknown>;
      /** 关联凭证数量 */
      credentialCount: number;
      /** 创建时间 */
      createTime: string;
      /** 更新时间 */
      updateTime: string;
    }

    /** 供应商分页响应(与后端 PageResponse 一一对应) */
    interface ProviderList {
      /** 供应商列表 */
      rows: Provider[];
      /** 总记录数 */
      total: number;
      /** 当前页码 */
      pageNum: number;
      /** 每页条数 */
      pageSize: number;
    }

    /** 供应商搜索参数 */
    interface ProviderSearchParams {
      /** 页码 */
      pageNum: number;
      /** 每页条数 */
      pageSize: number;
      /** 供应商名称(模糊搜索) */
      name?: string | null;
      /** 供应商类型(精确匹配) */
      providerType?: string | null;
      /** 是否启用 */
      isActive?: boolean | null;
    }

    /** 供应商新增/编辑参数(与后端 Create/UpdateProviderRequest 一一对应) */
    interface ProviderOperateParams {
      /** 供应商ID(编辑时必填) */
      id?: number;
      /** 供应商名称 */
      name: string;
      /** 供应商类型 */
      providerType: string;
      /** 计费类型 */
      billingType: string;
      /** 月度预算 */
      monthlyBudget?: string | null;
      /** 是否启用 */
      isActive?: boolean;
      /** 描述 */
      description?: string;
      /** 配置(JSON对象) */
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

    /** 项目(与后端 ProjectResponse 一一对应) */
    interface Project {
      /** 项目ID */
      id: number;
      /** 项目名称 */
      name: string;
      /** 项目描述 */
      description: string;
      /** 是否启用 */
      isActive: boolean;
      /** LiteLLM团队ID */
      litellmTeamId: string;
      /** 成员数量 */
      memberCount: number;
      /** 创建时间 */
      createTime: string;
      /** 更新时间 */
      updateTime: string;
    }

    /** 项目分页响应 */
    interface ProjectList {
      /** 项目列表 */
      rows: Project[];
      /** 总记录数 */
      total: number;
      /** 当前页码 */
      pageNum: number;
      /** 每页条数 */
      pageSize: number;
    }

    /** 项目搜索参数 */
    interface ProjectSearchParams {
      /** 页码 */
      pageNum: number;
      /** 每页条数 */
      pageSize: number;
      /** 搜索关键词 */
      keyword?: string;
    }

    /** 项目操作参数 */
    interface ProjectOperateParams {
      /** 项目ID(编辑时必填) */
      id?: number;
      /** 项目名称 */
      name: string;
      /** 项目描述 */
      description: string;
    }

    /** 项目成员(与后端 ProjectMemberResponse 一一对应) */
    interface ProjectMember {
      /** 成员ID */
      id: number;
      /** 用户名 */
      username: string;
      /** 显示名称 */
      displayName: string;
      /** 职位 */
      position: string;
      /** 加入时间 */
      joinedAt: string;
    }

    /** AI Key 身份列表项(与后端 AiKeyIdentityItem 一一对应) */
    interface AiKeyIdentityItem {
      /** 用户信息 */
      user: AiKeyIdentityUser;
      /** 主Key */
      mainKey: AiKey | null;
      /** 场景Key列表 */
      sceneKeys: AiKey[];
    }

    /** AI Key身份用户信息 */
    interface AiKeyIdentityUser {
      /** 用户ID */
      id: number;
      /** 用户名 */
      username: string;
      /** 显示名称 */
      displayName: string;
      /** 部门名称 */
      departmentName: string;
    }

    /** AI Key(与后端 AiKeyResponse 一一对应) */
    interface AiKey {
      /** Key ID */
      id: number;
      /** Key名称 */
      name: string;
      /** 描述 */
      description: string;
      /** Key类型(main/scene) */
      keyType: string;
      /** 所有者类型(user/project) */
      ownerType: string;
      /** 所有者ID */
      ownerId: number;
      /** LiteLLM Key ID */
      litellmKeyId: string;
      /** 可用模型列表 */
      models: string[];
      /** 预算上限 */
      budgetLimit: string;
      /** 已用预算 */
      budgetUsed: string;
      /** TPM限制(每分钟Token数) */
      tpmLimit: number | null;
      /** RPM限制(每分钟请求数) */
      rpmLimit: number | null;
      /** 是否启用 */
      isActive: boolean;
      /** 过期时间 */
      expiresAt: string;
      /** 最后使用时间 */
      lastUsedAt: string;
      /** 创建时间 */
      createTime: string;
      /** 更新时间 */
      updateTime: string;
    }

    /** AI 身份列表(分页) */
    interface AiKeyIdentityList {
      /** 身份列表 */
      rows: AiKeyIdentityItem[];
      /** 总记录数 */
      total: number;
      /** 当前页码 */
      pageNum: number;
      /** 每页条数 */
      pageSize: number;
    }

    /** AI Key 操作参数 */
    interface AiKeyOperateParams {
      /** Key ID(编辑时必填) */
      id?: number;
      /** Key名称 */
      name: string;
      /** 所有者类型 */
      ownerType: string;
      /** 所有者ID */
      ownerId: number;
      /** Key类型 */
      keyType?: string;
      /** 描述 */
      description: string;
      /** 可用模型列表 */
      models: string[];
      /** 预算上限 */
      budgetLimit?: string | null;
      /** TPM限制 */
      tpmLimit?: number | null;
      /** RPM限制 */
      rpmLimit?: number | null;
    }

    /** AI 身份搜索参数 */
    interface AiKeySearchParams {
      /** 标签页(main/scene) */
      tab: string;
      /** 搜索关键词 */
      keyword?: string;
      /** 页码 */
      pageNum: number;
      /** 每页条数 */
      pageSize: number;
    }
  }
}
