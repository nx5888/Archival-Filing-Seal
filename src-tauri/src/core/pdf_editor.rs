// src-tauri/src/core/pdf_editor.rs
// PDF 盖章 + 页码叠加（通过 Python 脚本实现）
//
// 架构: Rust (Tauri) → 调用 Python (reportlab + pypdf/PyPDF2)
// 原因: lopdf 中文渲染能力不足，改用成熟的 reportlab 生态

use crate::models::config::StampConfig;
use std::path::PathBuf;

/// 为单个 PDF 文件加盖归档章
///
/// # 参数
/// - `file_path`: 输入 PDF 路径
/// - `config`: 归档章配置
/// - `schema_json`: 归档章布局 schema
/// - `output_path`: 可选，指定输出路径（用于断点续处理）
///   如果为 None，则自动生成 `<原目录>/_stamped/<原文件名>`
///
/// # 断点续处理
/// 如果 output_path 已存在，直接返回 output_path，跳过处理。
pub async fn stamp_pdf(
    file_path: &str,
    config: &StampConfig,
    schema_json: &str,
    output_path: Option<String>,
) -> Result<String, String> {
    use std::fs;
    use tokio::process::Command;

    // 断点检测：如果输出文件已存在，直接返回
    if let Some(ref out) = output_path {
        if PathBuf::from(out).exists() {
            return Ok(out.clone());
        }
    }

    // 1. 确定输出路径
    let output_path = match output_path {
        Some(p) => PathBuf::from(p),
        None => {
            // 输出目录 = <原文件所在目录>/_stamped/
            let input_path = PathBuf::from(file_path);
            let output_dir = input_path
                .parent()
                .ok_or("无法获取输入文件的父目录")?
                .join("_stamped");
            fs::create_dir_all(&output_dir)
                .map_err(|e| format!("创建输出目录失败: {}", e))?;
            let output_file_name = input_path
                .file_name()
                .ok_or("无法获取输入文件名")?;
            output_dir.join(output_file_name)
        }
    };

    // 2. 序列化 config 为临时 JSON
    let config_json = serde_json::to_value(config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;

    // 将 config_json 和 schema_json 写入临时文件
    let tmp_dir = std::env::temp_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    let config_tmp = tmp_dir.join(format!("gdz_config_{}.json", timestamp));
    let schema_tmp = tmp_dir.join(format!("gdz_schema_{}.json", timestamp));

    fs::write(&config_tmp, config_json.to_string())
        .map_err(|e| format!("写入配置临时文件失败: {}", e))?;
    fs::write(&schema_tmp, schema_json)
        .map_err(|e| format!("写入 schema 临时文件失败: {}", e))?;

    // 4. 查找盖章可执行文件
    let (executable, is_exe) = find_stamp_executable()?;

    // 5. 调用盖章程序（带重试，最多 2 次）
    let mut last_err = String::new();
    let max_retries = 2;
    let mut result = Err(String::new());

    for attempt in 0..=max_retries {
        let (cmd, args) = if is_exe {
            // 直接调用 .exe 文件
            (
                executable.to_string_lossy().to_string(),
                vec![
                    file_path.to_string(),
                    output_path.to_string_lossy().to_string(),
                    config_tmp.to_string_lossy().to_string(),
                    schema_tmp.to_string_lossy().to_string(),
                ],
            )
        } else {
            // 调用 Python 脚本
            (
                "python".to_string(),
                vec![
                    executable.to_string_lossy().to_string(),
                    file_path.to_string(),
                    output_path.to_string_lossy().to_string(),
                    config_tmp.to_string_lossy().to_string(),
                    schema_tmp.to_string_lossy().to_string(),
                ],
            )
        };

        let cmd_result = if is_exe {
            Command::new(&cmd)
                .args(&args)
                .output()
                .await
        } else {
            Command::new(&cmd)
                .args(&args)
                .output()
                .await
        };

        match cmd_result {
            Ok(r) => {
                result = Ok(r);
                break;
            }
            Err(e) => {
                last_err = format!("调用盖章程序失败（尝试 {}/{}）: {}", attempt + 1, max_retries + 1, e);
                if attempt < max_retries {
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                }
            }
        }
    }

    let result = result.map_err(|_| last_err)?;

    // 5. 清理临时文件（无论成功失败都清理）
    let _ = fs::remove_file(&config_tmp);
    let _ = fs::remove_file(&schema_tmp);

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(format!(
            "盖章脚本执行失败 (exit code {:?}): {}",
            result.status.code(),
            stderr.trim()
        ));
    }

    // 解析 Python 返回的 JSON 结果
    let stdout = String::from_utf8_lossy(&result.stdout).trim().to_string();
    if !stdout.is_empty() {
        if let Ok(py_result) = serde_json::from_str::<serde_json::Value>(&stdout) {
            if py_result.get("status").and_then(|s| s.as_str()) != Some("ok") {
                return Err(format!(
                    "盖章脚本返回错误: {}",
                    py_result.get("error").and_then(|e| e.as_str()).unwrap_or("未知")
                ));
            }
        }
    }

    Ok(output_path
        .to_string_lossy()
        .to_string()
        .replace('\\', "/"))
}

