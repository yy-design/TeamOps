# TeamOps 权限模型

TeamOps 使用“系统角色 + 项目角色 + 资源关系”的组合授权模型，所有关键限制都由 API 强制执行，前端 capability 仅用于改善交互。

## 系统角色

| 能力 | ADMIN | MANAGER | MEMBER |
|---|---|---|---|
| 用户管理 | 全部 | 无 | 无 |
| 创建项目 | 可以，可指定负责人 | 可以，负责人为自己 | 不可以 |
| 查看项目 | 全部 | 作为项目成员的项目 | 作为项目成员的项目 |
| 管理项目 | 全部 | 自己负责的项目 | 不可以 |

## 项目角色

- `OWNER`：项目负责人，可维护项目、成员、任务元数据并审核任务。
- `MEMBER`：项目成员，可查看项目任务；被指派后可推进状态和评论。
- `VIEWER`：观察者，只能查看项目及任务。
- 每个项目恰好有一个 OWNER，并与 `Project.ownerId` 保持一致。

## 任务权限与状态机

- 只有 ADMIN 或项目 OWNER 可以创建、分派、编辑和删除任务。
- 负责人必须是项目内有效的 OWNER 或 MEMBER，VIEWER 不能接收任务。
- 任务必须从 `BACKLOG` 创建，状态只能按下列规则流转：

```text
BACKLOG -> IN_PROGRESS | BLOCKED
IN_PROGRESS -> REVIEW | BLOCKED
REVIEW -> IN_PROGRESS | DONE
BLOCKED -> BACKLOG | IN_PROGRESS
DONE -> IN_PROGRESS
```

- 普通负责人不能把 `REVIEW` 改为 `DONE`；只有 ADMIN 或项目 OWNER 可以审批完成。
- 状态通过 `PATCH /tasks/:id/status` 修改，元数据通过 `PATCH /tasks/:id` 修改。
- 项目进度由 DONE 任务占比自动聚合，客户端不能手工修改。
- Sprint 只允许 `PLANNING -> ACTIVE -> COMPLETED`，每个项目仅一个 ACTIVE Sprint。
- Sprint 的 IN_PROGRESS / REVIEW 任务受 WIP 上限约束，仍有未完成任务时不能结束 Sprint。

## 安全和一致性

- JWT 每次请求都会重新查询用户状态和最新系统角色。
- 生产环境必须配置非默认 `JWT_SECRET`，否则 API 拒绝启动。
- 项目创建/更新、任务创建/更新、状态流转和评论副作用使用数据库事务。
- API 返回 `capabilities` 和 `allowedTransitions`，页面不重复猜测后端权限。
