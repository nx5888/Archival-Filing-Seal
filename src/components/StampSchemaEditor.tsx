// src/components/StampSchemaEditor.tsx
// 归档章可视化编辑器 —— 遵循 §0 全自定义架构原则
// 支持动态网格渲染（可变行列）、增删格子、合并单元格、实时预览

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  StampSchema,
  StampCell,
  GridConfig,
  MergedCell,
  FieldRegistryEntry,
  TextAlign,
  CellSource,
  PageScope,
} from '../types/stamp';

// ============ 默认值工厂 ============

function defaultGrid(): GridConfig {
  return { rows: 2, cols: 3, cell_size_mm: [3, 15], cell_sizes_mm: null, padding_mm: 0.5 };
}

function defaultCell(row: number, col: number): StampCell {
  return {
    id: `cell_${row}_${col}`,
    label: `字段${row * 3 + col + 1}`,
    row,
    col,
    source: 'config',
    required: false,
    text_align: 'center',
  };
}

function createEmptySchema(): StampSchema {
  const grid = defaultGrid();
  const cells: StampCell[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      cells.push(defaultCell(r, c));
    }
  }
  return {
    version: '2026.3',
    name: '自定义归档章',
    description: '',
    grid,
    merged_cells: [],
    position: { anchor: 'top-right', offset_mm: [5, 5], page_scope: 'first-only' },
    cells,
    field_registry: [],
    font: { family: 'SimFang', size_pt: 9, fallback: 'SimSun' },
    border: { width_pt: 0.5, color: [0, 0, 0] },
    stamp_size_mm: [grid.rows * grid.cell_size_mm[0], grid.cols * grid.cell_size_mm[1]],
    page_number: {
      enabled: true, scope: 'all-pages', skip_first: false, page_range: null,
      numbering_mode: 'per-file', start_number: 1, format: '{current}', zero_pad: 0,
      font_family: 'SimFang', font_size_pt: 8, font_color: [0, 0, 0],
      bold: false, italic: false, opacity: 100,
      position_v: 'bottom', position_h: 'center', mirror_odd_even: false, offset_mm: [0, 10],
    },
  };
}

// ============ 预览渲染：SVG 归档章 ============

interface StampPreviewProps {
  schema: StampSchema;
  scale?: number;
}

function StampPreview({ schema, scale = 4 }: StampPreviewProps) {
  const { grid, cells, border, font, merged_cells } = schema;
  const cellH = grid.cell_size_mm[0] * scale;
  const cellW = grid.cell_size_mm[1] * scale;
  const totalW = grid.cols * cellW;
  const totalH = grid.rows * cellH;

  // 构建合并单元格映射
  const mergeMap = useMemo(() => {
    const map = new Map<string, MergedCell>();
    for (const mc of (merged_cells ?? [])) {
      map.set(`${mc.row}_${mc.col}`, mc);
    }
    return map;
  }, [merged_cells]);

  // 构建单元格位置查找
  const cellMap = useMemo(() => {
    const map = new Map<string, StampCell>();
    for (const c of cells) {
      map.set(`${c.row}_${c.col}`, c);
    }
    return map;
  }, [cells]);

  // 绘制单元格
  const renderCells = () => {
    const elements: JSX.Element[] = [];

    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        // 检查是否被合并区域覆盖（跳过被合并的非起始格）
        let skipped = false;
        for (const mc of (merged_cells ?? [])) {
          if (r > mc.row && r < mc.row + mc.rowspan &&
              c >= mc.col && c < mc.col + mc.colspan) {
            skipped = true;
            break;
          }
          if (c > mc.col && c < mc.col + mc.colspan &&
              r >= mc.row && r < mc.row + mc.rowspan) {
            skipped = true;
            break;
          }
        }
        if (skipped) continue;

        const cell = cellMap.get(`${r}_${c}`);
        const merge = mergeMap.get(`${r}_${c}`);
        const colspan = merge?.colspan ?? cell?.colspan ?? 1;
        const rowspan = merge?.rowspan ?? cell?.rowspan ?? 1;

        const x = c * cellW;
        const y = r * cellH;
        const w = colspan * cellW;
        const h = rowspan * cellH;

        elements.push(
          <g key={`cell_${r}_${c}`}>
            {/* 单元格边框 */}
            <rect
              x={x} y={y} width={w} height={h}
              fill="white"
              stroke={`rgb(${border.color.join(',')})`}
              strokeWidth={border.width_pt}
            />
            {/* 标签文字 */}
            {cell?.label && (
              <text
                x={x + w / 2}
                y={y + h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.min(font.size_pt * scale * 0.8, h * 0.35)}
                fontFamily={font.family}
                fill="#333"
              >
                {cell.label}
              </text>
            )}
          </g>
        );
      }
    }

    // 外边框加粗
    elements.push(
      <rect
        key="outer_border"
        x={0} y={0} width={totalW} height={totalH}
        fill="none"
        stroke={`rgb(${border.color.join(',')})`}
        strokeWidth={border.width_pt * 1.5}
      />
    );

    return elements;
  };

  return (
    <svg
      width={totalW + 20}
      height={totalH + 20}
      viewBox={`${-10} ${-10} ${totalW + 20} ${totalH + 20}`}
      style={{ border: '1px solid #ddd', background: '#fafafa' }}
    >
      <g transform="translate(0, 0)">
        {renderCells()}
      </g>
    </svg>
  );
}

