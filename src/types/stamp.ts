// src/types/stamp.ts
// TypeScript 类型定义（与方案 v3.1 全自定义 Schema 对应）

// ============ 归档章网格结构 (§0 全自定义) ============

export interface GridConfig {
  rows: number;              // 行数
  cols: number;              // 列数
  cell_size_mm: [number, number];  // 单格尺寸 [高mm, 宽mm]
  cell_sizes_mm?: [number, number][] | null;  // 每格独立尺寸（null=使用统一尺寸）
  padding_mm: number;        // 内容距边框内边距(mm)
}

export interface MergedCell {
  row: number;
  col: number;
  rowspan: number;           // 向下合并行数(1=不合并)
  colspan: number;           // 向右合并列数(1=不合并)
}

// ============ 单个格子定义 ============

export type TextAlign = 'left' | 'center' | 'right';
export type CellSource = 'config' | 'filename' | 'path' | 'config_or_path' | 'pdf_metadata';

export interface StampCell {
  id: string;                // 唯一标识，关联 field_registry
  label: string;             // 显示文字
  row: number;               // 所在行 (0-based)
  col: number;               // 所在列 (0-based)
  source: CellSource;        // 数据来源
  required: boolean;         // 是否必填

  // source=config 时：无额外字段
  // source=filename 时：
  regex_group?: string;      // 正则捕获组名称
  // source=path 或 config_or_path 时：
  path_level?: number;       // 文件夹路径层级 (0=第1级)

  // §0 全自定义扩展属性
  rowspan?: number;          // 向下合并几行（默认1）
  colspan?: number;          // 向右合并几行（默认1）
  text_align?: TextAlign;    // 对齐方式（默认center）
  font_size_pt?: number;     // 本格独立字号（覆盖全局）
  value_format?: string;     // 值格式化模板，如 "{value}页"
}

// ============ 整体外观 ============

export type Anchor = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'custom';
export type PageScope = 'first-only' | 'all-pages' | 'custom';

export interface StampPosition {
  anchor: Anchor;
  offset_mm: [number, number];   // [X偏移mm, Y偏移mm]
  page_scope: PageScope;
}

export interface FontConfig {
  family: string;            // 字体族名
  size_pt: number;           // 全局默认字号(pt)
  fallback: string;          // 备用字体
}

export interface BorderConfig {
  width_pt: number;          // 边框宽度(pt)
  color: [number, number, number];  // RGB 颜色
}

// ============ 字段注册表 ============

export interface FieldRegistryEntry {
  field_name: string;
  label: string;
  default_source: string;
  required: boolean;
}

// ============ 完整归档章 Schema ============

export interface StampSchema {
  version: string;
  name: string;
  description: string;

  // §3.1 新增：网格结构
  grid: GridConfig;

  // §3.1 新增：合并单元格
  merged_cells?: MergedCell[];

  position: StampPosition;

  cells: StampCell[];
  field_registry: FieldRegistryEntry[];

  font: FontConfig;
  border: BorderConfig;

  /** 缓存值：grid.rows * grid.cell_size_mm[0], grid.cols * grid.cell_size_mm[1] */
  stamp_size_mm: [number, number];

  page_number: PageNumberConfig;
}

// ============ 页码配置 ============

export type PositionV = 'top' | 'bottom';
export type PositionH = 'left' | 'center' | 'right';
export type NumberingMode = 'per-file' | 'continuous';
export type PageScopePN = 'all-pages' | 'stamped-only' | 'custom';

export interface PageNumberConfig {
  enabled: boolean;
  scope: PageScopePN;
  skip_first: boolean;
  page_range: string | null;       // 如 "3-10, 15-20"
  numbering_mode: NumberingMode;
  start_number: number;
  format: string;                  // "{current}" / "第{current}页" / "{current}/{total}"
  zero_pad: number;                // 0=不补零 / 3=3位 / 4=4位

  font_family: string;
  font_size_pt: number;
  font_color: [number, number, number];
  bold: boolean;
  italic: boolean;
  opacity: number;                 // 0-100

  position_v: PositionV;
  position_h: PositionH;
  mirror_odd_even: boolean;        // 双面打印奇偶页镜像
  offset_mm: [number, number];
}

// ============ 档案类型模板 ============

export interface ArchiveTemplate {
  id: number;
  code: string;                    // 'WS' / 'KJ' / 用户自定义
  name: string;
  description?: string;
  is_builtin: boolean;             // true=内置(不可删), false=自定义
  folder_mapping: string;          // JSON
  filename_regex: string;          // JSON
  field_registry: string;          // JSON
  stamp_schema: string;            // JSON (StampSchema 序列化)
  page_number_config: string;      // JSON (PageNumberConfig 序列化)
  created_at?: string;
  updated_at?: string;
}

// ============ 批次 & 扫描结果 ============

export interface BatchPreview {
  id?: number;
  batch_name: string;
  fonds_code?: string;
  year?: string;
  retention?: string;
  file_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_paths: string[];
}

export interface ScanResult {
  project_id: number;
  batches: BatchPreview[];
  total_files: number;
  suggested_template_code?: string;   // 自动推荐的模板代码
  confidence_score?: number;          // 置信度 0-100
}

// ============ 配置方案 ============

export interface ConfigScheme {
  id: number;
  name: string;
  template_id: number;
  scheme_json: string;               // 完整 A/B/C 区 JSON 快照
  created_at?: string;
}

// ============ 文件解析预览 ============

export interface FilePreviewItem {
  file_id?: number;
  file_path: string;
  abs_path: string;
  batch_name: string;
  extracted_fields: Record<string, string>;  // 字段名 → 解析出的值
  status: 'pending' | 'ok' | 'warning' | 'error';
  error_msg?: string;
}

// ============ 模板匹配结果 ============

export interface TemplateMatchResult {
  template_id: number;
  template_code: string;
  template_name: string;
  confidence: number;              // 0-100
}
