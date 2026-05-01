// src-tauri/src/lib.rs
// Tauri Commands 注册 - 电子档案归档章印制工具

mod core;
mod models;
mod utils;

use tauri::Manager;
use sqlx::SqlitePool;
use crate::core::db::SchemeInfo;

// ========== 印章管理命令 ==========

#[tauri::command]
async fn list_seals(app: tauri::AppHandle) -> Result<Vec<models::schema::Seal>, String> {
    let pool = app.state::<SqlitePool>();
    core::db::list_seals(&pool).await
}

#[tauri::command]
async fn upload_seal(
    app: tauri::AppHandle,
    name: String,
    src_path: String,
) -> Result<i64, String> {
    let pool = app.state::<SqlitePool>();
    // 复制印章图片到项目 seals/ 目录
    let seals_dir = std::path::Path::new("./seals");
    if !seals_dir.exists() {
        std::fs::create_dir_all(seals_dir)
            .map_err(|e| format!("创建 seals 目录失败: {}", e))?;
    }
    let ext = std::path::Path::new(&src_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    // 使用时间戳生成唯一文件名
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let dst_name = format!("seal_{}.{}", timestamp, ext);
    let dst_path = seals_dir.join(&dst_name);
    std::fs::copy(&src_path, &dst_path)
        .map_err(|e| format!("复制印章文件失败: {}", e))?;

    let file_path = dst_path.to_string_lossy().to_string();
    // 暂时不获取图片尺寸（避免 image crate 依赖）
    core::db::create_seal(&pool, name, file_path, None, None).await
}

#[tauri::command]
async fn delete_seal(app: tauri::AppHandle, seal_id: i64) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    core::db::delete_seal(&pool, seal_id).await
}

/// 获取图片尺寸（毫米）
fn get_image_size_mm(file_path: &str) -> (Option<f32>, Option<f32>) {
    // 尝试用 image crate 读取尺寸，转换为毫米（假设 72 DPI）
    if let Ok(img) = image::open(file_path) {
        let (w_px, h_px) = (img.width(), img.height());
        let w_mm = Some(w_px as f32 * 25.4 / 72.0);
        let h_mm = Some(h_px as f32 * 25.4 / 72.0);
        return (w_mm, h_mm);
    }
    (None, None)
}

// ========== 模板管理命令 ==========

#[tauri::command]
async fn list_templates() -> Result<Vec<models::schema::ArchiveTemplate>, String> {
    core::db::list_templates().await
}

#[tauri::command]
async fn get_template(template_id: i64) -> Result<models::schema::ArchiveTemplate, String> {
    core::db::get_template(template_id).await
}

#[tauri::command]
async fn create_template(
    name: String,
    code: String,
    description: Option<String>,
    base_template_id: Option<i64>,
) -> Result<i64, String> {
    core::db::create_template(name, code, description, base_template_id).await
}

#[tauri::command]
async fn update_template(
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

#[tauri::command]
async fn delete_template(template_id: i64) -> Result<(), String> {
    core::db::delete_template(template_id).await
}

#[tauri::command]
async fn detect_template_match(
    sample_paths: Vec<String>,
    sample_filenames: Vec<String>,
    templates_json: String,
) -> Result<Vec<models::schema::TemplateMatchResult>, String> {
    Ok(core::scanner::detect_template_match(&sample_paths, &sample_filenames, &templates_json))
}

// ========== 配置方案命令 ==========

#[tauri::command]
async fn save_config_scheme(
    scheme_name: String,
    template_id: i64,
    scheme_json: String,
) -> Result<i64, String> {
    core::db::save_config_scheme(scheme_name, template_id, scheme_json).await
}

#[tauri::command]
async fn list_config_schemes(
    template_id: Option<i64>,
) -> Result<Vec<SchemeInfo>, String> {
    core::db::list_config_schemes(template_id).await
}

// ========== 扫描与处理命令 ==========

#[tauri::command]
async fn scan_directory(
    app: tauri::AppHandle,
    root_path: String,
    template_id: i64,
    config_json: String,
) -> Result<models::batch::ScanResult, String> {
    core::scanner::scan_directory(app, root_path, template_id, config_json).await
}

#[tauri::command]
fn parse_single_filename(
    filename: String,
    regex_pattern: String,
) -> Result<serde_json::Value, String> {
    core::scanner::parse_single_filename(&filename, &regex_pattern)
}

#[tauri::command]
async fn start_batch_stamp(
    app: tauri::AppHandle,
    file_paths: Vec<String>,
    config: models::config::StampConfig,
    schema_json: String,
) -> Result<models::batch::BatchResult, String> {
    core::processor::start_batch_stamp(app, file_paths, config, schema_json).await
}

#[tauri::command]
async fn submit_manual_pos(
    file_id: i64,
    x_mm: f32,
    y_mm: f32,
) -> Result<(), String> {
    core::db::submit_manual_pos(file_id, x_mm, y_mm).await
}

#[tauri::command]
async fn preview_stamp(
    file_path: String,
    config: models::config::StampConfig,
    schema_json: String,
) -> Result<String, String> {
    core::pdf_editor::preview_stamp(file_path, config, schema_json).await
}

// ========== 程序入口 ==========

pub fn run() {
    // 初始化数据库（使用项目根目录下的 gdz.db）
    let db_path = "gdzie.db";
    let rt = tokio::runtime::Runtime::new().expect("创建 async 运行时失败");
    let pool = rt.block_on(async {
        core::db::init_db(&format!("sqlite:{}", db_path)).await
            .expect("数据库初始化失败")
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(pool)
        .invoke_handler(tauri::generate_handler![
            // 印章管理
            list_seals,
            upload_seal,
            delete_seal,
            // 模板管理
            list_templates,
            get_template,
            create_template,
            update_template,
            delete_template,
            detect_template_match,
            // 配置方案
            save_config_scheme,
            list_config_schemes,
            // 扫描与处理
            scan_directory,
            parse_single_filename,
            start_batch_stamp,
            submit_manual_pos,
            preview_stamp,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
