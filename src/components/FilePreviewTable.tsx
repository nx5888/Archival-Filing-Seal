// src/components/FilePreviewTable.tsx
// 文件解析结果预览表格 —— 支持行内编辑

import { useState, useCallback, useMemo } from 'react';
import type { FilePreviewItem } from '../types/stamp';

interface FilePreviewTableProps {
  files: FilePreviewItem[];
  onFieldEdit?: (filePath: string, fieldName: string, value: string) => void;
  onFileSelect?: (filePaths: string[]) => void;
}

export default function FilePreviewTable({
  files,
  onFieldEdit,
  onFileSelect,
}: FilePreviewTableProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<string | null>(null); // "filePath|fieldName"
  const [editValue, setEditValue] = useState('');

  // 收集所有字段名（从第一个非空记录推断）
  const allFields = useMemo(() => {
    const fields = new Set<string>();
    for (const f of files) {
      if (f.extracted_fields) {
        Object.keys(f.extracted_fields).forEach(k => fields.add(k));
      }
      if (fields.size > 0) break; // 第一个有字段的文件就够了
    }
    return Array.from(fields);
  }, [files]);

  const toggleFile = (path: string) => {
    const next = new Set(selectedFiles);
    if (next.has(path)) next.delete(path); else next.add(path);
    setSelectedFiles(next);
    onFileSelect?.(Array.from(next));
  };

  const startEdit = useCallback((path: string, field: string, currentValue: string) => {
    setEditingCell(`${path}|${field}`);
    setEditValue(currentValue);
  }, []);

  const commitEdit = useCallback((path: string, field: string) => {
    onFieldEdit?.(path, field, editValue);
    setEditingCell(null);
  }, [editValue, onFieldEdit]);

  // 统计
  const statusCounts: { ok: number; warning: number; error: number } = useMemo(() => {
    return { ok: 0, warning: 0, error: 0 };
    files.forEach(f => {
      if (f.status === 'ok') statusCounts.ok++;
      else if (f.status === 'warning') statusCounts.warning++;
      else if (f.status === 'error') statusCounts.error++;
    });
    return statusCounts;
  }, [files]);

  if (files.length === 0) {
    return (
      <div style={{
        padding: 40, textAlign: 'center',
        borderRadius: 6, border: '2px dashed #d9d9d9', background: '#fafafa',
      }}>
        <p style={{ fontSize: 28, margin: '0 0 8px' }}>📋</p>
        <p style={{ margin: 0, color: '#888', fontSize: 13 }}>
          扫描完成后，文件解析结果和字段预览将在此展示
        </p>
        <p style={{ margin: '4px 0 0', color: '#bbb', fontSize: 11 }}>
          支持直接在表格中编辑修正字段值
        </p>
      </div>
    );
  }

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
          <strong style={{ fontSize: 14 }}>📋 文件预览 ({files.length} 个)</strong>
          {statusCounts.ok > 0 && (
            <span style={{
              marginLeft: 12, padding: '1px 8px', borderRadius: 8,
              background: '#f6ffed', color: '#389e0d', fontSize: 11,
            }}>✓ {statusCounts.ok} 正常</span>
          )}
          {statusCounts.warning > 0 && (
            <span style={{
              marginLeft: 4, padding: '1px 8px', borderRadius: 8,
              background: '#fffbe6', color: '#d48806', fontSize: 11,
            }}>⚠ {statusCounts.warning} 警告</span>
          )}
          {statusCounts.error > 0 && (
            <span style={{
              marginLeft: 4, padding: '1px 8px', borderRadius: 8,
              background: '#fff2f0', color: '#cf1322', fontSize: 11,
            }}>✗ {statusCounts.error} 错误</span>
          )}
        </div>
        <span style={{ fontSize: 12, color: '#888' }}>
          点击单元格可编辑 · 红色=解析失败，需手动填写
        </span>
      </div>

      {/* 表格（带横向滚动） */}
      <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
          <thead>
            <tr style={{ background: '#fafafa', position: 'sticky', top: 0, zIndex: 1 }}>
              <th style={thStyle}>
                <input type="checkbox"
                  onChange={() => {
                    if (selectedFiles.size === files.length) {
                      setSelectedFiles(new Set());
                      onFileSelect?.([]);
                    } else {
                      const all = files.map(f => f.abs_path);
                      setSelectedFiles(new Set(all));
                      onFileSelect?.(all);
                    }
                  }}
                  checked={selectedFiles.size === files.length && files.length > 0}
                />
              </th>
              <th style={thStyle}>状态</th>
              <th style={thStyle}>文件路径</th>
              {allFields.map(field => (
                <th key={field} style={thStyle}>{field}</th>
              ))}
              <th style={thStyle}>批次</th>
            </tr>
          </thead>
          <tbody>
            {files.map(file => {
              const isSelected = selectedFiles.has(file.abs_path);

              return (
                <tr key={file.abs_path} style={{
                  background: isSelected ? '#e6f7ff' : undefined,
                  ...(file.status === 'error' ? { background: '#fff1f0' } : {}),
                }}>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <input type="checkbox" checked={isSelected}
                      onChange={() => toggleFile(file.abs_path)} />
                  </td>

                  {/* 状态列 */}
                  <td style={tdStyle}>
                    {file.status === 'ok' && (
                      <span style={badge('green')}>✓ OK</span>
                    )}
                    {file.status === 'warning' && (
                      <span style={badge('orange')}>⚠ 警告</span>
                    )}
                    {file.status === 'error' && (
                      <span style={badge('red')}>✗ 失败</span>
                    )}
                    {file.status === 'pending' && (
                      <span style={badge('gray')}>○ 待定</span>
                    )}
                  </td>

                  {/* 文件路径 */}
                  <td style={{ ...tdStyle, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={`${file.file_path}\n${file.error_msg ?? ''}`}
                  >
                    {file.file_path.split(/[/\\]/).pop()}
                  </td>

                  {/* 字段值（可编辑） */}
                  {allFields.map(field => {
                    const cellKey = `${file.abs_path}|{field}`;
                    const isEditing = editingCell === cellKey;
                    const value = file.extracted_fields[field] ?? '';

                    return (
                      <td key={field} style={{
                        ...tdStyle,
                        background: (!value && file.status !== 'pending')
                          ? '#fffbe6' : undefined,
                        fontWeight: value ? 400 : 700,
                        color: !value ? '#cf1322' : undefined,
                      }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 2 }}>
                            <input
                              autoFocus
                              size={10}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitEdit(file.abs_path, field);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              onBlur={() => commitEdit(file.abs_path, field)}
                              style={{
                                padding: '2px 4px', fontSize: 12,
                                border: '1px solid #1890ff', borderRadius: 2,
                                width: '100%', boxSizing: 'border-box',
                              }}
                            />
                          </div>
                        ) : (
                          <span
                            onClick={() => startEdit(file.abs_path, field, value)}
                            title="点击编辑"
                            style={{
                              cursor: 'pointer',
                              padding: '1px 3px',
                              borderRadius: 2,
                              transition: 'background 0.1s',
                            }}
                          >
                            {value || (
                              <span style={{ fontStyle: 'italic', color: '#bbb' }}>[空]</span>
                            )}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  {/* 批次 */}
                  <td style={{ ...tdStyle, fontSize: 11, color: '#888' }}>{file.batch_name}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ 辅助 ============

function badge(color: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    green: { background: '#f6ffed', color: '#389e0d', border: '1px solid #b7eb8f' },
    orange: { background: '#fffbe6', color: '#d48806', border: '1px solid #ffe58f' },
    red: { background: '#fff2f0', color: '#cf1322', border: '1px solid #ffccc7' },
    gray: { background: '#f5f5f5', color: '#8c8c8c', border: '1px solid #d9d9d9' },
  };
  return {
    ...map[color],
    padding: '1px 7px', borderRadius: 8, fontSize: 11, whiteSpace: 'nowrap',
  };
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  borderBottom: '2px solid #e8e8e8',
  fontSize: 12,
  fontWeight: 600,
  color: '#555',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid #f0f0f0',
};
