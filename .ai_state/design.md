# Design: Server Overview 卡片化与 Tab 固定

## Status: APPROVED
## Date: 2026-07-02
## Topic: server/dashboard 卡片化重写 + 路由 Tab 固定

### 背景

`/server/dashboard`（服务器概览）存在三个问题：

1. **Tab 排序问题**：`/server` 下 4 个子路由（dashboard / monitor / server-detail / server-list），打开 `/server` 时 Tab 列表的展示顺序不固定，dashboard 不一定在第 0 位。`/admin` 路由使用 `meta.fixedIndexInTab: 0` 显式锁死，server 路由缺失该配置。
2. **卡片化缺失**：当前 dashboard 顶部 4 个 `StatCard`（毛玻璃风格 + 数字 + 图标），没有「数据卡片」形式的渐变统计卡。用户曾经明确要求过概览页要卡片化。
3. **风格割裂**：dashboard 使用 `glass-card`（毛玻璃 + 半透明 + 12px 圆角），admin 首页使用 `card-wrapper`（浅色 + 8px 圆角 + 渐变统计卡 + CountTo 数字滚动）。两套视觉语言不一致。

### 调研参考

- `/home/devops-admin/frontend/src/views/admin/index.vue`
- `/home/devops-admin/frontend/src/views/admin/modules/card-data.vue`
- `/home/devops-admin/frontend/src/router/elegant/routes.ts:54-65`（admin fixedIndexInTab: 0 范式）
- `/home/devops-admin/frontend/src/views/server/dashboard/index.vue`（当前）
- `/home/devops-admin/frontend/uno.config.ts:21-25`（card-wrapper / glass-card 样式定义）

### MUST

| ID | 要求 |
|---|---|
| M1 | `server_dashboard` 路由 meta 增加 `fixedIndexInTab: 0`，与 admin 一致 |
| M2 | dashboard 顶部 4 个统计卡改为 admin 风格：4 色渐变背景 + `CountTo` 数字滚动 + `SvgIcon` 图标 + 卡片化布局 |
| M3 | 4 个统计卡使用 `<NGrid cols="s:1 m:2 l:4" responsive="screen">` 响应式栅格 |
| M4 | 资源仪表盘 / 告警趋势 / 最近告警三个区域外面用 `<NCard class="card-wrapper">` 包裹，去掉所有 `glass-card` |
| M5 | 中部双列布局使用 `<NGrid item-responsive>` + `<NGi span="24 s:24 m:14">` / `<NGi span="24 s:24 m:10">`，与 admin 14:10 分割一致 |
| M6 | 国际化 key 先在 `locale.d.ts` 声明类型，再补 zh-cn.ts / en-us.ts 翻译 |
| M7 | 渐变统计卡本地复刻 `GradientBg` 模式（`createReusableTemplate`），不抽到 `components/common`，避免侵入 admin |
| M8 | `pnpm typecheck` 与 `pnpm lint` 必须 0 错误 |

### SHOULD

| ID | 要求 |
|---|---|
| S1 | 4 个统计卡颜色映射：服务器(蓝紫) / 容器(青蓝) / 数据库(琥珀) / 告警(粉红) |
| S2 | `gap` 变量在移动端为 0、桌面为 16（与 admin 一致） |
| S3 | 错误态：store.errorMsg 非空时顶部 4 统计卡用 NCard 内 NEmpty + 重试按钮 |
| S4 | 保留 10s 轮询 + 页面隐藏暂停 |
| S5 | 保留资源仪表盘的 ECharts Gauge 不变（外面 NCard 包裹） |
| S6 | 保留告警趋势的 ECharts LineChart 不变（外面 NCard 包裹） |
| S7 | 保留告警列表的 NList/NTag/NEmpty 不变（外面 NCard 包裹） |

### COULD（未做）

| ID | 要求 |
|---|---|
| C1 | mock 数据加 trend 字段 |
| C2 | 把 admin/CardData 抽成可复用通用组件 |
| C3 | 单元测试（admin/card-data.vue 也没有单测） |

