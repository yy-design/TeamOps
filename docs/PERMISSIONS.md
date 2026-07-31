# TeamOps 权限系统实现说明

本文说明 TeamOps 当前权限系统的设计、请求链路和核心代码，便于开发、排查与后续扩展。

## 1. 总体设计

TeamOps 使用三层权限控制：

1. **认证（Authentication）**：JWT 识别当前用户是谁。
2. **角色权限（RBAC）**：判断角色是否具备某类操作能力。
3. **资源权限（Ownership / Data Scope）**：判断用户是否能访问某一条项目或任务。

前端同时根据权限隐藏菜单、按钮和筛选项，但前端仅负责交互体验，真正的安全边界始终是后端。

```text
登录成功
  ↓
服务端签发 JWT
  ↓
前端保存 token，并在请求头携带 Authorization
  ↓
requireAuth 验证 token，并从数据库刷新用户状态与角色
  ↓
需要角色门槛的接口通过 requireRole 检查角色能力
  ↓
路由根据 ownerId / assigneeId 限制数据范围
  ↓
Prisma 只查询或修改当前用户有权访问的数据
```

## 2. 当前角色和权限矩阵

角色定义位于 `packages/shared/src/index.ts`：

```ts
export type UserRole = 'ADMIN' | 'MANAGER' | 'MEMBER';
```

| 能力 | ADMIN | MANAGER | MEMBER |
|---|---|---|---|
| 查看工作台 | 全部数据 | 自己的数据 | 自己的数据 |
| 查看项目 | 全部项目 | 自己负责的项目 | 自己负责的项目 |
| 新建项目 | 可以，可指定负责人 | 可以，负责人强制为自己 | 可以，负责人强制为自己 |
| 编辑项目 | 任意项目 | 自己负责的项目 | 自己负责的项目 |
| 删除项目 | 任意项目 | 自己负责且不含他人任务的项目 | 自己负责且不含他人任务的项目 |
| 查看任务 | 全部任务 | 负责人为自己的任务 | 负责人为自己的任务 |
| 新建任务 | 可以，可指定负责人 | 只能在自己的项目中创建并分配给自己 | 只能在自己的项目中创建并分配给自己 |
| 修改/删除/流转任务 | 任意任务 | 负责人为自己的任务 | 负责人为自己的任务 |
| 发表评论 | 任意任务 | 负责人为自己的任务 | 负责人为自己的任务 |
| 用户管理 | 全部权限 | 无权限 | 无权限 |

## 3. JWT 身份认证

核心文件：`apps/api/src/middleware/auth.ts`

### 3.1 签发 Token

登录成功后，服务端把用户 ID、角色和邮箱签入 JWT，Token 有效期为 8 小时。

```ts
export interface AuthUser {
  id: string;
  role: UserRole;
  email: string;
}

export function signToken(user: AuthUser) {
  return jwt.sign(
    user,
    process.env.JWT_SECRET ?? 'teamops-local-secret-change-me',
    { expiresIn: '8h' }
  );
}
```

JWT 只用于携带身份线索。服务端不会直接信任 Token 中旧的角色，而是每次请求重新查询数据库。

### 3.2 验证 Token

```ts
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ')
    ? header.slice(7)
    : undefined;

  if (!token) {
    res.status(401).json({ message: 'Missing authorization token' });
    return;
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET ?? 'teamops-local-secret-change-me'
    ) as AuthUser;

    const user = await prisma.user.findUnique({
      where: { id: payload.id }
    });

    if (!user || !user.active) {
      res.status(401).json({
        message: 'User is inactive or no longer exists'
      });
      return;
    }

    req.user = {
      id: user.id,
      role: user.role as UserRole,
      email: user.email
    };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
```

关键点：

- 没有 Token：返回 `401`。
- Token 无效或过期：返回 `401`。
- 用户已被删除或禁用：返回 `401`。
- 用户角色被管理员修改后，下次请求立即读取到数据库中的新角色。
- 验证通过后，把可信身份写入 `req.user`，供后续权限逻辑使用。

> 生产环境必须配置足够随机的 `JWT_SECRET`，不要使用代码中的本地回退值。

## 4. RBAC 角色权限

核心文件：`apps/api/src/lib/permissions.ts`

角色采用等级模型：管理员高于项目经理，项目经理高于普通成员。

