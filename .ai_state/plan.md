# Plan — Server Overview 卡片化与 Tab 固定

## 任务列表

### Phase A: 基础设施 (无外部依赖, 先做)

- [ ] **T-A1**: 路由 meta 调整 — 在 `src/router/elegant/routes.ts` 中给 `server_dashboard` 路由 meta 增加 `fixedIndexInTab: 0`，与 admin 路由范式一致
  - 文件: `src/router/elegant/routes.ts` (line 322-329 附近)
  - 验收: routes.ts 编译通过；`pnpm typecheck` 0 错误；打开 /server 时 Tab 第 0 位是「概览」
  - 依赖: 无

- [ ] **T-A2**: 国际化文案核对 — 检查 `src/locales/langs/zh-cn.ts` 与 `en-us.ts` 中 `page.server.dashboard.{serverCount, containerCount, databaseCount, alertCount, resourceOverview, alertTrend, recentAlerts}` 是否齐全，若 en-us.ts 缺失则补全
  - 文件: `src/locales/langs/zh-cn.ts` (line 1420-1431 已确认完整), `src/locales/langs/en-us.ts`
  - 验收: zh-cn.ts 已有 4 个统计标题 + 3 个区域标题；en-us.ts 对应 7 个 key 齐全；若缺失则补全
  - 依赖: 无
  - 注: `App.I18n.Schema` 类型在 `app.d.ts:329` 由 zh-cn 自动推导，无需手动声明类型

### Phase B: 核心组件重写 (依赖 T-A1/A2)

- [ ] **T-B1**: 重写 `modules/stat-card.vue` 为 admin 渐变统计卡
  - 文件: `src/views/server/dashboard/modules/stat-card.vue`
  - 验收:
    - 接受 props: `key`(string, 唯一键) / `title`(string) / `value`(number) / `unit`(string, 默认 '') / `icon`(string, iconify 名) / `color`({start, end})
    - 使用 `createReusableTemplate<{ gradientColor: string }>` 定义内部 GradientBg 模板
    - 数字用 `<CountTo :prefix="unit" :start-value="1" :end-value="value" class="text-30px text-white dark:text-dark" />` 渲染
    - 标题 `<h3 class="text-16px">` + 图标 `<SvgIcon :icon="icon" class="text-32px" />`
    - 主题圆角动态读取 `useThemeStore().themeRadius`
    - 颜色用 inline style 绑定（与原 accentColor 模式一致）
    - 组件结构按项目规范：导入 → defineOptions({name: 'StatCard'}) → interface Props → withDefaults → GradientBg define → 模板
  - 依赖: 无（独立组件）

- [ ] **T-B2**: 重写 `dashboard/index.vue` 顶层布局，对齐 admin 风格
  - 文件: `src/views/server/dashboard/index.vue`
  - 验收:
    - 删除原 `<div class="grid grid-cols-2 gap-16px lg:grid-cols-4">` + 4×StatCard 结构
    - 改为 3 行布局:
      - Row 1: `<NGrid cols="s:1 m:2 l:4" responsive="screen" :x-gap="16" :y-gap="16">` 包裹 4 个新 StatCard，数据来自 store.overviewStats
      - Row 2: `<NGrid :x-gap="gap" :y-gap="16" responsive="screen" item-responsive>` + 2×`<NGi span="24 s:24 m:14/10">` 各自包 `<NCard :bordered="false" class="card-wrapper">` 装 ResourceGauge / AlertTrendChart
      - Row 3: `<NCard :bordered="false" class="card-wrapper">` 包 RecentAlertList
    - 引入 `useAppStore` 算 `gap = computed(() => appStore.isMobile ? 0 : 16)`
    - 颜色映射：服务器 start=#ec4786/end=#b955a4 / 容器 start=#56cdf3/end=#719de3 / 数据库 start=#865ec0/end=#5144b4 / 告警 start=#fcbc25/end=#f68057（参考 admin card-data 配色，告警用警告色系）
    - 错误态保留：store.errorMsg 非空时 4 统计卡区域显示 NEmpty + 重试按钮
    - `<NSpin :show="store.loading && !stats">` 保留
    - 整个文件不再使用 `glass-card` class，删除原 line 68 / 76 / 97 / 104 的 `glass-card` 引用
  - 依赖: T-B1