### 验收标准

#### 自动化
- [ ] `pnpm typecheck` 退出码 0
- [ ] `pnpm lint` 退出码 0

#### 手工
- [ ] 打开 `/server`，Tab 列表第 0 位是「概览」
- [ ] `/server/dashboard` 4 个统计卡与 admin 首页 card-data 视觉一致（渐变色 + CountTo + 图标）
- [ ] 切换 `/server` → `/server/server-list` 再切回 `/server/dashboard`，Tab 顺序保持 dashboard 在第 0
- [ ] 亮色 / 暗色模式下，4 个统计卡 + 资源仪表盘 + 告警趋势 + 最近告警 4 个区域都正常显示
- [ ] 移动端宽度（< 768px）：4 个统计卡 1 列；中部双列区域堆叠；告警列表 1 列
- [ ] 错误态：mock 制造 1 个失败，顶部 4 卡显示重试按钮
- [ ] `grep -rn "glass-card" src/views/server/dashboard/` 为 0 结果
- [ ] `grep -rn "StatCard" src/views/server/dashboard/index.vue` 为 0 结果

### 涉及文件

| 文件 | 改动 |
|---|---|
| `src/router/elegant/routes.ts` | server_dashboard meta 增加 `fixedIndexInTab: 0` |
| `src/views/server/dashboard/index.vue` | 重写顶层布局 |
| `src/views/server/dashboard/modules/stat-card.vue` | **重写**：admin 渐变统计卡 |
| `src/views/server/dashboard/modules/resource-gauge.vue` | 不动 |
| `src/views/server/dashboard/modules/alert-trend-chart.vue` | 不动 |
| `src/views/server/dashboard/modules/recent-alert-list.vue` | 不动 |
| `src/locales/langs/zh-cn.ts` | 补全 4 个统计卡中文标题 |
| `src/locales/langs/en-us.ts` | 补全 4 个统计卡英文标题 |
| `src/typings/locale.d.ts` | 确认/补全 page.server.dashboard.* 类型键 |

### 不在范围

- 后端 Server 模块（独立任务）
- `/server/monitor` 监控大屏（暗色风格合理，保持）
- `/server/server-list` 列表页 / `/server/server-detail` 详情页

### 设计确认记录

- [x] 段 1：架构与数据流
- [x] 段 2：组件层与复用边界
- [x] 段 3：响应式 + 暗色 + 错误态
- [x] 段 4：测试与验收

### 下一步

调用 `frontend:plan-first` skill 产出实现计划。

---

# Design: 网盘模块组件复用优化

## Status: APPROVED
## Date: 2026-05-17
## Supersedes: 内部分享功能完善 (已完成)

## Overview
网盘模块（disk, favorite, recent, trash, my-share, shared-with-me, group-share）存在大量重复代码。
通过渐进式提取 composable 和合并相似组件，预计消除 ~1200 行重复代码。

## Constraints
- **MUST**: 功能不变，所有现有行为完整保留
- **MUST**: 每个阶段独立可验证
- **MUST**: 统一国际化（消除硬编码中文）
- **SHOULD**: TSX 渲染函数尽量放入 composable，页面使用 lang="ts"
- **COULD**: 简化 toolbar 的重复逻辑

## Phases

### Phase 1: 合并 shared-with-me + group-share
**Priority**: P0 (收益最大 ~500 行)

**核心差异点与参数化**:
| 差异 | shared-with-me | group-share | 参数化方式 |
|---|---|---|---|
| API shareType | `'user'` | `'dept'` | prop: `shareType` |
| 取消分享 API | fetchRejectInternalShare | fetchCancelInternalShare | 根据 shareType 自动切换 |
| 搜索/过滤栏 | 有 | 无 | prop: `showFilter` |
| Pending 状态 | 有（接受/拒绝） | 无 | 根据 shareType 条件渲染 |
| 保存到网盘 | 有 | 无 | 根据 shareType 条件渲染 |
| 来源列 | 有 | 无 | 根据 shareType 条件渲染 |
| 上下文菜单 | 动态权限过滤 | 静态 | 统一为动态方式 |
| 国际化 | 完全 i18n | 混合硬编码 | 统一 i18n |

