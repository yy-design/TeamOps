import { Badge, Button, Card, List, Skeleton, Space, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { teamOpsApi } from '../services/api';

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['notifications'], queryFn: teamOpsApi.notifications });
  const markRead = useMutation({
    mutationFn: teamOpsApi.markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });
  const markAllRead = useMutation({
    mutationFn: teamOpsApi.markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  if (isLoading) return <Skeleton active />;

  return (
    <div className="page-stack">
      <PageHeader title="消息通知" subtitle="任务分配、评审提醒和项目状态变化会集中在这里。" action={<Button onClick={() => markAllRead.mutate()} disabled={!data.some((item) => !item.read)} loading={markAllRead.isPending}>全部标记已读</Button>} />
      <Card>
        <List
          dataSource={data}
          renderItem={(item) => (
            <List.Item actions={[!item.read ? <Button type="link" onClick={() => markRead.mutate(item.id)}>标记已读</Button> : <Typography.Text type="secondary">已读</Typography.Text>]}>
              <List.Item.Meta
                avatar={<Badge status={item.read ? 'default' : 'processing'} />}
                title={item.title}
                description={<Space direction="vertical" size={2}><Typography.Text>{item.body}</Typography.Text><Typography.Text type="secondary">{new Date(item.createdAt).toLocaleString()}</Typography.Text></Space>}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}
