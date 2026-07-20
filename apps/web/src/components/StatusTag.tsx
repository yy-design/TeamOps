import { Tag } from 'antd';
import type { ProjectStatus, TaskPriority, TaskStatus, UserRole } from '@teamops/shared';

const meta: Record<string, { color: string; label: string }> = {
  ADMIN: { color: 'blue', label: '管理员' },
  MANAGER: { color: 'cyan', label: '项目经理' },
  MEMBER: { color: 'default', label: '成员' },
  PLANNING: { color: 'default', label: '规划中' },
  ACTIVE: { color: 'processing', label: '进行中' },
  AT_RISK: { color: 'warning', label: '有风险' },
  DONE: { color: 'success', label: '已完成' },
  BACKLOG: { color: 'default', label: '待处理' },
  IN_PROGRESS: { color: 'processing', label: '进行中' },
  REVIEW: { color: 'purple', label: '待审核' },
  BLOCKED: { color: 'error', label: '已阻塞' },
  LOW: { color: 'default', label: '低' },
  MEDIUM: { color: 'blue', label: '中' },
  HIGH: { color: 'orange', label: '高' },
  URGENT: { color: 'red', label: '紧急' }
};

export function StatusTag({ value }: { value: ProjectStatus | TaskStatus | TaskPriority | UserRole }) {
  const item = meta[value] ?? { color: 'default', label: value };
  return <Tag className="status-pill" color={item.color}>{item.label}</Tag>;
}
