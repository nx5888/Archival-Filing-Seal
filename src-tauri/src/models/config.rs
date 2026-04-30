// src-tauri/src/models/config.rs
// StampConfig 结构体（Tauri Commands 参数用）

use serde::{Deserialize, Serialize};

/// 归档章配置（前端传递到后端的配置快照）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StampConfig {
    pub template_id: i64,
    pub fonds_code: Option<String>,
    pub year: Option<String>,
    pub retention: Option<String>,
    pub stamp_offset_mm: [f32; 2],
    pub page_number: PageNumberConfig,
}

/// 页码配置（与 schema.rs 中的 PageNumberConfig 保持一致）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageNumberConfig {
    pub enabled: bool,
    pub scope: String,
    pub page_range: Option<String>,
    pub numbering_mode: String,
    pub start_number: i32,
    pub format: String,
    pub zero_pad: u32,
    pub font_family: String,
    pub font_size_pt: f32,
    pub font_color: Vec<u8>,
    pub bold: bool,
    pub italic: bool,
    pub opacity: u32,
    pub position_v: String,
    pub position_h: String,
    pub mirror_odd_even: bool,
    pub offset_mm: [f32; 2],
}
