import { Area, Column, Pie } from '@ant-design/charts';
import { Alert, Card, Col, List, Row, Skeleton, Statistic } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { teamOpsApi } from '../services/api';

export function DashboardPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['dashboard'], queryFn: teamOpsApi.dashboard });

  if (isLoading) return <Skeleton active />;
  if (isError || !data) return <Alert type="error" message="Dashboard data could not be loaded." showIcon />;

  const trend = [
    { day: 'Mon', tasks: 12 },
    { day: 'Tue', tasks: 16 },
    { day: 'Wed', tasks: 14 },
    { day: 'Thu', tasks: 22 },
    { day: 'Fri', tasks: 18 },
    { day: 'Sat', tasks: 11 },
    { day: 'Sun', tasks: 9 }
  ];

  return (
    <div className="page-stack">
      <PageHeader title="工作台" subtitle="项目状态、任务风险和团队负载的实时视图。" />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          <Card><Statistic title="项目总数" value={data.summary.totalProjects} /></Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card><Statistic title="活跃任务" value={data.summary.activeTasks} /></Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card><Statistic title="逾期任务" value={data.summary.overdueTasks} valueStyle={{ color: '#dc2626' }} /></Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card><Statistic title="完成率" value={data.summary.completionRate} suffix="%" valueStyle={{ color: '#0f766e' }} /></Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="任务趋势">
            <Area data={trend} xField="day" yField="tasks" height={260} />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="状态分布">
            <Pie data={data.taskStatus} angleField="count" colorField="status" height={260} radius={0.82} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="团队负载">
            <Column data={data.workload} xField="user" yField="tasks" height={260} colorField="user" />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="最近动态">
            <List
              dataSource={data.recentActivity}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta title={item.message} description={new Date(item.createdAt).toLocaleString()} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
