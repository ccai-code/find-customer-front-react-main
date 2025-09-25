import React from 'react';
import { List, Typography, Space } from '@arco-design/web-react';
import { IconCheckCircle } from '@arco-design/web-react/icon';

const { Title, Text } = Typography;

interface TaskItem {
  id: string;
  name: string;
  platform: string;
  icon: string;
  selected?: boolean;
}

interface TaskListProps {
  tasks: TaskItem[];
  selectedTask: string;
  onTaskSelect: (taskName: string) => void;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, selectedTask, onTaskSelect }) => {
  return (
    <div>
      <div style={{ padding: '16px' }}>
        <Title heading={5}>任务列表</Title>
      </div>
      <List
        dataSource={tasks}
        render={(item) => (
          <List.Item
            key={item.id}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              backgroundColor: item.name === selectedTask ? '#e8f4fd' : 'transparent',
              borderLeft: item.name === selectedTask ? '3px solid #165dff' : 'none',
              marginBottom: '1px'
            }}
            onClick={() => onTaskSelect(item.name)}
          >
            <Space>
              <span>{item.icon}</span>
              <div>
                <div>{item.name}</div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {item.platform}
                </Text>
              </div>
              {item.name === selectedTask && <IconCheckCircle style={{ color: '#52c41a' }} />}
            </Space>
          </List.Item>
        )}
      />
    </div>
  );
};

export default TaskList;
