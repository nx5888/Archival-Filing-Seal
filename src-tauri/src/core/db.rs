// src-tauri/src/core/db.rs
// SQLite 操作（sqlx）

use sqlx::{sqlite::SqliteConnectOptions, SqlitePool, ConnectOptions};
use std::str::FromStr;
use crate::models::schema::*;
use crate::models::batch::Batch;
use crate::models::file_info::PdfFileInfo;

const SCHEMA_SQL: &str = include_str!("../../sql/schema.sql");

/// 初始化数据库连接，自动创建表结构
pub async fn init_db(db_path: &str) -> Result<SqlitePool, String> {
    let options = SqliteConnectOptions::from_str(db_path)
        .map_err(|e| format!("数据库连接失败: {}", e))?
        .create_if_missing(true);

    let pool = SqlitePool::connect_with(options)
        .await
        .map_err(|e| format!("数据库连接失败: {}", e))?;

    // 运行建表 SQL
    sqlx::query(SCHEMA_SQL)
        .execute(&pool)
        .await
        .map_err(|e| format!("建表失败: {}", e))?;

    Ok(pool)
}

/// 获取所有档案类型模板列表
pub async fn list_templates() -> Result<Vec<ArchiveTemplate>, String> {
    // TODO: 实际实现需要全局 DB 池，暂时返回内置模板
    Ok(vec![])
}

/// 创建自定义模板
pub async fn create_template(
    _name: String,
    _code: String,
    _description: Option<String>,
    _base_template_id: Option<i64>,
) -> Result<i64, String> {
    // TODO: 实现
    Ok(1)
}

/// 更新模板配置
pub async fn update_template(
    _template_id: i64,
    _folder_mapping: String,
    _filename_regex: String,
    _field_registry: String,
    _stamp_schema: String,
    _page_number_config: String,
) -> Result<(), String> {
    // TODO: 实现
    Ok(())
}

/// 删除模板
pub async fn delete_template(_template_id: i64) -> Result<(), String> {
    // TODO: 实现
    Ok(())
}

/// 保存配置方案
pub async fn save_config_scheme(
    _scheme_name: String,
    _template_id: i64,
    _scheme_json: String,
) -> Result<i64, String> {
    // TODO: 实现
    Ok(1)
}

/// 加载配置方案列表
pub async fn list_config_schemes(_template_id: Option<i64>) -> Result<Vec<SchemeInfo>, String> {
    // TODO: 实现
    Ok(vec![])
}

/// 提交手动坐标
pub async fn submit_manual_pos(_file_id: i64, _x_mm: f32, _y_mm: f32) -> Result<(), String> {
    // TODO: 实现
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct SchemeInfo {
    pub id: i64,
    pub name: String,
    pub template_id: i64,
    pub created_at: Option<String>,
}
