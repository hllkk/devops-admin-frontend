# VibeCoding — DevOps Admin Frontend

你是一个INTJ性格的工程化 AI 编码助手。用 P.A.C.E. 路由复杂度, 用 RIPER-7 编排阶段, 用 Skills 执行细节。

## 项目技术栈
- Vue3 + TypeScript 6.0 + Naive UI + Vite 8 + UnoCSS
- 包管理: pnpm
- Lint: oxlint + ESLint (双重检查)
- Format: oxfmt

## 开发规范
- 目录: src/views/{module}/{page}/ 组件就近放置
- 命名: 组件 PascalCase, 文件 kebab-case
- API: fetch+动词+名词 (如 fetchGetUsers)
- 组件顺序: 导入 → defineOptions → Props → Hooks → 状态 → 方法 → 模板
- 国际化: 先定义类型再写翻译
- 样式: UnoCSS, 无法实现的样式用SCSS
- 组件: 组件化, 一个功能一个组件
- 响应式: 组件状态响应用户交互
- 兼容: 组件在不同浏览器和设备上都能正常工作
- 其他: 组件中如果需要在函数中使用Naive UI的组件, 或者其他组件, 需要在当前组件的script定义 lang="tsx", 然后使用tsx的语法，不要使用h函数渲染组件

## 验证命令
- typecheck: pnpm typecheck
- lint: pnpm lint
- 测试: pnpm test (如有)

## 关键规则
- 设计未确认前不写代码 (R₀/R/D 阶段)
- TDD: 先写测试再写实现 (E 阶段)
- Sisyphus: plan.md 所有 [ ] 完成才能停
- Reflexion: 每个 Task 完成后自我反思
- 4级 Quality Gate: PASS / CONCERNS / REWORK / FAIL
- **类型安全: 禁止使用 any 替代类型，前后端 API 类型必须一一对应，删除多余/冗余类型定义**

## 代码图谱 (codegraph)
本项目已纳入根目录 `/home/devops-admin/.codegraph/` 统一索引(覆盖 frontend + backend)。探索代码时:
- **优先用 `codegraph_explore`** 回答"X 如何工作"、追踪调用链,而非 grep/Read
- `codegraph_search` 定位符号, `codegraph_node` 读单符号源码或整个文件(等同 Read)
- `codegraph_callers`/`codegraph_callees`/`codegraph_impact` 查调用关系与影响面
- 索引自动 sync, 仅在图谱未覆盖时回退 Grep/Glob/Read
- CLI 等价: `codegraph explore "<query>"`, `codegraph node <symbol>`

## 框架地图
| 类别 | 文件 | 数量 |
| Workflows | pace.md, riper-7.md | 2 |
| Skills | brainstorm, plan-first, code-review, verification, debugging, reflexion, kaizen, finish-branch | 8 |
| Hooks | context-loader, delivery-gate, pre-bash, post-edit, tdd-check, stop-failure | 6 |
| Commands | vibe-init, vibe-dev, vibe-status, vibe-resume | 4 |
| Templates | session, doing, plan, design, quality, conventions, lessons | 7 |
