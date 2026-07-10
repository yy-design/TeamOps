# TeamOps

TeamOps 是一个面向 React 前端岗位作品集的全栈企业级项目协作与工单管理系统。它用真实后台业务场景展示 React、TypeScript、Ant Design、路由守卫、RBAC 权限、RESTful API、Prisma 数据建模、测试和本地部署能力。

## 功能亮点

- JWT 登录认证与路由保护
- RBAC 角色权限：管理员、项目经理、普通成员，不同角色看到不同菜单和操作
- Dashboard 数据看板：项目数、活跃任务、逾期任务、完成率、趋势图和负载图
- 项目管理：项目列表、新建、编辑、删除、负责人、状态、进度和任务统计
- 任务中心：任务列表、看板视图、新建、编辑、删除、筛选、状态流转、详情 Drawer 和评论
- 用户管理：管理员可新增用户、编辑用户、分配角色、启用或禁用账号、搜索用户
- 消息通知：任务分配、评论提醒、未读计数、单条已读和全部已读
- 系统设置：明亮/暗黑/跟随系统主题、主色切换、紧凑模式、个人信息编辑
- Ant Design 企业后台 UI、响应式布局、主题 token 定制和常用表单/表格/Modal/Drawer 交互
- Express + Prisma + SQLite 后端，包含 Swagger API 文档
- Vitest、React Testing Library、Supertest 基础测试

## 技术栈

```text
React 18 + TypeScript + Vite
Ant Design + Ant Design Charts
React Router + TanStack Query + Zustand
Express + Prisma + SQLite + JWT
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

复制环境变量：

```bash
cp .env.example apps/api/.env
```

安装依赖：

```bash
npm install
```

初始化数据库并导入演示数据：

```bash
npm run db:push
npm run db:seed
```

启动前后端：

```bash
npm run dev
```

访问：

```text
Web: http://localhost:5173
API: http://localhost:4000
Swagger: http://localhost:4000/docs
```

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
```
## 已实现功能

### 登录与权限系统

- 登录 / 退出登录
- JWT 鉴权
- 前端路由守卫
- 后端接口鉴权
- 管理员、项目经理、普通成员三类角色
- 管理员可管理用户；管理员和项目经理可管理项目；所有登录用户可维护任务和评论

### 项目与任务管理

- 项目列表、新建、编辑、删除
- 任务列表、新建、编辑、删除
- 任务状态流转：BACKLOG、IN_PROGRESS、REVIEW、DONE、BLOCKED
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

## 后续扩展

- 注册流程
- 附件上传
- WebSocket 实时通知
- 国际化切换
- 批量操作
- Sprint / 迭代管理
- 更完整的审计日志页面


