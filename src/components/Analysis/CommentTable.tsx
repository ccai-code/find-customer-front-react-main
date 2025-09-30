import React from 'react';
import { Table, Tag } from '@arco-design/web-react';

interface Comment {
  comment_id: string;
  '评论时间': string;
  '用户昵称': string;
  'IP地址': string;
  '评论内容': string;
  intent_customer: string;
  '分析理由': string;
  '用户链接'?: string;
  '内容链接'?: string;
  id?: number;
  '意向客户'?: string;
}

interface CommentTableProps {
  comments: Comment[];
  loading: boolean;
  pagination?: any;
}

const CommentTable: React.FC<CommentTableProps> = ({
  comments,
  loading
  // pagination
}) => {
  const columns = [
    {
      title: '序号',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (_: any, __: any, index: number) => index + 1
    },
    {
      title: '评论时间',
      dataIndex: '评论时间',
      key: '评论时间',
      width: 120,
      render: (value: string) => value || '-'
    },
    {
      title: '用户',
      dataIndex: '用户昵称',
      key: '用户昵称',
      width: 150,
      render: (text: string, record: Comment) => {
        // 如果用户链接存在，则渲染为可点击的链接
        if (record['用户链接']) {
          return (
            <a 
              href={record['用户链接']} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#1890ff', 
                textDecoration: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
                e.currentTarget.style.color = '#40a9ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
                e.currentTarget.style.color = '#1890ff';
              }}
              title="点击查看用户主页"
            >
              {text || '未知用户'}
            </a>
          );
        }
        // 如果没有链接，则显示普通文本
        return <span style={{ color: '#666' }}>{text || '未知用户'}</span>;
      }
    },
    {
      title: '省份',
      dataIndex: 'IP地址',
      key: 'IP地址',
      width: 100
    },
    {
      title: '评论内容',
      dataIndex: '评论内容',
      key: '评论内容',
      width: 300,
      ellipsis: true,
      render: (text: string, record: Comment) => {
        // 如果内容链接存在，则渲染为可点击的链接
        if (record['内容链接']) {
          return (
            <a 
              href={record['内容链接']} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#1890ff', 
                textDecoration: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
                e.currentTarget.style.color = '#40a9ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
                e.currentTarget.style.color = '#1890ff';
              }}
              title="点击查看内容详情"
            >
              {text || '无内容'}
            </a>
          );
        }
        // 如果没有链接，则显示普通文本
        return <span style={{ color: '#666' }}>{text || '无内容'}</span>;
      }
    },
    {
      title: '意向客户',
      dataIndex: 'intent_customer',
      key: 'intent_customer',
      width: 100,
      render: (value: string) => {
        if (value === '是' || value === '高意向') {
          return <Tag color="green">高意向</Tag>;
        } else if (value === '否' || value === '无意向') {
          return <Tag color="gray">无意向</Tag>;
        } else {
          return <Tag color="orange">待分析</Tag>;
        }
      }
    },
    {
      title: '分析理由',
      dataIndex: '分析理由',
      key: '分析理由',
      width: 200,
      ellipsis: true,
      render: (value: string, record: Comment) => {
        // 尝试多种可能的字段名
        const reason = value || record['分析理由'] || '-';
        
        return (
          <div style={{ 
            maxWidth: '180px', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap' 
          }} title={reason}>
            {reason}
          </div>
        );
      }
    }
  ];

  return (
    <>
      {/* 添加CSS样式来隐藏表格滚动条 */}
      <style>
        {`
          /* 隐藏表格组件的滚动条 */
          .arco-table::-webkit-scrollbar,
          .arco-table *::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
          }
          
          .arco-table,
          .arco-table * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          
          /* 隐藏表格容器的滚动条 */
          .arco-table-container::-webkit-scrollbar,
          .arco-table-container *::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
          }
          
          .arco-table-container,
          .arco-table-container * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
        `}
      </style>
      
      <Table
        columns={columns}
        data={comments}
        loading={loading}
        rowKey={(record: Comment) => record.comment_id || record.id?.toString() || Math.random().toString()}
        pagination={false}
        scroll={{ x: 1200 }}
        size="small"
        border={true}
      />
    </>
  );
};

export default CommentTable;
