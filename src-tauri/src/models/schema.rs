// src-tauri/src/models/schema.rs
// 归档章 Schema 结构体 + ArchiveTemplate 结构体

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// 归档章单元格定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StampCell {
    pub id: String,
    pub label: String,
    pub row: usize,
    pub col: usize,
    pub source: String,         // "config" | "filename" | "path" | "config_or_path" | "pdf_metadata"
    pub regex_group: Option<String>,
    pub path_level: Option<usize>,
    pub required: bool,
}

/// 归档章位置配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StampPosition {
    pub anchor: String,          // "top-right" | "top-left" | "custom"
    pub offset_mm: [f32; 2],
    pub page_scope: String,      // "first-only" | "all-pages"
}

/// 归档章 Schema 定义（对应 stamp_schema.json）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StampSchema {
    pub version: String,
    pub name: String,
    pub description: String,
    pub position: StampPosition,
    pub stamp_size_mm: [f32; 2],
    pub cells: Vec<StampCell>,
    pub field_registry: Vec<FieldRegistryEntry>,
    pub font: FontConfig,
    pub border: BorderConfig,
    pub page_number: PageNumberConfig,
}

/// 字段注册表条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldRegistryEntry {
    pub field_name: String,
    pub label: String,
    pub default_source: String,
    pub required: bool,
}

/// 字体配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontConfig {
    pub family: String,
    pub size_pt: f32,
    pub fallback: String,
}

/// 边框配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BorderConfig {
    pub width_pt: f32,
    pub color: Vec<u8>,
}

/// 页码配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageNumberConfig {
    pub enabled: bool,
    pub scope: String,           // "all-pages" | "skip-first" | "odd-only" | "even-only" | "range"
    pub page_range: Option<String>,
    pub numbering_mode: String,   // "per-file" | "continuous"
    pub start_number: i32,
    pub format: String,
    pub zero_pad: u32,
    pub font_family: String,
    pub font_size_pt: f32,
    pub font_color: Vec<u8>,
    pub bold: bool,
    pub italic: bool,
    pub opacity: u32,
    pub position_v: String,       // "top" | "bottom"
    pub position_h: String,       // "left" | "center" | "right"
    pub mirror_odd_even: bool,
    pub offset_mm: [f32; 2],
}

/// 档案类型模板（archive_templates 表）
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ArchiveTemplate {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub is_builtin: bool,
    pub folder_mapping: String,       // JSON
    pub filename_regex: String,        // JSON
    pub field_registry: String,       // JSON
    pub stamp_schema: String,         // JSON
    pub page_number_config: String,   // JSON
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

/// 模板匹配置信度结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateMatchResult {
    pub template_id: i64,
    pub template_name: String,
    pub template_code: String,
    pub confidence: u8,
}
