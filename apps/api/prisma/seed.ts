import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

const passwordHash = await bcrypt.hash('TeamOps123!', 10);

async function main() {
  await prisma.notification.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.user.deleteMany();

  const [admin, manager, member, designer] = await Promise.all([
    prisma.user.create({
      data: {
        name: '林澈',
        email: 'admin@teamops.dev',
        passwordHash,
        role: 'ADMIN',
        title: 'Engineering Lead',
        avatarColor: '#2f6fed'
      }
    }),
    prisma.user.create({
      data: {
        name: '周然',
        email: 'manager@teamops.dev',
        passwordHash,
        role: 'MANAGER',
        title: 'Product Manager',
        avatarColor: '#11a37f'
      }
    }),
    prisma.user.create({
      data: {
        name: '许知远',
        email: 'member@teamops.dev',
        passwordHash,
        role: 'MEMBER',
        title: 'Frontend Engineer',
        avatarColor: '#f59e0b'
      }
    }),
    prisma.user.create({
      data: {
        name: '陈亦可',
        email: 'designer@teamops.dev',
        passwordHash,
        role: 'MEMBER',
        title: 'Product Designer',
        avatarColor: '#e11d48'
      }
    })
  ]);

  const portal = await prisma.project.create({
    data: {
      name: 'Enterprise Portal Redesign',
      key: 'PORTAL',
      description: 'Rebuild the internal project portal with role-aware workflows and responsive dashboards.',
      status: 'ACTIVE',
      progress: 68,
      dueDate: new Date('2026-08-18T10:00:00.000Z'),
      ownerId: manager.id
    }
  });

  const api = await prisma.project.create({
    data: {
      name: 'API Reliability Sprint',
      key: 'API',
      description: 'Harden authentication, audit logging, and API observability for release readiness.',
      status: 'AT_RISK',
      progress: 44,
      dueDate: new Date('2026-07-24T10:00:00.000Z'),
      ownerId: admin.id
    }
  });

  const design = await prisma.project.create({
    data: {
      name: 'Design System Migration',
      key: 'DSM',
      description: 'Move legacy screens onto Ant Design tokens and shared interaction patterns.',
      status: 'PLANNING',
      progress: 22,
      dueDate: new Date('2026-09-02T10:00:00.000Z'),
      ownerId: manager.id
    }
  });

  const taskA = await prisma.task.create({
    data: {
      title: 'Implement RBAC-aware navigation shell',
      description: 'Hide admin routes from members and keep protected routes behind token validation.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueDate: new Date('2026-07-08T10:00:00.000Z'),
      projectId: portal.id,
      assigneeId: member.id,
      reporterId: manager.id
    }
  });

  const taskB = await prisma.task.create({
    data: {
      title: 'Add API smoke tests for authentication',
      description: 'Cover successful login, bad credentials, and protected dashboard access.',
      status: 'REVIEW',
      priority: 'URGENT',
      dueDate: new Date('2026-07-05T10:00:00.000Z'),
      projectId: api.id,
      assigneeId: admin.id,
      reporterId: manager.id
    }
  });

  const taskC = await prisma.task.create({
    data: {
      title: 'Map task board empty and loading states',
      description: 'Create crisp Ant Design states for empty filters, API errors, and first-use task creation.',
      status: 'BACKLOG',
      priority: 'MEDIUM',
      dueDate: new Date('2026-07-17T10:00:00.000Z'),
      projectId: design.id,
      assigneeId: designer.id,
      reporterId: manager.id
    }
  });

  await prisma.comment.createMany({
    data: [
      { taskId: taskA.id, authorId: manager.id, body: 'Keep the member experience compact on mobile.' },
      { taskId: taskA.id, authorId: member.id, body: 'Navigation guards are wired; polishing active states next.' },
      { taskId: taskB.id, authorId: admin.id, body: 'Login coverage is green locally.' }
    ]
  });

  await prisma.notification.createMany({
    data: [
      { userId: member.id, title: 'Task assigned', body: 'You were assigned RBAC-aware navigation shell.' },
      { userId: admin.id, title: 'Review requested', body: 'API authentication smoke tests are ready for review.' },
      { userId: designer.id, title: 'Planning note', body: 'Design system migration has a new task in backlog.' }
    ]
  });

  await prisma.activityLog.createMany({
    data: [
      { actorId: manager.id, message: 'Created project PORTAL' },
      { actorId: admin.id, message: 'Moved API authentication tests to REVIEW' },
      { actorId: member.id, message: 'Updated RBAC navigation implementation notes' }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Seeded TeamOps demo data. Login with admin@teamops.dev / TeamOps123!');
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
