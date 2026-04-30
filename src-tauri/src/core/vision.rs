// src-tauri/src/core/vision.rs
// 空白检测（辅助功能，可选启用）

use image::{DynamicImage, GenericImageView};

/// 检测 PDF 第一页指定区域是否空白
/// 返回：(是否空白, 非白像素比例 0.0~1.0)
///
/// ⚠️ 此函数仅作「辅助提示」，不参与核心流程判断
pub fn detect_blank_region(
    img: &DynamicImage,
    page_w_pt: f32,
    page_h_pt: f32,
    stamp_w_mm: f32,
    stamp_h_mm: f32,
    offset_mm: &[f32; 2],
) -> (bool, f32) {
    let mm_to_pt = crate::utils::coord::MM_TO_PT;
    let (stamp_w, stamp_h) = (stamp_w_mm * mm_to_pt, stamp_h_mm * mm_to_pt);
    let (off_x, off_y) = (offset_mm[0] * mm_to_pt, offset_mm[1] * mm_to_pt);

    // 将 PDF 坐标映射到图像像素坐标
    let (img_w, img_h) = (img.width() as f32, img.height() as f32);
    let sx = img_w / page_w_pt;
    let sy = img_h / page_h_pt;

    // 检测区域 = 归档章位置（右上角）
    let roi_x     = (page_w_pt - off_x - stamp_w) * sx;
    let roi_y_img = off_y * sy; // PDF y 原点在左下，图像在左上
    let roi_w     = stamp_w * sx;
    let roi_h     = stamp_h * sy;

    // 统计非白像素比例（RGB 均 > 240 视为白色）
    let mut non_white = 0u32;
    let mut total   = 0u32;

    let start_x = roi_x as u32;
    let start_y = roi_y_img as u32;
    let end_x   = (roi_x + roi_w) as u32;
    let end_y   = (roi_y_img + roi_h) as u32;

    for y in start_y..end_y.min(img.height()) {
        for x in start_x..end_x.min(img.width()) {
            let p = img.get_pixel(x, y);
            if p[0] < 240 || p[1] < 240 || p[2] < 240 {
                non_white += 1;
            }
            total += 1;
        }
    }

    let ratio = if total > 0 {
        non_white as f32 / total as f32
    } else {
        1.0
    };

    // 非白色像素 < 10% → 判定为空白
    (ratio < 0.10, 1.0 - ratio)
}
