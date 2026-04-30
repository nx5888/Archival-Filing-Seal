// src-tauri/src/models/file_info.rs
// PdfFileInfo 等结构体

use serde::{Deserialize, Serialize};

/// 文件信息（files 表对应的结构体）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfFileInfo {
    pub id: Option<i64>,
    pub batch_id: i64,
    pub project_id: i64,
    pub template_id: i64,
    pub file_path: String,
    pub abs_path: String,
    pub file_mtime: i64,
    pub status: String,
    pub error_msg: Option<String>,
    pub extracted_json: Option<String>,
    pub manual_x_mm: Option<f32>,
    pub manual_y_mm: Option<f32>,
    pub schema_version: Option<String>,
    pub stamped_at: Option<String>,
}

/// 扫描结果中的文件预览条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilePreview {
    pub file_path: String,
    pub abs_path: String,
    pub file_size: u64,
    pub page_count: u32,
    pub extracted: serde_json::Value,
    pub status: String,
}
