import { Tag } from 'antd';
import type { ProjectStatus, TaskPriority, TaskStatus, UserRole } from '@teamops/shared';

const colors: Record<string, string> = {
  ADMIN: 'blue',
  MANAGER: 'green',
  MEMBER: 'gold',
  PLANNING: 'default',
  ACTIVE: 'processing',
  AT_RISK: 'error',
  DONE: 'success',
  BACKLOG: 'default',
  IN_PROGRESS: 'processing',
  REVIEW: 'purple',
  BLOCKED: 'error',
  LOW: 'default',
  MEDIUM: 'blue',
  HIGH: 'orange',
  URGENT: 'red'
};

export function StatusTag({ value }: { value: ProjectStatus | TaskStatus | TaskPriority | UserRole }) {
  return <Tag color={colors[value]}>{value.replaceAll('_', ' ')}</Tag>;
}
