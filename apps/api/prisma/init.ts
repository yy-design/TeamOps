import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS Notification');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS Comment');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS Task');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS Project');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS ActivityLog');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS User');
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE User (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL,
      title TEXT NOT NULL,
      avatarColor TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE Project (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      progress INTEGER NOT NULL DEFAULT 0,
      dueDate DATETIME NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ownerId TEXT NOT NULL,
      CONSTRAINT Project_ownerId_fkey FOREIGN KEY (ownerId) REFERENCES User (id) ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE Task (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'BACKLOG',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      dueDate DATETIME NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL,
      projectId TEXT NOT NULL,
      assigneeId TEXT NOT NULL,
      reporterId TEXT NOT NULL,
      CONSTRAINT Task_projectId_fkey FOREIGN KEY (projectId) REFERENCES Project (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT Task_assigneeId_fkey FOREIGN KEY (assigneeId) REFERENCES User (id) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT Task_reporterId_fkey FOREIGN KEY (reporterId) REFERENCES User (id) ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE Comment (
      id TEXT PRIMARY KEY NOT NULL,
      body TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      taskId TEXT NOT NULL,
      authorId TEXT NOT NULL,
      CONSTRAINT Comment_taskId_fkey FOREIGN KEY (taskId) REFERENCES Task (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT Comment_authorId_fkey FOREIGN KEY (authorId) REFERENCES User (id) ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE Notification (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT false,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      userId TEXT NOT NULL,
      CONSTRAINT Notification_userId_fkey FOREIGN KEY (userId) REFERENCES User (id) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE ActivityLog (
      id TEXT PRIMARY KEY NOT NULL,
      message TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actorId TEXT NOT NULL,
      CONSTRAINT ActivityLog_actorId_fkey FOREIGN KEY (actorId) REFERENCES User (id) ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);

  console.log('Initialized TeamOps SQLite schema.');
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
