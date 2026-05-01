// src/types/stamp.ts
// TypeScript 类型定义（与 Rust 后端对应）

export interface StampCell {
  id: string;
  label: string;
  row: number;
  col: number;
  source: string;        // "config" | "filename" | "path" | "config_or_path" | "pdf_metadata"
  regex_group?: string;
  path_level?: number;
  required: boolean;
}

export interface StampPosition {
  anchor: string;       // "top-right" | "top-left" | "custom"
  offset_mm: [number, number];
  page_scope: string;   // "first-only" | "all-pages"
}

export interface StampSchema {
  version: string;
  name: string;
  description: string;
  position: StampPosition;
  stamp_size_mm: [number, number];
  cells: StampCell[];
  field_registry: FieldRegistryEntry[];
  // ... 其他字段省略，按需要补充
}

export interface FieldRegistryEntry {
  field_name: string;
  label: string;
  default_source: string;
  required: boolean;
}

export interface ArchiveTemplate {
  id: number;
  code: string;
  name: string;
  description?: string;
  is_builtin: boolean;
  folder_mapping: string;
  filename_regex: string;
  field_registry: string;
  stamp_schema: string;
  page_number_config: string;
}

export interface BatchPreview {
  batch_name: string;
  fonds_code?: string;
  year?: string;
  retention?: string;
  file_paths: string[];
}

export interface ScanResult {
  project_id: number;
  batches: BatchPreview[];
  total_files: number;
}

export interface Seal {
  id: number;
  name: string;
  file_path: string;
  width_mm?: number;
  height_mm?: number;
  created_at?: string;
  updated_at?: string;
}