```ts
const roleRank: Record<UserRole, number> = {
  MEMBER: 1,
  MANAGER: 2,
  ADMIN: 3
};

export function canAccess(required: UserRole, actual: UserRole) {
  return roleRank[actual] >= roleRank[required];
}
```

例如，要求 `MANAGER` 权限时，MANAGER 和 ADMIN 都能访问，MEMBER 不能访问。

Express 中间件封装如下：

```ts
export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !canAccess(role, req.user.role)) {
      res.status(403).json({
        message: 'You do not have permission to perform this action'
      });
      return;
    }
    next();
  };
}
```

路由使用方式：

```ts
usersRouter.get(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (_req, res) => { /* ... */ }
);

projectsRouter.post(
  '/',
  requireAuth,
  async (req, res) => { /* ... */ }
);
```

`requireAuth` 必须在 `requireRole` 前面，因为角色判断依赖 `req.user`。项目管理不再设置角色门槛：所有登录用户都能创建项目并管理自己负责的项目；用户管理等全局能力仍由 `requireRole('ADMIN')` 限制。

## 5. 数据范围与资源归属

仅判断角色还不够。例如两个 MANAGER 都能“管理项目”，但不能因此互相编辑项目。TeamOps 进一步使用资源字段限制数据：

- 项目归属字段：`Project.ownerId`
- 任务归属字段：`Task.assigneeId`
- 管理员：跳过归属限制，拥有全局数据范围
- 非管理员：查询和写操作都必须匹配当前用户 ID

```ts
export function hasGlobalDataAccess(role: UserRole) {
  return role === 'ADMIN';
}
```

### 5.1 项目列表隔离

核心文件：`apps/api/src/routes/projects.ts`

```ts
projectsRouter.get('/', requireAuth, async (req, res) => {
  const isAdmin = hasGlobalDataAccess(req.user!.role);

  const projects = await prisma.project.findMany({
    where: isAdmin
      ? undefined
      : { ownerId: req.user!.id },
    include: {
      owner: true,
      tasks: isAdmin
        ? true
        : { where: { assigneeId: req.user!.id } }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(projects.map(toProjectDto));
});
```

这里不是先查询全部数据再在 JavaScript 中过滤，而是把数据范围直接放进 Prisma `where`。这样越权数据不会离开数据库。

### 5.2 创建项目时防止伪造负责人

前端提交的 `ownerId` 不可信。管理员可以指定负责人，非管理员提交的负责人则被服务端强制覆盖为本人。

```ts
const isAdmin = hasGlobalDataAccess(req.user!.role);

const project = await prisma.project.create({
  data: {
    ...parsed.data,
    ownerId: isAdmin
      ? parsed.data.ownerId
      : req.user!.id,
    dueDate: new Date(parsed.data.dueDate)
  },
  include: { owner: true, tasks: true }
});
```

即使非管理员修改浏览器请求，将 `ownerId` 改成别人，也不会生效。

### 5.3 修改项目时防止 IDOR

IDOR 指用户通过猜测或修改资源 ID，操作本不属于自己的数据。

```ts
const id = String(req.params.id);
const isAdmin = hasGlobalDataAccess(req.user!.role);

const existing = await prisma.project.findFirst({
  where: {
    id,
    ...(isAdmin ? {} : { ownerId: req.user!.id })
  }
});

if (!existing) {
  res.status(404).json({ message: 'Project not found' });
  return;
}
```

只有同时满足“ID 正确”和“资源属于当前用户”才继续修改。越权时返回 `404`，避免向调用者泄露该资源是否存在。

### 5.4 删除项目的级联保护

数据库中项目删除会级联删除任务，因此非管理员删除自己的项目时，还要检查其中是否存在分配给其他人的任务。

```ts
const project = await prisma.project.findFirst({
  where: {
    id,
    ...(isAdmin ? {} : { ownerId: req.user!.id })
  },
  include: {
    tasks: { select: { assigneeId: true } }
  }
});

if (!isAdmin && project.tasks.some(
  (task) => task.assigneeId !== req.user!.id
)) {
  res.status(409).json({
    message: '项目包含分配给其他成员的任务，请先转移任务或由管理员删除'
  });
  return;
}
```

这避免非管理员通过删除项目，间接删除其他成员负责的任务。

## 6. 任务权限实现

