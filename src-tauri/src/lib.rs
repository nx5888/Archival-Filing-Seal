// src-tauri/src/lib.rs
// Tauri Commands 注册 - 电子档案归档章印制工具

use tauri::Manager;

mod core;
mod models;
mod utils;

// ========== 模板管理命令 ==========

/// 获取所有档案类型模板列表
#[tauri::command]
pub async fn list_templates() -> Result<Vec<models::schema::ArchiveTemplate>, String> {
    core::db::list_templates().await
}

/// 获取单个模板详情
#[tauri::command]
pub async fn get_template(template_id: i64) -> Result<models::schema::ArchiveTemplate, String> {
    core::db::get_template(template_id).await
}

/// 创建自定义模板
#[tauri::command]
pub async fn create_template(
    name: String,
    code: String,
    description: Option<String>,
    base_template_id: Option<i64>,
) -> Result<i64, String> {
    core::db::create_template(name, code, description, base_template_id).await
}

/// 更新模板配置（仅自定义模板可更新）
#[tauri::command]
pub async fn update_template(
    template_id: i64,
    folder_mapping: String,
    filename_regex: String,
    field_registry: String,
    stamp_schema: String,
    page_number_config: String,
) -> Result<(), String> {
    core::db::update_template(
        template_id,
        folder_mapping,
        filename_regex,
        field_registry,
        stamp_schema,
        page_number_config,
    ).await
}

/// 删除模板（仅自定义模板可删除）
#[tauri::command]
pub async fn delete_template(template_id: i64) -> Result<(), String> {
    core::db::delete_template(template_id).await
}

/// 扫描目录后，计算与各模板的匹配置信度
#[tauri::command]
pub async fn detect_template_match(
    sample_paths: Vec<String>,
    sample_filenames: Vec<String>,
) -> Result<Vec<models::schema::TemplateMatchResult>, String> {
    Ok(core::scanner::detect_template_match(&sample_paths, &sample_filenames))
}

// ========== 配置方案命令 ==========

/// 保存配置方案
#[tauri::command]
pub async fn save_config_scheme(
    scheme_name: String,
    template_id: i64,
    scheme_json: String,
) -> Result<i64, String> {
    core::db::save_config_scheme(scheme_name, template_id, scheme_json).await
}

/// 加载配置方案列表
#[tauri::command]
pub async fn list_config_schemes(
    template_id: Option<i64>,
) -> Result<Vec<models::scheme::SchemeInfo>, String> {
    core::db::list_config_schemes(template_id).await
}

// ========== 扫描与处理命令 ==========

/// 扫描目录，返回文件列表 + 自动检测的批次划分
#[tauri::command]
pub async fn scan_directory(
    app: tauri::AppHandle,
    root_path: String,
    template_id: i64,
    config_json: String,
) -> Result<models::scan::ScanResult, String> {
    core::scanner::scan_directory(app, root_path, template_id, config_json).await
}

/// 解析单个文件名（用于 C 区实时预览）
#[tauri::command]
pub fn parse_single_filename(
    filename: String,
    regex_pattern: String,
) -> Result<serde_json::Value, String> {
    core::scanner::parse_single_filename(&filename, &regex_pattern)
}

/// 启动批量处理
#[tauri::command]
pub async fn start_batch_stamp(
    app: tauri::AppHandle,
    batch_ids: Vec<i64>,
    config: models::config::StampConfig,
    schema_json: String,
) -> Result<models::batch::BatchResult, String> {
    core::processor::start_batch_stamp(app, batch_ids, config, schema_json).await
}

/// 接收用户手动选址坐标
#[tauri::command]
pub async fn submit_manual_pos(
    app: tauri::AppHandle,
    file_id: i64,
    x_mm: f32,
    y_mm: f32,
) -> Result<(), String> {
    core::db::submit_manual_pos(file_id, x_mm, y_mm).await
}

/// 生成单文件预览（盖章后效果）
#[tauri::command]
pub async fn preview_stamp(
    file_path: String,
    config: models::config::StampConfig,
    schema_json: String,
) -> Result<String, String> {
    core::pdf_editor::preview_stamp(file_path, config, schema_json).await
}

// ========== 程序入口 ==========

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_templates,
            get_template,
            create_template,
            update_template,
            delete_template,
            detect_template_match,
            save_config_scheme,
            list_config_schemes,
            scan_directory,
            parse_single_filename,
            start_batch_stamp,
            submit_manual_pos,
            preview_stamp,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