- [ ] **T-B3**: 静态扫描验证
  - 文件: 无新增
  - 验收:
    - `grep -rn "glass-card" src/views/server/dashboard/` 输出 0 行
    - `grep -rn "StatCard" src/views/server/dashboard/index.vue` 输出 0 行（已被新统计卡替代）
  - 依赖: T-B2

### Phase C: 自动化验证

- [ ] **T-C1**: pnpm typecheck + pnpm lint 双 0 错误
  - 文件: 无新增
  - 验收: `pnpm typecheck` 退出码 0；`pnpm lint` 退出码 0；如遇错误则修复
  - 依赖: T-B3, T-A1, T-A2

- [ ] **T-C2**: 手工视觉验证（按 design.md 验收清单）
  - 文件: 无新增
  - 验收清单（用户/Claude 各 4 项）:
    1. 打开 /server，Tab 列表第 0 位是「概览」
    2. 4 个统计卡与 admin 首页 card-data 视觉一致（渐变色 + CountTo + 图标）
    3. 切换 /server/server-list 再切回 /server/dashboard，dashboard 仍在 Tab 0
    4. 亮色 / 暗色模式下 4 区域都正常显示
    5. 移动端宽度（< 768px）：4 个统计卡 1 列；中部双列区域堆叠
    6. 制造 1 个 mock 失败，顶部 4 卡显示重试按钮
  - 依赖: T-C1

## 任务拓扑

```
T-A1 (路由 meta)        T-A2 (i18n 核对)
        │                       │
        └───────┬───────────────┘
                │
              T-B1 (stat-card.vue 重写)
                │
              T-B2 (index.vue 重写)
                │
              T-B3 (静态扫描)
                │
              T-C1 (typecheck + lint)
                │
              T-C2 (手工验证)
```

可并行:
- T-A1 与 T-A2 互相独立, 可并行
- T-B1 完成后 T-B2 强依赖

## 总计: 7 个任务 (T-A1, T-A2, T-B1, T-B2, T-B3, T-C1, T-C2)

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| CountTo 数字动画在 4 个统计卡同时刷新有性能问题 | 4 个 DOM 节点远低于阈值, 与 admin 一致 |
| 删除 glass-card 后某些暗色场景视觉突兀 | card-wrapper 依赖 NCard 主题自动适配, 实测 admin 暗色正常 |
| 国际化 key 缺失导致 typecheck 失败 | T-A2 先核对 en-us.ts, 缺失则补全; zh-cn 已确认完整 |
| route meta 修改后多 TAB 排序异常 | 仅加 fixedIndexInTab: 0, 不动其他子路由 meta, 风险可控 |

## 不在本次范围

- 后端 Server 模块 (独立任务)
- /server/monitor 监控大屏 (暗色风格合理, 保持)
- /server/server-list 列表页 / /server/server-detail 详情页
- 单元测试 (admin/card-data.vue 也没有单测, 跟随)

---

# Plan — 网盘模块组件复用优化

## 任务列表

### Phase 1: 合并 shared-with-me + group-share

- [ ] T-001: 补充 group-share 缺失的 i18n 翻译 key（zh-cn.ts + en-us.ts），覆盖权限标签(下载/上传/编辑/删除)、表格列头(文件名/分享者/权限/大小/分享时间/过期时间/修改时间)、操作文案(退出共享/返回/已选中N项)、消息提示(预览不支持/下载失败/关闭视频/退出成功)、永久有效/来自等
      文件: src/locales/langs/zh-cn.ts, src/locales/langs/en-us.ts, src/typings/app.d.ts (PageGroupShare 类型)
      验收: 所有 group-share 中的硬编码中文都有对应的 i18n key，且类型定义完整
      依赖: 无

- [ ] T-002: 新建 share-list-page.vue 通用分享列表组件，接受 props: shareType('user'|'dept'), showFilter(boolean)。将 shared-with-me/index.vue 和 group-share/index.vue 的公共逻辑合并：分页列表 + 文件夹浏览双模式、enterSharedFolder/exitSharedFolder/getFolderContents/breadcrumbClick、handleFileDblClick 预览路由、handleShareFile、handleRenameConfirm、handleBatchCancel (根据 shareType 自动选择 cancel API)、handleDownload、handleCtxMenuSelect、表格列定义(shareColumns/folderColumns 根据 shareType 条件渲染来源列和 pending 列)、移动端卡片布局、上下文菜单、音频/视频/图片预览。shareType='user' 额外渲染：搜索过滤栏、pending 接受/拒绝按钮、保存到网盘、来源列、权限过滤上下文菜单
      文件: src/views/shared-with-me/modules/share-list-page.vue (新建)
      验收: 组件接受 shareType 和 showFilter props，所有 shareType 相关差异通过条件分支处理；所有文本使用 i18n；lang="tsx" 仅用于 column render 函数
      依赖: T-001

