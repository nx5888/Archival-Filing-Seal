// src-tauri/src/core/pdf_editor.rs
// PDF 盖章 + 页码叠加（通过 Python 脚本调用 reportlab）

use std::path::{Path, PathBuf};
use std::fs;
use std::process::Command;
use serde_json::Value;
use crate::models::config::StampConfig;

/// 为单个 PDF 文件加盖归档章，返回输出文件路径
/// 通过调用 resources/stamp_pdf.py（Python + reportlab）实现
pub async fn stamp_pdf(
    file_path: &str,
    config: &StampConfig,
    schema_json: &str,
) -> Result<String, String> {
    // 1. 输出路径：<原目录>/_stamped/<原文件名>_stamped.pdf
    let input_path = Path::new(file_path);
    let parent = input_path.parent().unwrap_or(Path::new("."));
    let stamped_dir = parent.join("_stamped");
    if !stamped_dir.exists() {
        fs::create_dir_all(&stamped_dir)
            .map_err(|e| format!("创建输出目录失败: {}", e))?;
    }
    let out_name = format!("{}_stamped.pdf",
        input_path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("output"));
    let out_path = stamped_dir.join(out_name);

    // 2. 将 config 序列化为临时 JSON 文件
    let config_json_str = serde_json::to_string(config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    let config_file = stamped_dir.join("__config__.json");
    let schema_file = stamped_dir.join("__schema__.json");
    fs::write(&config_file, config_json_str)
        .map_err(|e| format!("写入配置临时文件失败: {}", e))?;
    fs::write(&schema_file, schema_json)
        .map_err(|e| format!("写入 Schema 临时文件失败: {}", e))?;

    // 3. 查找 Python 脚本路径
    let script_path = find_resource("stamp_pdf.py")?;

    // 4. 调用 Python 脚本
    let output = Command::new("python")
        .arg(&script_path)
        .arg(file_path)
        .arg(&out_path)
        .arg(&config_file)
        .arg(&schema_file)
        .output()
        .map_err(|e| format!(
            "调用 Python 失败: {}。请确保 python 在 PATH 中，且已安装 reportlab 和 PyPDF2（pip install reportlab PyPDF2）",
            e
        ))?;

    // 5. 清理临时文件
    let _ = fs::remove_file(&config_file);
    let _ = fs::remove_file(&schema_file);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python 盖章脚本执行失败:\n{}", stderr));
    }

    Ok(out_path.to_string_lossy().to_string())
}

/// 生成单文件预览（盖章后效果），返回预览图像路径
/// 通过 Python 脚本渲染首页为 PNG
pub async fn preview_stamp(
    file_path: String,
    _config: StampConfig,
    _schema_json: String,
) -> Result<String, String> {
    // TODO: 调用 Python 渲染 PDF 首页为 PNG
    // 当前直接返回原文件路径，前端可通过 PDF.js 展示
    Ok(file_path)
}

/// 在资源目录中查找文件（开发时：项目根目录/resources；
/// 打包后：可执行文件所在目录/resources）
fn find_resource(name: &str) -> Result<PathBuf, String> {
    // 尝试 1：可执行文件所在目录/resources/
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let p = dir.join("resources").join(name);
            if p.exists() {
                return Ok(p);
            }
        }
    }
    // 尝试 2：当前工作目录/resources/
    let p = PathBuf::from("resources").join(name);
    if p.exists() {
        return Ok(p);
    }
    // 尝试 3：项目根目录（向上两级，从 src-tauri/target/...）
    if let Ok(cwd) = std::env::current_dir() {
        let mut p = cwd;
        for _ in 0..4 {
            let candidate = p.join("resources").join(name);
            if candidate.exists() {
                return Ok(candidate);
            }
            if !p.pop() {
                break;
            }
        }
    }
    Err(format!("找不到资源文件: {}", name))
}
