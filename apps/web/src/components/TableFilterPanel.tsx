import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Form, Space } from 'antd';
import type { FormInstance } from 'antd';
import type { ReactNode } from 'react';

interface TableFilterPanelProps {
  form: FormInstance;
  children: ReactNode;
  onFinish: (values: any) => void;
  onReset: () => void;
}

export function TableFilterPanel({ form, children, onFinish, onReset }: TableFilterPanelProps) {
  return (
    <section className="table-filter-panel">
      <div className="table-filter-panel__heading">
        <div><span>SMART FILTER</span><strong>筛选与检索</strong></div>
        <small>组合条件，快速定位目标数据</small>
      </div>
      <Form form={form} layout="vertical" onFinish={onFinish} className="table-filter-form">
        <div className="table-filter-form__fields">{children}</div>
        <Space className="table-filter-form__actions">
          <Button onClick={onReset} icon={<ReloadOutlined />}>重置</Button>
          <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>查询</Button>
        </Space>
      </Form>
    </section>
  );
}