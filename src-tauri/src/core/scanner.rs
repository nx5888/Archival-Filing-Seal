// src-tauri/src/core/scanner.rs
// 文件扫描 + 正则解析 + 路径解析 + 批次划分

use std::path::PathBuf;
use walkdir::WalkDir;
use regex::Regex;
use serde_json::Value;
use crate::models::batch::{ScanResult, BatchPreview};
use crate::models::schema::TemplateMatchResult;

/// 扫描目录，返回文件列表 + 自动检测的批次划分
pub async fn scan_directory(
    _app: tauri::AppHandle,
    root_path: String,
    _template_id: i64,
    _config_json: String,
) -> Result<ScanResult, String> {
    let root = PathBuf::from(&root_path);

    // 1. 递归扫描所有 PDF 文件
    let mut pdf_files: Vec<PathBuf> = Vec::new();
    let walker = WalkDir::new(&root).into_iter();

    for entry in walker.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext.eq_ignore_ascii_case("pdf")) {
            pdf_files.push(path.to_path_buf());
        }
    }

    // 2. 按文件夹结构划分批次（简化版：按直接父目录分组）
    let mut batches: Vec<BatchPreview> = Vec::new();
    let mut batch_map: std::collections::HashMap<String, Vec<String>> = 
        std::collections::HashMap::new();

    for pdf_path in &pdf_files {
        if let Some(parent) = pdf_path.parent() {
            let batch_key = parent
                .strip_prefix(&root)
                .unwrap_or(parent)
                .to_string_lossy()
                .to_string();

            batch_map
                .entry(batch_key.clone())
                .or_insert_with(Vec::new)
                .push(pdf_path.to_string_lossy().to_string());
        }
    }

    for (batch_name, file_paths) in batch_map {
        batches.push(BatchPreview {
            batch_name,
            fonds_code: None,
            year: None,
            retention: None,
            file_paths,
        });
    }

    Ok(ScanResult {
        project_id: 0,
        batches,
        total_files: pdf_files.len(),
    })
}

/// 解析单个文件名（用于 C 区实时预览）
pub fn parse_single_filename(
    filename: &str,
    regex_pattern: &str,
) -> Result<Value, String> {
    let re = Regex::new(regex_pattern)
        .map_err(|e| format!("正则表达式编译失败: {}", e))?;

    let file_name_only = PathBuf::from(filename)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(filename)
        .to_string();

    if let Some(caps) = re.captures(&file_name_only) {
        let mut result = serde_json::Map::new();
        for name in re.capture_names().flatten() {
            if let Some(m) = caps.name(name) {
                result.insert(name.to_string(), Value::String(m.as_str().to_string()));
            }
        }
        Ok(Value::Object(result))
    } else {
        Err("文件名不匹配正则表达式".to_string())
    }
}

/// 计算文件夹与某模板的匹配置信度（0~100）
///
/// 评分规则：
/// - 文件夹名含门类关键词（凭证/账簿/报表 → 会计；项目/工程/设计 → 科技）：+40%
/// - 文件名符合某模板的正则：+50%
/// - 文件夹层级数与某模板一致：+10%
pub fn detect_template_match(
    sample_paths: &[String],
    sample_filenames: &[String],
    templates_json: &str,
) -> Vec<TemplateMatchResult> {
    let mut results: Vec<TemplateMatchResult> = Vec::new();

    let templates: Vec<Value> = match serde_json::from_str(templates_json) {
        Ok(v) => v,
        Err(_) => return results,
    };

    let keyword_map: std::collections::HashMap<&str, Vec<&str>> = [
        ("WS", vec!["文书", "WS"]),
        ("KJ", vec!["科技", "项目", "工程", "设计"]),
        ("KJ_ACCT", vec!["会计", "凭证", "账簿", "报表"]),
        ("SX", vec!["声像", "照片", "录音", "录像"]),
    ]
    .iter()
    .cloned()
    .collect();

    for template in &templates {
        let code = template.get("code").and_then(|v| v.as_str()).unwrap_or("");
        let filename_regex = template
            .get("filename_regex")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let mut score: u8 = 0;

        // 1. 关键词匹配（40分）
        if let Some(keywords) = keyword_map.get(code) {
            for path_str in sample_paths {
                let path_buf = PathBuf::from(path_str);
                let dir_name = path_buf
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");
                for kw in keywords {
                    if dir_name.contains(kw) {
                        score = score.saturating_add(40);
                        break;
                    }
                }
            }
        }

        // 2. 文件名正则匹配（50分）
        if let Ok(re) = Regex::new(filename_regex) {
            for fname in sample_filenames {
                if re.is_match(fname) {
                    score = score.saturating_add(50);
                    break;
                }
            }
        }

        // 3. 文件夹层级数一致（10分）- 简化版
        // TODO: 从 folder_mapping_json 中解析期望的层级数

        results.push(TemplateMatchResult {
            template_id: template.get("id").and_then(|v| v.as_i64()).unwrap_or(0),
            template_name: template
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            template_code: code.to_string(),
            confidence: score.min(100),
        });
    }

    results
}
