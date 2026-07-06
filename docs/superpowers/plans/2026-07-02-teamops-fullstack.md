# TeamOps Fullstack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack enterprise project and ticket management demo that showcases React, TypeScript, Ant Design, RBAC, REST APIs, Prisma, testing, and deployment-ready structure.

**Architecture:** A npm workspace monorepo with `apps/api` for Express + Prisma + SQLite and `apps/web` for React + Vite + Ant Design. The backend owns authentication, RBAC, project/task/comment/notification data, and dashboard aggregation; the frontend consumes those APIs through typed service modules and React Query.

**Tech Stack:** React 18, TypeScript, Vite, Ant Design, React Router, TanStack Query, Zustand, Express, Prisma, SQLite, JWT, Vitest, React Testing Library, Supertest.

## Global Constraints

- Keep the project runnable locally with `npm install`, `npm run db:push`, `npm run db:seed`, `npm run dev`.
- Use TypeScript across frontend, backend, and shared contracts.
- Prefer clear enterprise UI workflows over marketing pages.
- Include realistic seed users and data so the demo opens with meaningful content.
- Protect admin-only APIs and UI actions with role-based permissions.

---

### Task 1: Monorepo Foundation

**Files:** root package metadata, TypeScript configs, README, env examples, workspace folders.

**Deliverable:** npm workspaces, shared package, API and web app skeletons, scripts.

### Task 2: Backend Domain and API

**Files:** Prisma schema, seed script, Express app, auth middleware, RBAC, route modules, tests.

**Deliverable:** Login, current user, dashboard, projects, tasks, users, notifications, Swagger metadata, and testable API app.

### Task 3: Frontend Application

**Files:** Vite app, layout, router, auth store, API client, pages, reusable components, tests.

**Deliverable:** Login, protected shell, dashboard, projects, task board/list, users, notifications, settings, responsive Ant Design UI.

### Task 4: Verification and Polish

**Files:** README and scripts.

**Deliverable:** Install dependencies, generate Prisma client, seed DB, run tests/build where possible, and start dev server if feasible.

## Self-Review

- Spec coverage: The plan covers full-stack auth, RBAC, CRUD, dashboard, notifications, Ant Design UI, tests, and docs.
- Placeholder scan: No implementation placeholders are left in the plan; task details are concise because this is executed by the current session immediately.
- Type consistency: Shared API response types are produced in `packages/shared` and consumed by both apps.