核心文件：`apps/api/src/routes/tasks.ts`

### 6.1 任务列表隔离

管理员可以使用请求中的 `assigneeId` 筛选任意负责人；非管理员的负责人条件永远强制为当前用户。

```ts
const isAdmin = hasGlobalDataAccess(req.user!.role);

const tasks = await prisma.task.findMany({
  where: {
    status: typeof status === 'string' && status !== 'ALL'
      ? status
      : undefined,
    projectId: typeof projectId === 'string' && projectId !== 'ALL'
      ? projectId
      : undefined,
    assigneeId: isAdmin
      ? (typeof assigneeId === 'string' && assigneeId !== 'ALL'
          ? assigneeId
          : undefined)
      : req.user!.id,
    title: typeof search === 'string' && search
      ? { contains: search }
      : undefined
  },
  include,
  orderBy: [
    { priority: 'desc' },
    { dueDate: 'asc' }
  ]
});
```

因此普通用户即使手工请求：

```http
GET /api/tasks?assigneeId=another-user-id
```

后端仍会使用 `req.user.id`，不会返回别人的任务。

### 6.2 创建任务

非管理员必须满足两个条件：

1. 目标项目由自己负责。
2. 任务负责人被强制设为自己。

```ts
const project = await prisma.project.findFirst({
  where: {
    id: parsed.data.projectId,
    ...(isAdmin ? {} : { ownerId: req.user!.id })
  }
});

if (!project) {
  res.status(403).json({
    message: 'You cannot create a task in this project'
  });
  return;
}

const assigneeId = isAdmin
  ? parsed.data.assigneeId
  : req.user!.id;
```

### 6.3 修改、删除和状态流转

所有写接口都重复应用相同的资源范围，而不是认为“列表过滤后就安全了”。以状态流转为例：

```ts
const existing = await prisma.task.findFirst({
  where: {
    id,
    ...(isAdmin ? {} : { assigneeId: req.user!.id })
  }
});

if (!existing) {
  res.status(404).json({ message: 'Task not found' });
  return;
}

await prisma.task.update({
  where: { id },
  data: parsed.data
});
```

相同的归属检查用于：

- `PATCH /api/tasks/:id`
- `PATCH /api/tasks/:id/status`
- `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/comments`

这是必要的，因为攻击者可以跳过页面，直接调用任意接口。

### 6.4 防止修改任务后逃逸权限范围

普通用户不能通过更新 `assigneeId` 把任务转移给别人：

```ts
const { assigneeId, projectId, ...updates } = parsed.data;

const task = await prisma.task.update({
  where: { id },
  data: {
    ...updates,
    projectId,
    assigneeId: isAdmin
      ? assigneeId
      : req.user!.id,
    dueDate: updates.dueDate
      ? new Date(updates.dueDate)
      : undefined
  },
  include
});
```

普通用户修改项目归属时，也只能移动到自己负责的项目。编辑时保留原项目不受此限制。

## 7. 工作台数据隔离

只隔离列表是不够的，否则普通用户仍可能从工作台统计看到全局数据。

核心文件：`apps/api/src/routes/dashboard.ts`

```ts
const isAdmin = req.user!.role === 'ADMIN';

const [projects, tasks, users, activities] = await Promise.all([
  prisma.project.findMany({
    where: isAdmin ? undefined : { ownerId: req.user!.id }
  }),
  prisma.task.findMany({
    where: isAdmin ? undefined : { assigneeId: req.user!.id },
    include: { assignee: true }
  }),
  isAdmin
    ? prisma.user.findMany({ where: { active: true } })
    : prisma.user.findMany({
        where: { id: req.user!.id, active: true }
      }),
  prisma.activityLog.findMany({
    where: isAdmin ? undefined : { actorId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 6
  })
]);
```

管理员看到全局统计；其他用户只看到自己的项目、任务、负载和操作动态。

## 8. 用户管理权限与安全删除

用户管理接口统一要求管理员权限：

```ts
usersRouter.get(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (_req, res) => { /* ... */ }
);
```

删除用户时还要保护当前登录账号，并检查关键业务关联。

