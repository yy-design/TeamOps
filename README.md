# TeamOps

TeamOps 是一个面向 React 前端岗位作品集的全栈企业级项目协作与工单管理系统。它用真实后台业务场景展示 React、TypeScript、Ant Design、路由守卫、RBAC 权限、RESTful API、Prisma 数据建模、测试和本地部署能力。

## 功能亮点

- JWT 登录认证与路由保护
- RBAC + 项目成员权限：管理员、项目经理、普通成员与 OWNER / MEMBER / VIEWER 项目角色
- Dashboard 数据看板：项目数、活跃任务、逾期任务、完成率、趋势图和负载图
- 项目管理：项目列表、新建、编辑、删除、成员与观察者、负责人、状态、任务统计和基于 DONE 任务自动聚合的进度
- Sprint 迭代：规划/启动/结束状态机、单活迭代、WIP 在制任务上限、使用引导和未完成任务安全回退 Backlog
- AI Copilot：OpenAI-compatible 模型流式对话、按用户隔离的会话历史、权限感知业务工具、Agent Run/Step 执行轨迹、Sprint 智能方案与人工审批后执行
- 任务中心：任务列表、迭代归属、看板视图、新建、编辑、删除、筛选、受控状态流转、负责人审核、详情 Drawer 和评论
- 用户管理：管理员可新增用户、编辑用户、分配角色、启用或禁用账号、搜索用户
- 消息通知：任务分配、评论提醒、未读计数、SSE 实时刷新、单条已读和全部已读
- 系统设置：明亮/暗黑/跟随系统主题、主色切换、紧凑模式、个人信息编辑
- Ant Design 企业后台 UI、响应式布局、主题 token 定制和常用表单/表格/Modal/Drawer 交互
- Express + Prisma + PostgreSQL 后端，包含版本化迁移和 Swagger API 文档
- Docker Compose 编排 PostgreSQL、API 和 Nginx Web，GitHub Actions 自动执行校验
- Vitest、React Testing Library、Supertest 基础测试

## 技术栈

```text
React 18 + TypeScript + Vite
Ant Design + Ant Design Charts
React Router + TanStack Query + Zustand
Vercel AI SDK + DeepSeek + Markdown
Express + Prisma + PostgreSQL + JWT
Vitest + React Testing Library + Supertest
```

## 目录结构

```text
apps/
  api/      Express REST API, Prisma schema, seed and backend tests
  web/      React + Vite frontend application
packages/
  shared/   Shared TypeScript DTOs and domain types
```

## 本地运行

复制 API 环境变量。AI Copilot 使用 OpenAI-compatible Provider；默认示例连接 DeepSeek，也可通过 `MODEL_BASE_URL`、`MODEL_NAME` 接入 Ollama 或 vLLM。未配置模型不会影响其他业务功能：

```bash
cp .env.example apps/api/.env
# 编辑 apps/api/.env
# MODEL_API_KEY="你的 API Key"
# MODEL_BASE_URL="https://api.deepseek.com/v1"
# MODEL_NAME="deepseek-chat"
```

`DEEPSEEK_API_KEY` 仍作为 `MODEL_API_KEY` 未配置时的兼容回退。

安装依赖：

```bash
npm install
```

启动 PostgreSQL，并执行版本化迁移和演示数据导入：

```bash
docker compose up -d db
npm run db:migrate
npm run db:seed
```

启动前后端开发服务：

```bash
npm run dev
```

访问：

```text
Web: http://localhost:5173
API: http://localhost:4000
Swagger: http://localhost:4000/docs
```

## Docker 一键运行

生产模式必须提供非默认 `JWT_SECRET`，否则 API 会拒绝启动：

```bash
JWT_SECRET="$(openssl rand -hex 32)" DEEPSEEK_API_KEY="你的 API Key" docker compose up -d --build
```

首次启动后导入演示数据：

```bash
docker compose exec api npm run db:seed -w @teamops/api
```

访问 `http://localhost:8080`。`docker compose down` 会停止服务但保留 PostgreSQL volume。

## 演示账号

```text
管理员：admin@teamops.dev / TeamOps123!
项目经理：manager@teamops.dev / TeamOps123!
普通成员：member@teamops.dev / TeamOps123!
```

