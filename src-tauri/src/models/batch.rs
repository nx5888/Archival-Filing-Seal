// src-tauri/src/models/batch.rs
// Batch 结构体

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// 批次表（batches）结构体
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Batch {
    pub id: i64,
    pub project_id: i64,
    pub template_id: i64,
    pub batch_name: String,
    pub fonds_code: Option<String>,
    pub year: Option<String>,
    pub retention: Option<String>,
    pub file_count: i32,
    pub status: String,
    pub created_at: Option<String>,
}

/// 扫描结果（scan_directory 返回值）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub project_id: i64,
    pub batches: Vec<BatchPreview>,
    pub total_files: usize,
}

/// 批次预览（扫描阶段返回）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchPreview {
    pub batch_name: String,
    pub fonds_code: Option<String>,
    pub year: Option<String>,
    pub retention: Option<String>,
    pub file_paths: Vec<String>,
}