// ============ 属性编辑面板 ============

interface CellEditorProps {
  cell: StampCell;
  fieldRegistry: FieldRegistryEntry[];
  onChange: (updated: StampCell) => void;
  onDelete: () => void;
}

function CellEditor({ cell, fieldRegistry: _fieldRegistry, onChange, onDelete }: CellEditorProps) {
  const update = useCallback(
    <K extends keyof StampCell>(key: K, value: StampCell[K]) => {
      onChange({ ...cell, [key]: value });
    },
    [cell, onChange]
  );

  return (
    <div style={{
      padding: '8px 12px',
      borderLeft: '3px solid #1890ff',
      background: '#f0f7ff',
      marginBottom: 6,
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>[{cell.row},{cell.col}]</strong>

        <label>ID:</label>
        <input
          value={cell.id}
          onChange={e => update('id', e.target.value)}
          size={12}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />

        <label>标签:</label>
        <input
          value={cell.label}
          onChange={e => update('label', e.target.value)}
          size={10}
        />

        <label>来源:</label>
        <select
          value={cell.source}
          onChange={e => update('source', e.target.value as CellSource)}
          style={{ fontSize: 12 }}
        >
          <option value="config">固化值</option>
          <option value="filename">文件名正则</option>
          <option value="path">文件夹路径</option>
          <option value="config_or_path">固化或路径</option>
          <option value="pdf_metadata">PDF元数据</option>
        </select>

        {(cell.source === 'filename') && (
          <>
            <label>捕获组:</label>
            <input
              value={cell.regex_group ?? ''}
              onChange={e => update('regex_group', e.target.value)}
              size={8}
              placeholder="如 docnum"
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </>
        )}

        {(cell.source === 'path' || cell.source === 'config_or_path') && (
          <>
            <label>路径层级:</label>
            <input
              type="number"
              value={cell.path_level ?? 0}
              onChange={e => update('path_level', Number(e.target.value))}
              size={3}
              min={0}
              style={{ width: 45, fontSize: 12 }}
            />
          </>
        )}

        <label>
          <input
            type="checkbox"
            checked={cell.required}
            onChange={e => update('required', e.target.checked)}
          /> 必填
        </label>

        <label>对齐:</label>
        <select
          value={cell.text_align ?? 'center'}
          onChange={e => update('text_align', e.target.value as TextAlign)}
          style={{ fontSize: 12 }}
        >
          <option value="left">左</option>
          <option value="center">中</option>
          <option value="right">右</option>
        </select>

        <label>跨行:</label>
        <input
          type="number"
          value={cell.rowspan ?? 1}
          onChange={e => update('rowspan', Math.max(1, Number(e.target.value)))}
          size={2}
          min={1}
          style={{ width: 40, fontSize: 12 }}
        />

        <label>跨列:</label>
        <input
          type="number"
          value={cell.colspan ?? 1}
          onChange={e => update('colspan', Math.max(1, Number(e.target.value)))}
          size={2}
          min={1}
          style={{ width: 40, fontSize: 12 }}
        />

        <button
          onClick={onDelete}
          title="删除此格"
          style={{
            padding: '1px 6px',
            fontSize: 11,
            cursor: 'pointer',
            background: '#ff4d4f',
            color: 'white',
            border: 'none',
            borderRadius: 3,
          }}
        >✕</button>
      </div>
    </div>
  );
}

// ============ 主编辑器组件 ============

interface StampSchemaEditorProps {
  schema?: StampSchema;
  onChange: (schema: StampSchema) => void;
  readOnly?: boolean;
}

export default function StampSchemaEditor({
  schema: propSchema,
  onChange,
  readOnly = false,
}: StampSchemaEditorProps) {
  const [schema, setSchema] = useState<StampSchema>(() => propSchema ?? createEmptySchema());
  const [activeTab, setActiveTab] = useState<'grid' | 'cells' | 'style' | 'position'>('grid');

  // 外部 schema 变更时同步
  useEffect(() => {
    if (propSchema) setSchema(propSchema);
  }, [propSchema]);

  const emitChange = useCallback((updated: StampSchema) => {
    setSchema(updated);
    onChange(updated);
  }, [onChange]);

  // ---- 网格结构操作 ----

  const resizeGrid = useCallback((rows: number, cols: number) => {
    setSchema((prev: StampSchema) => {
      const newCells: StampCell[] = [...prev.cells];
      // 扩展时添加默认格子
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!newCells.find(cell => cell.row === r && cell.col === c)) {
            newCells.push(defaultCell(r, c));
          }
        }
      }
      // 收缩时移除超出范围的格子
      const filtered = newCells.filter(c => c.row < rows && c.col < cols);
      // 清理超出范围的合并
      const cleanedMerges = (prev.merged_cells ?? []).filter(
        (m: MergedCell) => m.row < rows && m.col < cols && m.row + m.rowspan <= rows && m.col + m.colspan <= cols
      );

      const updated: StampSchema = {
        ...prev,
        grid: { ...prev.grid, rows, cols },
        cells: filtered,
        merged_cells: cleanedMerges,
        stamp_size_mm: [rows * prev.grid.cell_size_mm[0], cols * prev.grid.cell_size_mm[1]],
      };
      emitChange(updated);
      return updated;
    });
  }, [emitChange]);

  const addRow = useCallback(() => resizeGrid(schema.grid.rows + 1, schema.grid.cols), [schema.grid, resizeGrid]);
  const addCol = useCallback(() => resizeGrid(schema.grid.rows, schema.grid.cols + 1), [schema.grid, resizeGrid]);
  const removeRow = useCallback(() => {
    if (schema.grid.rows > 1) resizeGrid(schema.grid.rows - 1, schema.grid.cols);
  }, [schema.grid, resizeGrid]);
  const removeCol = useCallback(() => {
    if (schema.grid.cols > 1) resizeGrid(schema.grid.rows, schema.grid.cols - 1);
  }, [schema.grid, resizeGrid]);

  // ---- 单元格操作 ----

  const updateCell = useCallback((index: number, updated: StampCell) => {
    setSchema((prev: StampSchema) => {
      const newCells = [...prev.cells];
      newCells[index] = updated;
      const result = { ...prev, cells: newCells };
      emitChange(result);
      return result;
    });
  }, [emitChange]);

  const deleteCell = useCallback((index: number) => {
    setSchema((prev: StampSchema) => {
      const newCells = prev.cells.filter((_c: StampCell, i: number) => i !== index);
      const result = { ...prev, cells: newCells };
      emitChange(result);
      return result;
    });
  }, [emitChange]);

  // ---- 合并单元格操作 ----

  const addMergedCell = useCallback(() => {
    setSchema((prev: StampSchema) => {
      const newMerge: MergedCell = { row: 0, col: 0, rowspan: 1, colspan: 2 };
      const updated = {
        ...prev,
        merged_cells: [...(prev.merged_cells ?? []), newMerge],
      };
      emitChange(updated);
      return updated;
    });
  }, [emitChange]);

  // updateMerge: 合并单元格更新函数（保留接口，供未来合并编辑 UI 绑定）
  // TODO: 在 merged_cells 编辑面板中绑定此函数

  const deleteMerge = useCallback((index: number) => {
    setSchema((prev: StampSchema) => {
      const merges = (prev.merged_cells ?? []).filter((_m: MergedCell, i: number) => i !== index);
      const result = { ...prev, merged_cells: merges };
      emitChange(result);
      return result;
    });
  }, [emitChange]);

  // ---- 整体属性更新 ----

  const updateGridProp = useCallback(<K extends keyof GridConfig>(key: K, value: GridConfig[K]) => {
    setSchema((prev: StampSchema) => {
      const newGrid = { ...prev.grid, [key]: value };
      const updated: StampSchema = {
        ...prev,
        grid: newGrid,
        stamp_size_mm: [
          newGrid.rows * newGrid.cell_size_mm[0],
          newGrid.cols * newGrid.cell_size_mm[1],
        ],
      };
      emitChange(updated);
      return updated;
    });
  }, [emitChange]);

  const updateFont = useCallback(<K extends keyof import('../types/stamp').FontConfig>(
    key: K, value: import('../types/stamp').FontConfig[K]
  ) => {
    setSchema((prev: StampSchema) => {
      const updated = { ...prev, font: { ...prev.font, [key]: value } };
      emitChange(updated);
      return updated;
    });
  }, [emitChange]);

  const updateBorder = useCallback(<K extends keyof import('../types/stamp').BorderConfig>(
    key: K, value: import('../types/stamp').BorderConfig[K]
  ) => {
    setSchema((prev: StampSchema) => {
      const updated = { ...prev, border: { ...prev.border, [key]: value } };
      emitChange(updated);
      return updated;
    });
  }, [emitChange]);

  // ---- 导出 JSON ----

  const exportJson = useCallback(() => {
    const json = JSON.stringify(schema, null, 2);
    console.log('[StampSchemaEditor] Schema JSON:', json);
    // 可选：复制到剪贴板
    navigator.clipboard?.writeText(json);
    alert('已复制到控制台和剪贴板');
  }, [schema]);

  // ============ 渲染 ============

  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
      {/* 头部 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 16px', background: '#fafafa', borderBottom: '1px solid #d9d9d9',
      }}>
        <strong style={{ fontSize: 15 }}>📐 归档章样式编辑器</strong>
        <span style={{ fontSize: 12, color: '#888' }}>
          {schema.name} &nbsp;|&nbsp; {schema.grid.rows}×{schema.grid.cols} =
          {schema.grid.rows * schema.grid.cols} 格 &nbsp;
          |&nbsp; 尺寸 {schema.stamp_size_mm[0]}×{schema.stamp_size_mm[1]}mm
        </span>
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #d9d9d9', background: '#f5f5f5' }}>
        {(['grid', 'cells', 'style', 'position'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '8px 0', border: 'none', background: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
              borderBottom: activeTab === tab ? '2px solid #1890ff' : '2px solid transparent',
              color: activeTab === tab ? '#1890ff' : '#555',
            }}
          >
            {tab === "grid" ? "🔲 网格结构" : tab === "cells" ? "📝 单元格编辑" : tab === "style" ? "🎨 字体与边框" : "📍 位置锚点"}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', minHeight: 400 }}>
        {/* ===== 左侧：预览区（常驻） ===== */}
        <div style={{
          width: 320, padding: 20, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          borderRight: '1px solid #d9d9d9', background: '#fff',
        }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>实时预览</div>
          <StampPreview schema={schema} scale={5} />
          <div style={{ marginTop: 12, fontSize: 11, color: '#aaa', textAlign: 'center' }}>
            {schema.stamp_size_mm[0]}mm × {schema.stamp_size_mm[1]}mm<br />
            锚点: {schema.position.anchor} | 偏移: {schema.position.offset_mm.join(',')}mm
          </div>
        </div>

        {/* ===== 右侧：编辑区 ===== */}
        <div style={{ flex: 1, padding: 16, overflowY: 'auto', maxHeight: 500 }}>

          {/* --- Tab: 网格结构 --- */}
          {activeTab === 'grid' && (
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>网格结构</h3>

              <div style={{
                display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 12px',
                alignItems: 'center', maxWidth: 480,
              }}>
                <label style={{ fontSize: 13 }}>行数:</label>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button onClick={removeRow} disabled={readOnly || schema.grid.rows <= 1}
                    style={{ padding: '2px 10px', cursor: 'pointer' }}>−</button>
                  <strong style={{ minWidth: 24, textAlign: 'center' }}>{schema.grid.rows}</strong>
                  <button onClick={addRow} disabled={readOnly} style={{ padding: '2px 10px', cursor: 'pointer' }}>+</button>
                  <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>
                    (当前 {schema.grid.rows} 行)
                  </span>
                </div>

                <label style={{ fontSize: 13 }}>列数:</label>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button onClick={removeCol} disabled={readOnly || schema.grid.cols <= 1}
                    style={{ padding: '2px 10px', cursor: 'pointer' }}>−</button>
                  <strong style={{ minWidth: 24, textAlign: 'center' }}>{schema.grid.cols}</strong>
                  <button onClick={addCol} disabled={readOnly} style={{ padding: '2px 10px', cursor: 'pointer' }}>+</button>
                  <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>
                    (当前 {schema.grid.cols} 列)
                  </span>
                </div>

                <label style={{ fontSize: 13 }}>单格高(mm):</label>
                <input type="number" step={0.5} min={1} max={50}
                  value={schema.grid.cell_size_mm[0]}
                  onChange={e => updateGridProp('cell_size_mm', [Number(e.target.value), schema.grid.cell_size_mm[1]])}
                  disabled={readOnly}
                  style={{ width: 80 }} />

                <label style={{ fontSize: 13 }}>单格宽(mm):</label>
                <input type="number" step={0.5} min={1} max={50}
                  value={schema.grid.cell_size_mm[1]}
                  onChange={e => updateGridProp('cell_size_mm', [schema.grid.cell_size_mm[0], Number(e.target.value)])}
                  disabled={readOnly}
                  style={{ width: 80 }} />

                <label style={{ fontSize: 13 }}>内边距(mm):</label>
                <input type="number" step={0.1} min={0} max={5}
                  value={schema.grid.padding_mm}
                  onChange={e => updateGridProp('padding_mm', Number(e.target.value))}
                  disabled={readOnly}
                  style={{ width: 80 }} />

                <label style={{ fontSize: 13 }}>整体尺寸(自动):</label>
                <span style={{ fontSize: 13, color: '#1890ff', fontWeight: 600 }}>
                  高 {schema.stamp_size_mm[0]}mm × 宽 {schema.stamp_size_mm[1]}mm
                </span>
              </div>

              {/* 合并单元格管理 */}
              <h4 style={{ margin: '16px 0 8px', fontSize: 13 }}>合并单元格</h4>
              {(schema.merged_cells ?? []).length === 0 ? (
                <p style={{ fontSize: 12, color: '#888' }}>无合并单元格</p>
              ) : (
                (schema.merged_cells ?? []).map((mc: MergedCell, i: number) => (
                  <div key={i} style={{
                    display: 'inline-flex', gap: 6, alignItems: 'center',
                    padding: '4px 8px', margin: '2px 4px 2px 0',
                    background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 4,
                    fontSize: 12,
                  }}>
                    <span>({mc.row},{mc.col}) ×{mc.rowspan}行×{mc.colspan}列</span>
                    {!readOnly && (
                      <button onClick={() => deleteMerge(i)} style={{
                        padding: '0 4px', cursor: 'pointer', background: 'none',
                        border: 'none', color: '#ff4d4f', fontSize: 14, lineHeight: 1,
                      }}>✕</button>
                    )}
                  </div>
                ))
              )}
              {!readOnly && (
                <button onClick={addMergedCell}
                  style={{ marginTop: 6, padding: '3px 12px', fontSize: 12, cursor: 'pointer' }}>
                  ＋ 添加合并
                </button>
              )}
            </div>
          )}

          {/* --- Tab: 单元格编辑 --- */}
          {activeTab === 'cells' && (
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>
                单元格配置 ({schema.cells.length} 个格子)
              </h3>
              {schema.cells.map((cell: StampCell, idx: number) => (
                <CellEditor
                  key={cell.id}
                  cell={cell}
                  fieldRegistry={schema.field_registry}
                  onChange={updated => updateCell(idx, updated)}
                  onDelete={() => deleteCell(idx)}
                />
              ))}
              {!readOnly && (
                <button
                  onClick={() => {
                    // 在最后一个格子后面添加一个新格子
                    const lastCell = schema.cells[schema.cells.length - 1];
                    const newRow = lastCell.row;
                    const newCol = lastCell.col + 1;
                    setSchema((prev: StampSchema) => {
                      if (newCol >= prev.grid.cols) return prev;
                      const newCell = defaultCell(newRow, newCol);
                      const updated = { ...prev, cells: [...prev.cells, newCell] };
                      emitChange(updated);
                      return updated;
                    });
                  }}
                  style={{ marginTop: 8, padding: '4px 16px', fontSize: 12, cursor: 'pointer' }}
                >
                  ＋ 添加单元格
                </button>
              )}
            </div>
          )}

          {/* --- Tab: 字体与边框 --- */}
          {activeTab === 'style' && (
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>字体设置</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8, maxWidth: 400, alignItems: 'center' }}>
                <label style={{ fontSize: 13 }}>字体族:</label>
                <input value={schema.font.family}
                  onChange={e => updateFont('family', e.target.value)} disabled={readOnly} />

                <label style={{ fontSize: 13 }}>字号(pt):</label>
                <input type="number" step={0.5} min={4} max={72} value={schema.font.size_pt}
                  onChange={e => updateFont('size_pt', Number(e.target.value))} disabled={readOnly}
                  style={{ width: 80 }} />

                <label style={{ fontSize: 13 }}>备用字体:</label>
                <input value={schema.font.fallback}
                  onChange={e => updateFont('fallback', e.target.value)} disabled={readOnly} />
              </div>

              <h3 style={{ margin: '16px 0 12px', fontSize: 14 }}>边框设置</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8, maxWidth: 400, alignItems: 'center' }}>
                <label style={{ fontSize: 13 }}>宽度(pt):</label>
                <input type="number" step={0.1} min={0} max={5} value={schema.border.width_pt}
                  onChange={e => updateBorder('width_pt', Number(e.target.value))} disabled={readOnly}
                  style={{ width: 80 }} />

                <label style={{ fontSize: 13 }}>颜色:</label>
                <input type="color"
                  value={`rgb(${schema.border.color.join(',')}`.replace('rgb(', '#')
                    .replace(',', '').replace(',', '').replace(')', '')
                    || '#000000'}
                  onChange={e => {
                    // 解析 hex 到 RGB
                    const hex = e.target.value.replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    updateBorder('color', [r, g, b]);
                  }}
                  disabled={readOnly}
                  style={{ width: 50, height: 28 }} />
                <span style={{ fontSize: 12, color: '#888' }}>
                  RGB({schema.border.color.join(',')})
                </span>
              </div>
            </div>
          )}

          {/* --- Tab: 位置锚点 --- */}
          {activeTab === 'position' && (
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>位置与范围</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8, maxWidth: 400, alignItems: 'center' }}>
                <label style={{ fontSize: 13 }}>锚点:</label>
                <select value={schema.position.anchor}
                  onChange={e => setSchema((prev: StampSchema) => {
                    const updated = { ...prev, position: { ...prev.position, anchor: e.target.value as typeof prev.position.anchor } };
                    emitChange(updated);
                    return updated;
                  })}
                  disabled={readOnly}>
                  <option value="top-right">右上角 ⬈</option>
                  <option value="top-left">左上角 ⬉</option>
                  <option value="bottom-right">右下角 ⬊</option>
                  <option value="bottom-left">左下角 ⬋</option>
                  <option value="custom">自定义坐标</option>
                </select>

                <label style={{ fontSize: 13 }}>X偏移(mm):</label>
                <input type="number" step={1} min={0} max={100}
                  value={schema.position.offset_mm[0]}
                  onChange={e => setSchema((prev: StampSchema) => {
                    const off = [...prev.position.offset_mm] as [number, number];
                    off[0] = Number(e.target.value);
                    const updated = { ...prev, position: { ...prev.position, offset_mm: off } };
                    emitChange(updated);
                    return updated;
                  })}
                  disabled={readOnly} style={{ width: 80 }} />

                <label style={{ fontSize: 13 }}>Y偏移(mm):</label>
                <input type="number" step={1} min={0} max={100}
                  value={schema.position.offset_mm[1]}
                  onChange={e => setSchema((prev: StampSchema) => {
                    const off = [...prev.position.offset_mm] as [number, number];
                    off[1] = Number(e.target.value);
                    const updated = { ...prev, position: { ...prev.position, offset_mm: off } };
                    emitChange(updated);
                    return updated;
                  })}
                  disabled={readOnly} style={{ width: 80 }} />

                <label style={{ fontSize: 13 }}>盖章页面:</label>
                <select value={schema.position.page_scope}
                  onChange={e => setSchema((prev: StampSchema) => {
                    const updated = { ...prev, position: { ...prev.position, page_scope: e.target.value as PageScope } };
                    emitChange(updated);
                    return updated;
                  })}
                  disabled={readOnly}>
                  <option value="first-only">仅首页</option>
                  <option value="all-pages">所有页面</option>
                </select>
              </div>

              <h4 style={{ margin: '16px 0 8px', fontSize: 13 }}>名称与描述</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8, maxWidth: 400 }}>
                <label style={{ fontSize: 13 }}>模板名:</label>
                <input value={schema.name}
                  onChange={e => setSchema((prev: StampSchema) => {
                    const updated = { ...prev, name: e.target.value };
                    emitChange(updated);
                    return updated;
                  })}
                  disabled={readOnly} />

                <label style={{ fontSize: 13 }}>描述:</label>
                <input value={schema.description}
                  onChange={e => setSchema((prev: StampSchema) => {
                    const updated = { ...prev, description: e.target.value };
                    emitChange(updated);
                    return updated;
                  })}
                  disabled={readOnly} />
              </div>

              <div style={{ marginTop: 16 }}>
                <button onClick={exportJson}
                  style={{ padding: '5px 16px', fontSize: 12, cursor: 'pointer' }}>
                  📋 导出 JSON 到控制台
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
