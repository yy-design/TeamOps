import { CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, EditOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, App, Button, DatePicker, Form, Input, InputNumber, List, Modal, Popconfirm, Progress, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SprintDto } from '@teamops/shared';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { teamOpsApi } from '../services/api';

function apiMessage(error: unknown, fallback: string) {
  return isAxiosError<{ message?: string }>(error) ? error.response?.data?.message ?? fallback : fallback;
}

export function SprintsPage() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SprintDto | null>(null);
  const { data: sprints = [], isLoading } = useQuery({ queryKey: ['sprints'], queryFn: teamOpsApi.sprints });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: teamOpsApi.projects });
  const manageableProjects = projects.filter((project) => project.capabilities.canEdit);

  const saveMutation = useMutation({
    mutationFn: (values: any) => {
      const [startDate, endDate] = values.range;
      const payload = { ...values, startDate: startDate.toISOString(), endDate: endDate.toISOString() };
      delete payload.range;
      if (editing) {
        delete payload.projectId;
        return teamOpsApi.updateSprint(editing.id, payload);
      }
      return teamOpsApi.createSprint(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
      setOpen(false);
      setEditing(null);
      message.success('迭代已保存');
    },
    onError: () => message.error('迭代保存失败，请检查日期或权限')
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, moveIncompleteToBacklog }: { id: string; status: 'ACTIVE' | 'COMPLETED'; moveIncompleteToBacklog?: boolean }) =>
      teamOpsApi.updateSprintStatus(id, status, { moveIncompleteToBacklog }),
    onSuccess: (_sprint, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const completedMessage = variables.moveIncompleteToBacklog
        ? '迭代已结束，未完成任务已安全移回产品待办'
        : '迭代已结束';
      message.success(variables.status === 'COMPLETED' ? completedMessage : '迭代已启动');
    },
    onError: (error) => message.error(apiMessage(error, '迭代状态更新失败，请稍后重试'))
  });
  const deleteMutation = useMutation({
    mutationFn: teamOpsApi.deleteSprint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
      message.success('迭代已删除');
    },
    onError: () => message.error('只有无任务的规划中迭代可以删除')
  });

  function openEditor(sprint?: SprintDto) {
    setEditing(sprint ?? null);
    form.resetFields();
    form.setFieldsValue(sprint ? {
      name: sprint.name,
      goal: sprint.goal,
      projectId: sprint.project.id,
      range: [dayjs(sprint.startDate), dayjs(sprint.endDate)],
      wipLimit: sprint.wipLimit
    } : {
      projectId: manageableProjects[0]?.id,
      range: [dayjs(), dayjs().add(14, 'day')],
      wipLimit: 6
    });
    setOpen(true);
  }

  function confirmCompleteSprint(sprint: SprintDto) {
    const unfinishedTasks = sprint.tasks.filter((task) => task.status !== 'DONE');
    const hasUnfinishedTasks = unfinishedTasks.length > 0;

    modal.confirm({
      title: `结束迭代“${sprint.name}”？`,
      width: 560,
      centered: true,
      okText: hasUnfinishedTasks ? '移回待办并结束' : '确认结束',
      cancelText: '返回处理',
      okButtonProps: { danger: hasUnfinishedTasks },
      content: hasUnfinishedTasks ? (
        <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 12 }}>
          <Alert
            type="warning"
            showIcon
            message={`还有 ${unfinishedTasks.length} 个任务未完成`}
            description="确认后，这些任务会解除当前迭代关联并重置为“待处理”，已完成任务仍保留在本次迭代中，方便回顾交付结果。"
          />
          <List
            size="small"
            className="sprint-close-task-list"
            dataSource={unfinishedTasks}
            renderItem={(task) => <List.Item><Typography.Text ellipsis>{task.title}</Typography.Text><StatusTag value={task.status} /></List.Item>}
          />
        </Space>
      ) : (
        <Typography.Paragraph style={{ marginTop: 12, marginBottom: 0 }}>
          当前迭代中的任务已经全部完成。结束后迭代将进入历史记录，不能再次启动。
        </Typography.Paragraph>
      ),
      onOk: () => statusMutation.mutateAsync({
        id: sprint.id,
        status: 'COMPLETED',
        moveIncompleteToBacklog: hasUnfinishedTasks
      })
    });
  }

  const columns: ColumnsType<SprintDto> = [
    { title: '迭代', dataIndex: 'name', render: (_, row) => <div className="table-primary-cell"><strong>{row.name}</strong><span>{row.project.key} · {row.goal}</span></div> },
    { title: '状态', dataIndex: 'status', width: 100, render: (status) => <StatusTag value={status} /> },
    { title: '周期', width: 190, render: (_, row) => `${new Date(row.startDate).toLocaleDateString('zh-CN')} - ${new Date(row.endDate).toLocaleDateString('zh-CN')}` },
    {
      title: '完成度',
      width: 200,
      render: (_, row) => {
        const percent = row.taskCount ? Math.round((row.completedTaskCount / row.taskCount) * 100) : 0;
        return <div className="project-progress"><Progress size="small" percent={percent} /><span>{row.completedTaskCount} / {row.taskCount} 个任务已完成</span></div>;
      }
    },
    {
      title: 'WIP 容量',
      width: 120,
      render: (_, row) => <div className="sprint-wip"><strong>{row.activeTaskCount} / {row.wipLimit}</strong><span>开发中 + 待审核</span></div>
    },
    {
      title: '操作',
      width: 280,
      render: (_, row) => row.canManage ? <Space wrap>
        <Button type="text" icon={<EditOutlined />} disabled={statusMutation.isPending} onClick={() => openEditor(row)}>编辑</Button>
        {row.status === 'PLANNING' ? <Popconfirm title="启动这个迭代？" description="启动后，本项目不能同时启动其他迭代。" onConfirm={() => statusMutation.mutate({ id: row.id, status: 'ACTIVE' })}><Button type="link" loading={statusMutation.isPending}>启动</Button></Popconfirm> : null}
        {row.status === 'ACTIVE' ? <Button type="link" loading={statusMutation.isPending} onClick={() => confirmCompleteSprint(row)}>结束</Button> : null}
        {row.status === 'PLANNING' ? <Popconfirm title="删除迭代？" onConfirm={() => deleteMutation.mutate(row.id)}><Button type="text" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm> : null}
      </Space> : <span className="table-date">只读</span>
    }
  ];

  return (
    <div className="page-stack management-page">
      <PageHeader title="Sprint 迭代" subtitle="把项目待办拆成固定周期的交付计划，限制并行工作并持续完成任务。" action={manageableProjects.length ? <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>新建迭代</Button> : undefined} />
      <section className="sprint-guide" aria-labelledby="sprint-guide-title">
        <div className="sprint-guide__header">
          <div><span>HOW IT WORKS</span><h3 id="sprint-guide-title">Sprint 使用说明</h3></div>
          <Typography.Text>一个项目同一时间只能有一个进行中的迭代</Typography.Text>
        </div>
        <div className="sprint-guide__steps">
          <article><span className="sprint-guide__icon"><InfoCircleOutlined /></span><div><strong>1. 规划迭代</strong><p>设置目标、周期和 WIP 上限，再到任务中心把待办任务关联到本次迭代。</p></div></article>
          <article><span className="sprint-guide__icon"><ClockCircleOutlined /></span><div><strong>2. 启动并执行</strong><p>启动后成员推进任务；进行中和待审核任务共同占用 WIP，达到上限时应先完成现有工作。</p></div></article>
          <article><span className="sprint-guide__icon"><CheckCircleOutlined /></span><div><strong>3. 结束与复盘</strong><p>全部完成即可结束；仍有未完成任务时，可在确认后将它们移回产品待办，再进入下一次规划。</p></div></article>
        </div>
        <Alert type="info" showIcon message="完成度由 DONE 任务数自动计算；WIP = 进行中任务 + 待审核任务。项目和 Sprint 的进度都不需要手动填写。" />
      </section>
      <section className="data-table-card">
        <div className="data-table-card__header"><div><span>ITERATIONS</span><h3>迭代列表</h3></div><small>共 {sprints.length} 个迭代</small></div>
        <Table rowKey="id" loading={isLoading} columns={columns} dataSource={sprints} scroll={{ x: 1040 }} pagination={{ pageSize: 8 }} />
      </section>
      <Modal className="entity-modal" title={editing ? '编辑迭代' : '新建迭代'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={saveMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="name" label="迭代名称" rules={[{ required: true, min: 2 }]}><Input placeholder="例如：Sprint 2026-08 用户体系优化" /></Form.Item>
          <Form.Item name="goal" label="迭代目标" extra="说明这个周期结束时希望交付的结果，而不是简单罗列任务。" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={3} placeholder="例如：完成用户中心与通知链路，使成员可以维护资料并实时接收任务变化" /></Form.Item>
          <Form.Item name="projectId" label="所属项目" rules={[{ required: true }]}><Select disabled={Boolean(editing)} options={manageableProjects.map((project) => ({ value: project.id, label: `${project.key} · ${project.name}` }))} /></Form.Item>
          <Form.Item name="range" label="迭代周期" extra="通常建议设置为 1～2 周。" rules={[{ required: true }]}><DatePicker.RangePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="wipLimit" label="在制任务上限（WIP）" extra="同时处于“进行中”和“待审核”的任务总数上限，用于防止并行工作过多。" rules={[{ required: true }]}><InputNumber min={1} max={30} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
