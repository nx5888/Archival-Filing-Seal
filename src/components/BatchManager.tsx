// src/components/BatchManager.tsx
// 批次管理界面 —— 扫描后展示发现的批次列表

import { useState } from 'react';
import type { BatchPreview } from '../types/stamp';

interface BatchManagerProps {
  batches: BatchPreview[];
  onBatchSelect?: (batchIds: number[]) => void;
  onBatchRetry?: (batchId: number) => void;
  onBatchConfigOverride?: (batchId: number, overrides: Partial<BatchPreview>) => void;
}

export default function BatchManager({
  batches,
  onBatchSelect,
  onBatchRetry,
}: BatchManagerProps) {
  const [selectedBatches, setSelectedBatches] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const toggleSelect = (id?: number) => {
    if (id === undefined) return;
    const next = new Set(selectedBatches);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedBatches(next);
    onBatchSelect?.(Array.from(next));
  };

  const toggleSelectAll = () => {
    if (selectAll || selectedBatches.size === batches.length) {
      setSelectedBatches(new Set());
      setSelectAll(false);
    } else {
      setSelectedBatches(new Set(batches.map(b => b.id!).filter(Boolean)));
      setSelectAll(true);
    }
  };

  // 状态颜色映射
  const statusStyle = (status: string): React.CSSProperties => {
    const map: Record<string, React.CSSProperties> = {
      pending: { background: '#fff7e6', color: '#d46b08', border: '1px solid #ffd591' },
      processing: { background: '#e6f7ff', color: '#0958d9', border: '1px solid #91d5ff' },
      completed: { background: '#f6ffed', color: '#389e0d', border: '1px solid #b7eb8f' },
      failed: { background: '#fff2f0', color: '#cf1322', border: '1px solid #ffccc7' },
    };
    return { ...map[status], padding: '2px 8px', borderRadius: 10, fontSize: 11 };
  };

  if (batches.length === 0) {
    return (
      <div style={{
        padding: 40, textAlign: 'center',
        borderRadius: 6, border: '2px dashed #d9d9d9',
        background: '#fafafa',
      }}>
        <p style={{ fontSize: 28, margin: '0 0 8px' }}>📂</p>
        <p style={{ margin: 0, color: '#888', fontSize: 13 }}>
          选择根目录开始扫描，批次列表将在此展示
        </p>
        <p style={{ margin: '4px 0 0', color: '#bbb', fontSize: 11 }}>
          程序会根据文件夹结构自动划分为不同逻辑批次
        </p>
      </div>
    );
  }

  const totalFiles = batches.reduce((sum, b) => sum + b.file_count, 0);

  return (
    <div style={{
      background: '#fff', borderRadius: 6,
      border: '1px solid #e8e8e8', overflow: 'hidden',
    }}>
      {/* 头部 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', background: '#fafafa', borderBottom: '1px solid #e8e8e8',
      }}>
        <div>
          <strong style={{ fontSize: 14 }}>🗂 发现 {batches.length} 个批次</strong>
          <span style={{ fontSize: 12, color: '#888', marginLeft: 12 }}>
            共 {totalFiles} 个文件
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={toggleSelectAll}
            style={btnSmallStyle}>
            {selectedBatches.size === batches.length ? '✕ 取消全选' : '☑ 全选'}
          </button>
          <button
            disabled={selectedBatches.size === 0}
            style={{
              ...btnSmallStyle,
              opacity: selectedBatches.size === 0 ? 0.4 : 1,
              background: selectedBatches.size > 0 ? '#1890ff' : '#d9d9d9',
              cursor: selectedBatches.size > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            ▶ 处理选中 ({selectedBatches.size})
          </button>
        </div>
      </div>

      {/* 表格 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#fafafa' }}>
            <th style={thStyle}>
              <input type="checkbox" checked={selectAll}
                onChange={toggleSelectAll} />
            </th>
            <th style={thStyle}>批次名称</th>
            <th style={thStyle}>全宗号</th>
            <th style={thStyle}>年度</th>
            <th style={thStyle}>保管期限</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>文件数</th>
            <th style={thStyle}>状态</th>
            <th style={thStyle}>操作</th>
          </tr>
        </thead>
        <tbody>
          {batches.map(batch => {
            const isSelected = batch.id !== undefined && selectedBatches.has(batch.id);
            return (
              <tr key={batch.batch_name}
                style={{
                  background: isSelected ? '#e6f7ff' : undefined,
                  transition: 'background 0.1s',
                }}
              >
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <input type="checkbox" checked={isSelected}
                    onChange={() => toggleSelect(batch.id)} />
                </td>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{batch.batch_name}</td>
                <td style={tdStyle}>{batch.fonds_code ?? '—'}</td>
                <td style={tdStyle}>{batch.year ?? '—'}</td>
                <td style={tdStyle}>{batch.retention ?? '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                  {batch.file_count}
                </td>
                <td style={tdStyle}>
                  <span style={statusStyle(batch.status)}>
                    {{
                      pending: '待处理',
                      processing: '处理中',
                      completed: '已完成',
                      failed: '失败',
                    }[batch.status] ?? batch.status}
                  </span>
                </td>
                <td style={tdStyle}>
                  {batch.status === 'failed' && onBatchRetry && (
                    <button onClick={() => onBatchRetry(batch.id!)}
                      style={{ ...btnTinyStyle, color: '#faad14', borderColor: '#ffe58f' }}>
                      🔄 重试
                    </button>
                  )}
                  {(batch.status === 'pending' || batch.status === 'processing') && (
                    <button disabled style={{ ...btnTinyStyle, opacity: 0.4 }}>
                      配置覆盖
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============ 样式 ============

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  borderBottom: '2px solid #e8e8e8',
  fontSize: 12,
  fontWeight: 600,
  color: '#555',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid #f0f0f0',
};

const btnSmallStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  background: '#fff',
  border: '1px solid #d9d9d9',
  borderRadius: 3,
};

const btnTinyStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: 11,
  cursor: 'pointer',
  background: '#fff',
  border: '1px solid #d9d9d9',
  borderRadius: 3,
};