/// 查找盖章可执行文件（支持打包模式和开发模式）
/// 优先级：
/// 1. stamp_pdf.exe（打包模式，无控制台）
/// 2. stamp_pdf.py（开发模式，需要 Python）
fn find_stamp_executable() -> Result<(PathBuf, bool), String> {
    // 尝试查找 .exe 文件
    let exe_paths = [
        // 打包模式：exe 同级 /resources/
        std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(|p| p.join("resources").join("stamp_pdf.exe")))
            .filter(|p| p.exists()),
        // 开发模式：项目 resources/dist/
        PathBuf::from("resources/dist/stamp_pdf.exe").canonicalize().ok()
            .filter(|p| p.exists()),
        // CARGO_MANIFEST_DIR/../resources/dist/
        std::env::var("CARGO_MANIFEST_DIR").ok()
            .map(|dir| PathBuf::from(dir).join("..").join("resources").join("dist").join("stamp_pdf.exe"))
            .and_then(|p| p.canonicalize().ok())
            .filter(|p| p.exists()),
    ];

    for path in exe_paths.iter().flatten() {
        return Ok((path.clone(), true)); // true = 是 exe 文件
    }

    // 尝试查找 .py 脚本（开发模式）
    let py_paths = [
        find_resource("stamp_pdf.py")?,
    ];

    for path in py_paths.iter() {
        if path.exists() {
            return Ok((path.clone(), false)); // false = 是 Python 脚本
        }
    }

    Err("未找到盖章可执行文件（stamp_pdf.exe 或 stamp_pdf.py）".to_string())
}

/// 查找资源文件（支持开发模式和打包模式）
fn find_resource(name: &str) -> Result<PathBuf, String> {
    // 尝试1: exe 同级 /resources/ （打包模式）
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let path = dir.join("resources").join(name);
            if path.exists() {
                return Ok(path);
            }
        }
    }

    // 尝试2: 工作目录 /resources/ （开发模式）
    let cwd_resources = PathBuf::from("resources").join(name);
    if cwd_resources.exists() {
        return Ok(cwd_resources.canonicalize()
            .unwrap_or(cwd_resources.clone()));
    }

    // 尝试3: 从 CARGO_MANIFEST_DIR 向上查找
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let path = PathBuf::from(&manifest_dir).join("..").join("resources").join(name);
        if path.exists() {
            return Ok(path.canonicalize()
                .unwrap_or(path.clone()));
        }
    }

    Err(format!(
        "未找到资源文件: {} (已搜索 exe/resources/, ./resources/, CARGO_MANIFEST_DIR/../resources/)",
        name
    ))
}

/// 生成单文件预览（盖章后效果），返回预览图像临时文件路径
pub async fn preview_stamp(
    file_path: String,
    config: StampConfig,
    schema_json: String,
) -> Result<String, String> {
    use std::fs;
    use tokio::process::Command;

    // 1. 序列化 config 和 schema 为临时 JSON 文件
    let config_json = serde_json::to_value(&config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;

    let tmp_dir = std::env::temp_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    let config_tmp = tmp_dir.join(format!("gdz_prev_config_{}.json", timestamp));
    let schema_tmp = tmp_dir.join(format!("gdz_prev_schema_{}.json", timestamp));
    let output_png = tmp_dir.join(format!("gdz_preview_{}.png", timestamp));

    fs::write(&config_tmp, config_json.to_string())
        .map_err(|e| format!("写入预览配置临时文件失败: {}", e))?;
    fs::write(&schema_tmp, &schema_json)
        .map_err(|e| format!("写入预览 schema 临时文件失败: {}", e))?;

    // 2. 查找盖章可执行文件
    let (executable, is_exe) = find_stamp_executable()?;

    // 3. 调用预览程序
    // stamp_pdf[.exe] --preview <input> <output.png> <config.json> <schema.json> [--dpi 150]
    let (cmd, args) = if is_exe {
        (
            executable.to_string_lossy().to_string(),
            vec![
                "--preview".to_string(),
                file_path.clone(),
                output_png.to_string_lossy().to_string(),
                config_tmp.to_string_lossy().to_string(),
                schema_tmp.to_string_lossy().to_string(),
                "--dpi".to_string(),
                "150".to_string(),
            ],
        )
    } else {
        (
            "python".to_string(),
            vec![
                executable.to_string_lossy().to_string(),
                "--preview".to_string(),
                file_path.clone(),
                output_png.to_string_lossy().to_string(),
                config_tmp.to_string_lossy().to_string(),
                schema_tmp.to_string_lossy().to_string(),
                "--dpi".to_string(),
                "150".to_string(),
            ],
        )
    };

    let result = Command::new(&cmd)
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("调用预览程序失败: {} (请确认 Python 已安装或 stamp_pdf.exe 存在)", e))?;

    // 4. 清理临时文件
    let _ = fs::remove_file(&config_tmp);
    let _ = fs::remove_file(&schema_tmp);

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(format!(
            "预览脚本执行失败 (exit code {:?}): {}",
            result.status.code(),
            stderr.trim()
        ));
    }

    // 5. 解析 Python 返回的 JSON 结果
    let stdout = String::from_utf8_lossy(&result.stdout).trim().to_string();
    if stdout.is_empty() {
        return Err("预览脚本未返回结果".to_string());
    }

    let py_result: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("解析预览结果失败: {} | 原始输出: {}", e, stdout))?;

    if py_result.get("status").and_then(|s| s.as_str()) != Some("ok") {
        return Err(format!(
            "预览脚本返回错误: {}",
            py_result.get("error").and_then(|e| e.as_str()).unwrap_or("未知")
        ));
    }

    let png_path = py_result.get("output_path")
        .and_then(|p| p.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| output_png.to_string_lossy().into_owned());

    Ok(png_path.replace('\\', "/"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_resource_exists_for_current_dir() {
        // 在开发模式下应该能找到 resources 目录下的文件
        let result = find_resource("stamp_pdf.py");
        assert!(result.is_ok(), "找不到 stamp_pdf.py: {:?}", result.err());
    }
}
