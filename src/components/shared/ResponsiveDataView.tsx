import { Card, Empty, Grid, List, Table, type TableProps } from 'antd'
import type { ReactNode } from 'react'

type ResponsiveDataViewProps<T extends object> = {
  rows: T[]
  columns: TableProps<T>['columns']
  rowKey: keyof T | ((row: T) => string)
  renderCard: (row: T) => ReactNode
  emptyText: string
  loading?: boolean
  onRowClick?: (row: T) => void
  rowClassName?: TableProps<T>['rowClassName']
}

const PAGE_SIZE = 5

export const ResponsiveDataView = <T extends object>({
  rows,
  columns,
  rowKey,
  renderCard,
  emptyText,
  loading,
  onRowClick,
  rowClassName,
}: ResponsiveDataViewProps<T>) => {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  if (!isMobile) {
    return (
      <Table
        rowKey={rowKey as TableProps<T>['rowKey']}
        columns={columns}
        dataSource={rows}
        loading={loading}
        rowClassName={rowClassName}
        onRow={onRowClick ? (row) => ({ onClick: () => onRowClick(row) }) : undefined}
        pagination={{ pageSize: PAGE_SIZE, position: ['bottomCenter'], showSizeChanger: false }}
        locale={{ emptyText: <Empty description={emptyText} /> }}
        scroll={{ x: 560 }}
      />
    )
  }

  return (
    <List
      loading={loading}
      dataSource={rows}
      locale={{ emptyText: <Empty description={emptyText} /> }}
      pagination={{
        pageSize: PAGE_SIZE,
        align: 'center',
        hideOnSinglePage: true,
        showSizeChanger: false,
      }}
      renderItem={(row) => <List.Item className="responsive-list-item"><Card className="responsive-list-card">{renderCard(row)}</Card></List.Item>}
    />
  )
}
