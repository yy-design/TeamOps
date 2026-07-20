import { Area, Column, Pie } from '@ant-design/charts';
import {
  AppstoreOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  FireOutlined,
  RiseOutlined,
  ThunderboltFilled
} from '@ant-design/icons';
import { Alert, Col, Empty, Row, Skeleton } from 'antd';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { PageHeader } from '../components/PageHeader';
import { teamOpsApi } from '../services/api';

const trend = [
  { day: '周一', tasks: 12 },
  { day: '周二', tasks: 16 },
  { day: '周三', tasks: 14 },
  { day: '周四', tasks: 22 },
  { day: '周五', tasks: 18 },
  { day: '周六', tasks: 11 },
  { day: '周日', tasks: 9 }
];

const statusMeta: Record<string, { label: string; color: string }> = {
  BACKLOG: { label: '待处理', color: '#8e8e93' },
  IN_PROGRESS: { label: '进行中', color: '#007aff' },
  REVIEW: { label: '待审核', color: '#af52de' },
  DONE: { label: '已完成', color: '#34c759' },
  BLOCKED: { label: '已阻塞', color: '#ff3b30' }
};

function MetricCard({ label, value, suffix, hint, tone, icon }: {
  label: string;
  value: number;
  suffix?: string;
  hint: string;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <div className="dashboard-metric">
      <div className="dashboard-metric__top">
        <span className="dashboard-metric__label">{label}</span>
        <span className={`dashboard-metric__icon dashboard-metric__icon--${tone}`}>{icon}</span>
      </div>
      <div className="dashboard-metric__value">{value}<small>{suffix}</small></div>
      <div className="dashboard-metric__hint"><RiseOutlined /> {hint}</div>
    </div>
  );
}

function ChartHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <div className="dashboard-card__header">
      <div>
        <span className="dashboard-card__eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
      </div>
      <span className="dashboard-card__detail">{detail}</span>
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['dashboard'], queryFn: teamOpsApi.dashboard });

  if (isLoading) return <div className="dashboard-loading"><Skeleton active paragraph={{ rows: 10 }} /></div>;
  if (isError || !data) return <Alert type="error" message="工作台数据加载失败" description="请稍后重试。" showIcon />;

  const statusData = data.taskStatus.map((item) => ({
    ...item,
    label: statusMeta[item.status]?.label ?? item.status,
    color: statusMeta[item.status]?.color ?? '#8e8e93'
  }));
  const statusTotal = statusData.reduce((sum, item) => sum + item.count, 0);
  const weeklyTotal = trend.reduce((sum, item) => sum + item.tasks, 0);
  const workload = data.workload.map((item, index) => ({ ...item, order: index + 1 }));

  return (
    <div className="page-stack dashboard-page">
      <div className="dashboard-hero">
        <span className="dashboard-hero__eyebrow">OVERVIEW</span>
        <PageHeader title="工作台" subtitle="清晰掌握团队节奏，让每一次交付都有迹可循。" />
      </div>

      <Row gutter={[18, 18]}>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard label="项目总数" value={data.summary.totalProjects} hint="全部项目空间" tone="blue" icon={<AppstoreOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard label="活跃任务" value={data.summary.activeTasks} hint="团队正在推进" tone="purple" icon={<ThunderboltFilled />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard label="逾期任务" value={data.summary.overdueTasks} hint="需要优先关注" tone="orange" icon={<FireOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard label="完成率" value={data.summary.completionRate} suffix="%" hint="整体交付进度" tone="green" icon={<CheckCircleFilled />} />
        </Col>
      </Row>

      <Row gutter={[18, 18]}>
        <Col xs={24} xl={15}>
          <section className="dashboard-card dashboard-card--trend">
            <ChartHeader eyebrow="WEEKLY ACTIVITY" title="任务趋势" detail={`本周流转 ${weeklyTotal} 个任务`} />
            <div className="dashboard-chart">
              <Area
                data={trend}
                xField="day"
                yField="tasks"
                height={300}
                axis={{ x: { title: false, tick: false }, y: { title: false, tick: false, grid: true } }}
                style={{ fill: 'linear-gradient(-90deg, rgba(0,122,255,0.02) 0%, rgba(0,122,255,0.3) 100%)' }}
                line={{ style: { stroke: '#007aff', strokeWidth: 3 } }}
                tooltip={{ title: (datum) => datum.day }}
              />
            </div>
          </section>
        </Col>
        <Col xs={24} xl={9}>
          <section className="dashboard-card dashboard-card--status">
            <ChartHeader eyebrow="TASK HEALTH" title="状态分布" detail={`${statusTotal} 个任务`} />
            <div className="dashboard-donut">
              <Pie
                data={statusData}
                angleField="count"
                colorField="label"
                height={238}
                innerRadius={0.72}
                radius={0.94}
                legend={false}
                label={false}
                scale={{ color: { range: statusData.map((item) => item.color) } }}
                style={{ stroke: 'transparent', inset: 2, radius: 10 }}
              />
              <div className="dashboard-donut__center"><strong>{statusTotal}</strong><span>全部任务</span></div>
            </div>
            <div className="dashboard-legend">
              {statusData.map((item) => (
                <div key={item.status} className="dashboard-legend__item">
                  <span className="dashboard-legend__dot" style={{ background: item.color }} />
                  <span>{item.label}</span><strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </section>
        </Col>
      </Row>

      <Row gutter={[18, 18]}>
        <Col xs={24} xl={13}>
          <section className="dashboard-card">
            <ChartHeader eyebrow="TEAM CAPACITY" title="团队负载" detail="当前未完成任务" />
            {workload.length ? (
              <div className="dashboard-chart">
                <Column
                  data={workload}
                  xField="user"
                  yField="tasks"
                  height={286}
                  colorField="user"
                  legend={false}
                  axis={{ x: { title: false, tick: false }, y: { title: false, tick: false, grid: true } }}
                  scale={{ color: { range: workload.map((item) => item.color) } }}
                  style={{ radiusTopLeft: 8, radiusTopRight: 8, maxWidth: 34 }}
                />
              </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无负载数据" />}
          </section>
        </Col>
        <Col xs={24} xl={11}>
          <section className="dashboard-card dashboard-card--activity">
            <ChartHeader eyebrow="LIVE UPDATES" title="最近动态" detail="实时更新" />
            {data.recentActivity.length ? (
              <div className="dashboard-activity">
                {data.recentActivity.map((item, index) => (
                  <div className="dashboard-activity__item" key={item.id}>
                    <span className={`dashboard-activity__marker${index === 0 ? ' is-latest' : ''}`}><ClockCircleOutlined /></span>
                    <div><strong>{item.message}</strong><time>{new Date(item.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div>
                  </div>
                ))}
              </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无动态" />}
          </section>
        </Col>
      </Row>
    </div>
  );
}