```ts
if (id === req.user!.id) {
  res.status(400).json({ message: '不能删除当前登录账号' });
  return;
}

const businessRelations = {
  ownedProjects: user._count.ownedProjects,
  assignedTasks: user._count.assignedTasks,
  reportedTasks: user._count.reportedTasks,
  comments: user._count.comments
};

const hasBusinessData = Object.values(businessRelations)
  .some((count) => count > 0);

if (hasBusinessData) {
  res.status(409).json({
    message: '该用户仍有关联业务数据，请先转移数据或禁用账号'
  });
  return;
}
```

只有通知和操作日志不会阻止删除，它们会在事务中先被清理：

```ts
await prisma.$transaction([
  prisma.notification.deleteMany({ where: { userId: id } }),
  prisma.activityLog.deleteMany({ where: { actorId: id } }),
  prisma.user.delete({ where: { id } })
]);
```

## 9. 前端权限配合

### 9.1 自动携带 Token

核心文件：`apps/web/src/services/api.ts`

```ts
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

遇到 `401` 时清理登录状态：

```ts
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearSession();
    }
    return Promise.reject(error);
  }
);
```

### 9.2 会话存储与角色刷新

核心文件：`apps/web/src/store/authStore.ts`、`AppShell.tsx`

登录后 Token 和用户信息存入 Zustand，并持久化到 `localStorage`。进入应用后再次调用 `/auth/me`，刷新数据库中的最新角色和状态。

```ts
const { data: currentUser } = useQuery({
  queryKey: ['auth', 'me'],
  queryFn: authApi.me
});

useEffect(() => {
  if (currentUser) setUser(currentUser);
}, [currentUser, setUser]);
```

这可以避免管理员修改角色后，前端长期使用旧缓存。

### 9.3 路由守卫

核心文件：`apps/web/src/router/AppRouter.tsx`

```tsx
function ProtectedRoute() {
  const token = useAuthStore((state) => state.token);
  return token
    ? <Outlet />
    : <Navigate to="/login" replace />;
}

function AdminRoute() {
  const user = useAuthStore((state) => state.user);
  return user?.role === 'ADMIN'
    ? <Outlet />
    : <Navigate to="/dashboard" replace />;
}
```

用户管理页面被放在管理员路由下：

```tsx
<Route element={<AdminRoute />}>
  <Route path="/users" element={<UsersPage />} />
</Route>
```

因此非管理员即使手工输入 `/users`，也会跳转到工作台。

### 9.4 菜单和按钮控制

管理员菜单：

```tsx
const menuItems = [
  { key: '/dashboard', label: '工作台' },
  { key: '/projects', label: '项目管理' },
  { key: '/tasks', label: '任务中心' },
  ...(user?.role === 'ADMIN'
    ? [{ key: '/users', label: '用户管理' }]
    : [])
];
```

项目和任务列表已经由服务端按 `ownerId` / `assigneeId` 完成数据隔离，因此页面对接口实际返回的每一行直接展示编辑、删除、状态流转和评论入口，不再重复添加行级角色判断：

```tsx
<Button onClick={() => openEditor(row)}>编辑</Button>
<Button danger onClick={() => deleteMutation.mutate(row.id)}>删除</Button>
```

这只是简化前端交互，不能代替后端校验。所有写接口仍必须重新验证资源归属，防止用户绕过页面直接调用 API。

只有管理员才加载全员列表并显示负责人筛选或分配控件：

```ts
const { data: adminUsers = [] } = useQuery({
  queryKey: ['users'],
  queryFn: teamOpsApi.users,
  enabled: isAdmin
});
```

## 10. 为什么不能只做前端权限

以下前端逻辑都可以被用户绕过：

- 隐藏按钮
- 隐藏菜单
- 路由跳转
- 禁用表单
- 在浏览器中筛选数组

用户可以通过浏览器开发者工具修改 Zustand/localStorage，也可以使用 curl、Postman 直接调用 API。例如：

```bash
curl -X DELETE \
  -H "Authorization: Bearer USER_TOKEN" \
  http://localhost:4000/api/tasks/ANOTHER_USERS_TASK_ID