- [ ] T-003: 重写 shared-with-me/index.vue 为薄壳，仅引用 ShareListPage 并传 shareType='user' showFilter=true
      文件: src/views/shared-with-me/index.vue
      验收: 页面功能与原版完全一致（搜索过滤、pending 接受/拒绝、保存到网盘、来源列、权限过滤菜单）；行数 < 30
      依赖: T-002

- [ ] T-004: 重写 group-share/index.vue 为薄壳，仅引用 ShareListPage 并传 shareType='dept' showFilter=false
      文件: src/views/group-share/index.vue
      验收: 页面功能与原版完全一致（无搜索过滤、无 pending、无保存到网盘）；硬编码中文已替换为 i18n；行数 < 30
      依赖: T-002

- [ ] T-005: Phase 1 验证 — 运行 pnpm typecheck + pnpm lint，用户手动测试 shared-with-me 和 group-share 的全部功能
      文件: 无新增
      验收: typecheck 零错误；lint 无新增错误；用户确认两个页面功能不变
      依赖: T-003, T-004

### Phase 2: 提取 useFilePreview composable

- [ ] T-006: 新建 use-file-preview.ts，封装视频/音频/图片预览状态和操作。接收 fileList: Ref<Api.Disk.FileItem[]> 和 onPreviewFile 回调。导出：视频(videoPreviewFile, videoPreviewVisible, videoStreamBaseUrl, openVideoPreview, closeVideoPreview, handleVideoTokenUpdate)、音频(audioPreviewVisible, currentAudioIndex, audioPlaylist, openAudioPreview, closeAudioPreview, handleAudioOverlayClick)、图片(imagePreviewRef, openImagePreview)、通用 handleFileDblClick
      文件: src/hooks/business/disk/use-file-preview.ts (新建)
      验收: 导出接口与 design.md 一致；TypeScript 编译通过；所有状态使用 ref/computed 管理
      依赖: T-005

- [ ] T-007: 重构 disk/index.vue，用 useFilePreview 替换内联的视频/音频/图片预览代码，删除对应 ref/function/模板绑定，改用 composable 返回值
      文件: src/views/disk/index.vue
      验收: disk 页面的视频/音频/图片预览功能与原版一致；代码行数减少
      依赖: T-006

- [ ] T-008: 重构 recent/index.vue，用 useFilePreview 替换内联预览代码
      文件: src/views/recent/index.vue
      验收: recent 页面的预览功能与原版一致
      依赖: T-006

- [ ] T-009: 重构 share-list-page.vue（Phase 1 合并后的通用组件），用 useFilePreview 替换内联预览代码
      文件: src/views/shared-with-me/modules/share-list-page.vue
      验收: shared-with-me 和 group-share 的预览功能与原版一致
      依赖: T-006, T-002

- [ ] T-010: Phase 2 验证 — pnpm typecheck + pnpm lint + 用户测试 disk/recent/shared-with-me/group-share 的预览功能
      文件: 无新增
      验收: typecheck 零错误；lint 无新增错误；视频/音频/图片/文本预览全部正常
      依赖: T-007, T-008, T-009

### Phase 3: 提取工具 composables

- [ ] T-011: 新建 src/utils/disk-format.ts，提取 formatDateTime(dateStr)、formatDateShort(dateStr)、contentTypeToFileType(contentType, isFolder) 三个纯函数
      文件: src/utils/disk-format.ts (新建)
      验收: 函数签名和返回值与原 my-share/shared-with-me/group-share 中的实现一致
      依赖: T-005

- [ ] T-012: 新建 use-file-download.ts，封装 triggerBrowserDownload(downloadUrl) 和 handleDownload(files) (含权限检查 fetchIsAllowDownload/fetchIsAllowPackageDownload)，统一单文件/多文件下载路由
      文件: src/hooks/business/disk/use-file-download.ts (新建)
      验收: 下载流程（权限检查→URL获取→浏览器触发）与原版一致
      依赖: T-005

