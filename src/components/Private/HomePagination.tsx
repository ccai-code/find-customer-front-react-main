import React from 'react';
import { Pagination, Select } from '@arco-design/web-react';

interface HomePaginationProps {
  total: number;
  currentPage: number;
  pageSize: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

const HomePagination: React.FC<HomePaginationProps> = ({
  total,
  currentPage,
  pageSize,
  setCurrentPage,
  setPageSize
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '14px', color: '#666' }}>
        每页显示：
      </span>
      <Select
        value={pageSize}
        onChange={setPageSize}
        style={{ width: 80 }}
        size="small"
      >
        <Select.Option value={5}>5</Select.Option>
        <Select.Option value={10}>10</Select.Option>
        <Select.Option value={20}>20</Select.Option>
        <Select.Option value={50}>50</Select.Option>
        <Select.Option value={100}>100</Select.Option>
      </Select>
      <Pagination
        total={total}
        current={currentPage}
        pageSize={pageSize}
        onChange={setCurrentPage}
        showTotal
        size="small"
        style={{ marginLeft: '8px' }}
      />
    </div>
  );
};

export default HomePagination;
