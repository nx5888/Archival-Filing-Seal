// src-tauri/src/core/pdf_editor.rs
// PDF 盖章 + 页码叠加（pdfium-render + lopdf）

use crate::models::config::StampConfig;
use crate::utils::coord::*;

/// 为单个 PDF 文件加盖归档章 + 添加页码
pub async fn stamp_pdf(
    file_path: &str,
    config: &StampConfig,
    schema_json: &str,
) -> Result<String, String> {
    // TODO: 完整实现
    //
    // 步骤：
    // 1. 用 pdfium-render 打开 PDF，读取第1页尺寸（pt）
    // 2. 用 coord::calc_stamp_origin() 计算归档章左上角坐标
    // 3. 用 lopdf 在首页绘制归档章（表格线 + 文字）
    //    - 中文字体：调用 ensure_chinese_font() 获取字体字节
    //    - 按 schema.cells 逐格填入文字
    // 4. 遍历所有页面，按 config.page_number 配置添加页码
    // 5. 保存到 <原目录>/_stamped/<原文件名>
    // 6. 返回输出文件路径

    Ok(format!("{}_stamped.pdf", file_path))
}

/// 生成单文件预览（盖章后效果），返回预览图像临时文件路径
pub async fn preview_stamp(
    file_path: String,
    _config: StampConfig,
    _schema_json: String,
) -> Result<String, String> {
    // TODO: 用 pdfium-render 渲染首页为 PNG，保存临时文件，返回路径
    Ok("temp_preview.png".to_string())
}

/// 检查并加载中文字体
pub fn ensure_chinese_font() -> Result<Vec<u8>, String> {
    let candidates = [
        "C:/Windows/Fonts/simfang.ttf",
        "C:/Windows/Fonts/simsun.ttc",
    ];
    for path in candidates {
        if std::path::Path::new(path).exists() {
            return std::fs::read(path).map_err(|e| e.to_string());
        }
    }
    // 尝试从应用资源目录读取
    if let Ok(exe_dir) = std::env::current_exe() {
        if let Some(dir) = exe_dir.parent() {
            let asset_path = dir.join("resources").join("fonts").join("simfang.ttf");
            if asset_path.exists() {
                return std::fs::read(&asset_path).map_err(|e| e.to_string());
            }
        }
    }
    Err("未找到中文字体，请在设置中指定字体文件路径".into())
}