- [ ] T-013: 重构 disk/index.vue, share-list-page.vue, my-share/index.vue，用 disk-format 工具和 use-file-download 替换内联的格式化函数和下载代码
      文件: src/views/disk/index.vue, src/views/shared-with-me/modules/share-list-page.vue, src/views/my-share/index.vue
      验收: 格式化显示和下载功能与原版一致
      依赖: T-011, T-012

- [ ] T-014: Phase 3 验证 — pnpm typecheck + pnpm lint + 用户测试下载和格式化功能
      文件: 无新增
      验收: typecheck 零错误；lint 无新增错误；下载、文件大小/时间格式化显示正常
      依赖: T-013

### Phase 4: 提取 useSimpleFileListPage composable

- [ ] T-015: 新建 use-simple-file-list.ts，封装 toggleView()、handleClearSelection()、handleSelectionChange(files)、showEmpty 计算属性、handleSort(field, order)。接收 fileList/ loading ref、sortFields 映射、onGetData 回调
      文件: src/hooks/business/disk/use-simple-file-list.ts (新建)
      验收: 导出接口与 design.md 一致；TypeScript 编译通过
      依赖: T-005

- [ ] T-016: 重构 favorite/index.vue，用 useSimpleFileList 替换内联的视图切换/选择/排序/空状态代码
      文件: src/views/favorite/index.vue
      验收: favorite 页面的视图切换、选择、排序、空状态功能与原版一致
      依赖: T-015

- [ ] T-017: 重构 trash/index.vue，用 useSimpleFileList 替换内联代码
      文件: src/views/trash/index.vue
      验收: trash 页面功能与原版一致
      依赖: T-015

- [ ] T-018: 最终验证 — pnpm typecheck + pnpm lint + 用户全量回归测试所有网盘页面
      文件: 无新增
      验收: typecheck 零错误；lint 无新增错误；disk/favorite/recent/trash/my-share/shared-with-me/group-share 功能全部正常
      依赖: T-016, T-017

## 任务拓扑

```
Phase 1:
T-001 (i18n keys)
  │
  └→ T-002 (share-list-page.vue 通用组件)
       ├→ T-003 (shared-with-me 薄壳)
       └→ T-004 (group-share 薄壳)
            │
          T-005 (Phase 1 验证)

Phase 2 (依赖 Phase 1):
T-006 (use-file-preview.ts)
  ├→ T-007 (disk 重构)
  ├→ T-008 (recent 重构)
  └→ T-009 (share-list-page 重构)
       │
     T-010 (Phase 2 验证)

Phase 3 (可与 Phase 2 并行):
T-011 (disk-format.ts)  T-012 (use-file-download.ts)
  │                          │
  └──────────┬───────────────┘
             │
          T-013 (三文件重构)
             │
          T-014 (Phase 3 验证)

Phase 4:
T-015 (use-simple-file-list.ts)
  ├→ T-016 (favorite 重构)
  └→ T-017 (trash 重构)
       │
     T-018 (最终验证)
```

可并行:
- Phase 2 + Phase 3 之间无依赖，可并行执行
- T-007, T-008, T-009 互相独立，可并行
- T-016, T-017 互相独立，可并行

## 总计: 18 个任务, 4 个 Phase

## 对抗审查记录

CC 独立审查:
1. **i18n key 位置**: 现有 group-share 的 i18n key 分散在 page.disk.groupShare 和 page.shared-with-me 下，合并时需要统一为一个命名空间。T-001 需确保 key 不冲突。
2. **disk/index.vue 的 store 依赖**: disk 的音频/视频预览状态存在 diskStore 中（非本地 ref），useFilePreview 需要同时支持 store 和本地 ref 两种模式。T-006 设计时需注意。
3. **share-list-page.vue 的复杂度**: 合并后组件预计 600-700 行（原两个文件 2300+ 行），虽然大幅减少但仍需保持可读性。内部函数按功能分组并加注释。
4. **my-share 未合并**: my-share 结构差异较大（表格+卡片双布局，无文件夹浏览），不适合与 shared-with-me/group-share 合并，仅提取格式化工具函数。
5. **hooks 目录结构**: 新建 hooks/business/disk/ 子目录，遵循 upload/ 子目录的先例。
