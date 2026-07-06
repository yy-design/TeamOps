import { Space, Typography } from 'antd';
import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <Space direction="vertical" size={2}>
        <Typography.Title level={2}>{title}</Typography.Title>
        <Typography.Text type="secondary">{subtitle}</Typography.Text>
      </Space>
      {action}
    </div>
  );
}