## 常用命令

```bash
npm run test
npm run build
npm run lint
npm run prisma:generate
npm run db:migrate
npm run db:migrate:dev
npm run db:seed
npm run db:studio
```
## 已实现功能

### 登录与权限系统

- 登录 / 退出登录
- JWT 鉴权
- 前端路由守卫
- 后端接口鉴权
- 管理员、项目经理、普通成员三类系统角色
- OWNER、MEMBER、VIEWER 三类项目角色
- 管理员全局管理；项目经理管理自己负责的项目并给项目成员分派任务；普通成员只能处理被指派任务
- API 返回资源 capability，前端按钮和状态选项与服务端权限保持一致

### 项目、Sprint 与任务管理

- 项目列表、新建、编辑、删除，项目进度由 DONE 任务占比自动计算
- Sprint 规划、启动和结束，一个项目只能存在一个 ACTIVE Sprint
- Sprint WIP 上限限制同时处于 IN_PROGRESS / REVIEW 的任务数量
- 结束 Sprint 时会展示未完成任务；确认后在同一数据库事务中将这些任务重置为 BACKLOG 并解除迭代关联，DONE 任务保留用于复盘
- 任务列表、新建、编辑、删除
- 任务状态机：BACKLOG → IN_PROGRESS → REVIEW → DONE，并支持 BLOCKED
- REVIEW → DONE 需要项目负责人或管理员审核
- 项目、任务、通知、评论和活动日志的关联写入使用数据库事务
- 优先级：LOW、MEDIUM、HIGH、URGENT
- 负责人、截止日期、项目归属维护
- 搜索、状态筛选、项目筛选、负责人筛选
- 表格视图和看板视图
- 任务详情 Drawer
- 评论区
- Dashboard 最近动态

### Dashboard

- 项目总数
- 活跃任务数
- 逾期任务数
- 任务完成率
- 任务状态分布
- 成员工作量
- 最近动态

### 用户管理

- 用户列表
- 新增用户
- 编辑用户
- 分配角色
- 启用 / 禁用用户
- 搜索用户
- 管理员权限控制

### 通知与消息中心

- 任务分配通知
- 评论提醒通知
- 未读数量
- 单条标记已读
- 全部标记已读

### 设置与主题定制

- 明亮 / 暗黑 / 跟随系统主题
- 主色切换
- 紧凑模式
- 任务到期提醒偏好
- 个人资料编辑

### AI Copilot 与 Sprint Planning Agent

- OpenAI-compatible 模型 Token 流式输出、停止生成和 Markdown 渲染；默认支持 DeepSeek，并可切换 Ollama / vLLM 等兼容服务
- 按登录用户隔离的对话创建、切换、重命名、删除和历史恢复
- `listProjects`、`listProjectTasks`、`inspectActiveSprint`、`getTeamWorkload` 四个权限感知查询工具
- `proposeSprintPlan` 根据延期、优先级、成员负载和 Backlog 生成结构化 Sprint Proposal，不直接修改业务数据
- 每次对话执行创建 `AgentRun`，工具和审批动作记录为 `AgentStep`，前端展示状态、顺序和耗时，可在刷新后回放
- Sprint Proposal 进入 `WAITING_APPROVAL`，只有发起者确认后才在 Serializable 事务中创建 Sprint、关联候选任务、写入活动日志并发送通知
- 审批使用版本号与条件更新防止重复点击和并发执行；执行前再次校验项目权限、任务状态和 Sprint 归属
- Tool Call 参数、实时状态、持久化执行轨迹和审批卡片均可视化
- Agent 工具继续使用 TeamOps 项目成员权限，无法读取或修改当前用户无权访问的项目
- Copilot 按需加载，不增加主业务入口体积

## 后续扩展

- Agent 流式中断恢复、失败重试与幂等补偿
- 项目文档 RAG、引用溯源与 Agent 效果评估
- Agent Operations Center 与 Delivery Command Center 可视化大屏
- MiniMind 意图分类、Query Rewrite 或风险标签专项实验
- 附件上传
- Redis Pub/Sub 支持多实例 SSE 广播
- 国际化切换
- 批量操作
- 任务依赖关系与关键路径
- 更完整的审计日志页面