**文件变更**:
| 文件 | 操作 |
|---|---|
| `src/views/shared-with-me/modules/share-list-page.vue` | 新建：通用分享列表组件 |
| `src/views/shared-with-me/index.vue` | 重写：引用通用组件，shareType='user' |
| `src/views/group-share/index.vue` | 重写：引用通用组件，shareType='dept' |

**Acceptance**:
- [ ] shared-with-me 功能与优化前完全一致
- [ ] group-share 功能与优化前完全一致
- [ ] 硬编码中文全部替换为 i18n

### Phase 2: 提取 useFilePreview composable
**Priority**: P1 (~150 行 × 4 文件受益)

**新建文件**: `src/hooks/business/disk/use-file-preview.ts`

**导出接口**:
```typescript
interface UseFilePreviewOptions {
  fileList: Ref<Api.Disk.FileItem[]>;
  onPreviewFile?: (file: Api.Disk.FileItem) => void;  // 文本/Office/PDF 预览回调
}

function useFilePreview(options: UseFilePreviewOptions) {
  return {
    // 视频
    videoPreviewFile, videoPreviewVisible, videoStreamBaseUrl,
    openVideoPreview, closeVideoPreview, handleVideoTokenUpdate,
    // 音频
    audioPreviewVisible, currentAudioIndex, audioPlaylist,
    openAudioPreview, closeAudioPreview, handleAudioOverlayClick,
    // 图片
    imagePreviewRef, openImagePreview,
    // 通用
    handleFileDblClick,
  };
}
```

**修改文件**: disk/index.vue, recent/index.vue, 合并后的 share-list-page.vue

**Acceptance**:
- [ ] disk 页面预览功能不变
- [ ] recent 页面预览功能不变
- [ ] 分享页面预览功能不变

### Phase 3: 提取工具 composables
**Priority**: P2 (~100 行)

**新建文件**:
- `src/hooks/business/disk/use-file-download.ts` — triggerBrowserDownload + 下载权限检查
- `src/utils/disk-format.ts` — formatDateTime, formatDateShort, contentTypeToFileType

**修改文件**: disk/index.vue, share-list-page.vue, my-share/index.vue

**Acceptance**:
- [ ] 下载功能不变
- [ ] 格式化显示不变

### Phase 4: 提取 useSimpleFileListPage composable
**Priority**: P3 (~40 行 × 3)

**新建文件**: `src/hooks/business/disk/use-simple-file-list.ts`

**导出接口**:
```typescript
interface UseSimpleFileListOptions {
  fileList: Ref<any[]>;
  loading: Ref<boolean>;
  sortFields: Record<string, string>;
  onGetData: () => Promise<void>;
}

function useSimpleFileList(options) {
  return {
    toggleView, handleClearSelection, handleSelectionChange,
    showEmpty, handleSort,
  };
}
```

**修改文件**: favorite/index.vue, trash/index.vue

**Acceptance**:
- [ ] favorite 功能不变
- [ ] trash 功能不变

## Global Acceptance Criteria
- [ ] pnpm typecheck 通过
- [ ] pnpm lint 通过
- [ ] 无硬编码中文（统一 i18n）
- [ ] 每阶段完成后用户手动验证功能

## TSX 影响评估
- 当前 18 个文件使用 lang="tsx"，主要用于 NDataTable 的 column render 函数
- 提取 composable 后，TSX render 函数放入 composable 返回，页面只需 lang="ts"
- 合并 shared-with-me/group-share 后少维护一份 TSX 代码
- TSX 不影响组件提取，因为 render 函数本质是普通 TypeScript 函数
