// src-tauri/src/utils/coord.rs
// 坐标转换工具（mm ↔ PDF坐标）

/// PDF 坐标系说明：
/// - PDF 原点在页面左下角
/// - X 轴向右，Y 轴向上
/// - 单位：点（pt），1 inch = 72 pt，1 mm = 2.835 pt

pub const MM_TO_PT: f32 = 2.835;

/// 毫米转 PDF 点
pub fn mm_to_pt(mm: f32) -> f32 {
    mm * MM_TO_PT
}

/// PDF 点转毫米
pub fn pt_to_mm(pt: f32) -> f32 {
    pt / MM_TO_PT
}

/// 锚点枚举
pub enum Anchor {
    TopRight,
    TopLeft,
    Custom,
}

/// 计算归档章左上角坐标（PDF 坐标系：原点在左下角）
///
/// # 参数
/// - page_w, page_h: PDF 页面尺寸（pt）
/// - anchor: 锚点位置
/// - offset_mm: [X偏移, Y偏移]（mm）
/// - stamp_w, stamp_h: 归档章尺寸（pt）
pub fn calc_stamp_origin(
    page_w: f32,
    page_h: f32,
    anchor: &Anchor,
    offset_mm: &[f32; 2],
    stamp_w: f32,
    stamp_h: f32,
) -> (f32, f32) {
    let (ox, oy) = (mm_to_pt(offset_mm[0]), mm_to_pt(offset_mm[1]));

    match anchor {
        Anchor::TopRight => {
            // 右上角：x = 页宽 - X偏移 - 章宽；y = 页高 - Y偏移 - 章高
            (page_w - ox - stamp_w, page_h - oy - stamp_h)
        }
        Anchor::TopLeft => (ox, page_h - oy - stamp_h),
        Anchor::Custom => (ox, oy),
    }
}

/// 图像坐标转 PDF 坐标
/// 用于手动选址：用户点击图像上的位置，转换为 PDF 坐标
///
/// # 参数
/// - img_x, img_y: 图像上的点击坐标（像素，原点在左上角）
/// - img_w, img_h: 图像尺寸（像素）
/// - page_w, page_h: PDF 页面尺寸（pt）
pub fn image_to_pdf_coords(
    img_x: f32,
    img_y: f32,
    img_w: f32,
    img_h: f32,
    page_w: f32,
    page_h: f32,
) -> (f32, f32) {
    // 图像原点在左上角，PDF 原点在左下角
    let sx = page_w / img_w;
    let sy = page_h / img_h;

    let pdf_x = img_x * sx;
    let pdf_y = page_h - (img_y * sy); // 翻转 Y 轴

    (pdf_x, pdf_y)
}

/// PDF 坐标转图像坐标
pub fn pdf_to_image_coords(
    pdf_x: f32,
    pdf_y: f32,
    img_w: f32,
    img_h: f32,
    page_w: f32,
    page_h: f32,
) -> (f32, f32) {
    let sx = img_w / page_w;
    let sy = img_h / page_h;

    let img_x = pdf_x * sx;
    let img_y = (page_h - pdf_y) * sy; // 翻转 Y 轴

    (img_x, img_y)
}
