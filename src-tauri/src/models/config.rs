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
    /// 印章图片路径（可选，如果设置则在归档章上叠加印章图片）
    pub seal_image_path: Option<String>,
    /// 印章在归档章中的位置和大小（百分比，相对于归档章矩形）
    pub seal_x_pct: Option<f32>,
    pub seal_y_pct: Option<f32>,
    pub seal_w_mm: Option<f32>,
    pub seal_h_mm: Option<f32>,
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