```

因此正确原则是：

```text
前端权限 = 改善用户体验
后端权限 = 保证数据安全
```

前端和后端都要实现，但后端必须独立成立。

## 11. HTTP 状态码约定

| 状态码 | 含义 | 示例 |
|---|---|---|
| `400` | 请求参数或业务条件错误 | 删除当前登录账号 |
| `401` | 未登录、Token 无效、用户已禁用 | 没有 Authorization Header |
| `403` | 已登录但角色或业务权限不足 | 非管理员访问用户管理 |
| `404` | 资源不存在或不属于当前用户 | 修改别人的任务 |
| `409` | 当前资源状态存在冲突 | 删除仍有业务关联的用户 |

资源越权通常返回 `404` 而不是 `403`，可以减少资源存在性泄露。

## 12. 权限请求示例

### 管理员查询任务

```text
ADMIN token
  → requireAuth 通过
  → hasGlobalDataAccess = true
  → Prisma 不附加固定 assigneeId
  → 返回全部任务
```

### 普通成员查询任务

```text
MEMBER token
  → requireAuth 通过
  → hasGlobalDataAccess = false
  → Prisma 强制 assigneeId = req.user.id
  → 只返回自己的任务
```

### 非管理员编辑项目

```text
MANAGER / MEMBER token
  → requireAuth 通过
  → 不设置项目角色门槛
  → 查询条件 id + ownerId=req.user.id
  → 是自己的项目：允许修改
  → 不是自己的项目：返回 404
```

### 普通成员直接调用用户列表

```text
MEMBER token
  → requireAuth 通过
  → requireRole('ADMIN') 失败
  → 返回 403
```

## 13. 测试参考

现有角色等级测试位于 `apps/api/tests/permissions.test.ts`：

```ts
describe('role permissions', () => {
  it('allows higher-ranked roles to access lower-ranked capabilities', () => {
    expect(canAccess('MEMBER', 'ADMIN')).toBe(true);
    expect(canAccess('MANAGER', 'ADMIN')).toBe(true);
    expect(canAccess('ADMIN', 'MANAGER')).toBe(false);
  });

  it('limits user management to admins', () => {
    expect(canManageUsers('ADMIN')).toBe(true);
    expect(canManageUsers('MANAGER')).toBe(false);
    expect(canManageUsers('MEMBER')).toBe(false);
  });
});
```

建议继续增加 API 集成测试，至少覆盖：

1. ADMIN 项目和任务列表返回全量。
2. MANAGER/MEMBER 列表只返回自己的资源。
3. 非管理员传入他人 `assigneeId` 不能绕过权限。
4. 非管理员不能编辑其他用户负责的项目。
5. 普通成员不能修改、删除或评论他人的任务。
6. 非管理员不能访问用户管理接口。
7. 禁用用户的旧 Token 立即失效。

## 14. 后续改进建议

1. 生产环境启动时强制要求 `JWT_SECRET`，取消默认密钥。
2. 将重复的项目/任务资源检查抽为中间件或授权服务。
3. 为资源级权限增加完整集成测试，而不仅是角色函数单元测试。
4. 如果未来存在“项目成员”“观察者”等关系，增加 ProjectMember 表，而不是继续只依赖 ownerId。
5. 更复杂场景可从 RBAC 扩展为 RBAC + ABAC：角色决定基础能力，资源属性决定具体范围。
6. 对高风险操作增加审计日志、幂等性和事务保护。

## 15. 相关文件索引

| 文件 | 作用 |
|---|---|
| `packages/shared/src/index.ts` | 共享角色、DTO 类型 |
| `apps/api/src/middleware/auth.ts` | JWT 验证和角色中间件 |
| `apps/api/src/lib/permissions.ts` | 角色等级和权限工具函数 |
| `apps/api/src/routes/projects.ts` | 项目数据范围与资源权限 |
| `apps/api/src/routes/tasks.ts` | 任务数据范围与资源权限 |
| `apps/api/src/routes/users.ts` | 管理员权限与安全删除 |
| `apps/api/src/routes/dashboard.ts` | 工作台统计数据隔离 |
| `apps/web/src/store/authStore.ts` | 前端会话状态 |
| `apps/web/src/services/api.ts` | Token 注入和 401 处理 |
| `apps/web/src/router/AppRouter.tsx` | 登录及管理员路由守卫 |
| `apps/web/src/components/AppShell.tsx` | 用户刷新和菜单权限 |
| `apps/web/src/pages/ProjectsPage.tsx` | 项目按钮及负责人控件权限 |
| `apps/web/src/pages/TasksPage.tsx` | 任务按钮及负责人控件权限 |
| `apps/api/tests/permissions.test.ts` | 角色权限单元测试 |
