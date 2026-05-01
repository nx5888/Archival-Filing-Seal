// src-tauri/src/core/db.rs
// SQLite 操作（sqlx）

use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::str::FromStr;
use serde_json;
use crate::models::schema::*;
use crate::models::scheme::SchemeInfo;

const SCHEMA_SQL: &str = include_str!("../../sql/schema.sql");

/// 初始化数据库连接，自动创建表结构
pub async fn init_db(db_path: &str) -> Result<SqlitePool, String> {
    let options = SqliteConnectOptions::from_str(db_path)
        .map_err(|e| format!("数据库连接失败: {}", e))?
        .create_if_missing(true);

    let pool = SqlitePool::connect_with(options)
        .await
        .map_err(|e| format!("数据库连接失败: {}", e))?;

    // 运行建表 SQL（IF NOT EXISTS 幂等）
    sqlx::query(SCHEMA_SQL)
        .execute(&pool)
        .await
        .map_err(|e| format!("建表失败: {}", e))?;

    Ok(pool)
}

/// 初始化内置模板（启动时调用，不存在则插入）
pub async fn init_builtin_templates(pool: &SqlitePool) -> Result<(), String> {
    // --- 文书档案 (WS) ---
    let ws_folder_mapping = serde_json::json!({
        "levels": [
            {"level": 0, "field": "year"},
            {"level": 1, "field": "retention"},
            {"level": 2, "field": "org"}
        ]
    });
    let ws_filename_regex = serde_json::json!({
        "pattern": "^(?<fonds>\\d+)-(?<org>[\\w\\u4e00-\\u9fff]+)[，,]?(?<year>\\d{4})[，,-](?<retention>[A-Za-z]\\d*)(?:-[A-Za-z\\u4e00-\\u9fff]+)?[，,-](?<docnum>\\d+)\\.(?i:pdf)$",
        "group_mapping": {
            "fonds": "fonds_code",
            "org": "org",
            "year": "year",
            "retention": "retention",
            "docnum": "doc_num"
        }
    });
    let ws_stamp: serde_json::Value = serde_json::from_str(
        include_str!("../../schemas/template_ws.json")
    ).map_err(|e| format!("解析 template_ws.json 失败: {}", e))?;

    upsert_template(
        pool, "WS", "文书档案", Some("6格归档章，适用于文书档案"), 1,
        &ws_folder_mapping.to_string(),
        &ws_filename_regex.to_string(),
        &ws_stamp["field_registry"].to_string(),
        &ws_stamp.to_string(),
        &ws_stamp["page_number"].to_string(),
    ).await?;

    // --- 科技档案 (KJ) ---
    let kj_folder_mapping = serde_json::json!({
        "levels": [
            {"level": 0, "field": "project"},
            {"level": 1, "field": "category"}
        ]
    });
    let kj_filename_regex = serde_json::json!({
        "pattern": "^(?<fonds>\\d+)-(?<project>[\\w]+)-(?<category>[\\w]+)-(?<volume>\\d+)\\.(?i:pdf)$",
        "group_mapping": {
            "fonds": "fonds_code",
            "project": "project",
            "category": "category",
            "volume": "volume"
        }
    });
    let kj_stamp: serde_json::Value = serde_json::from_str(
        include_str!("../../schemas/template_kj.json")
    ).map_err(|e| format!("解析 template_kj.json 失败: {}", e))?;

    upsert_template(
        pool, "KJ", "科技档案", Some("8格归档章，适用于科技档案"), 1,
        &kj_folder_mapping.to_string(),
        &kj_filename_regex.to_string(),
        &kj_stamp["field_registry"].to_string(),
        &kj_stamp.to_string(),
        &kj_stamp["page_number"].to_string(),
    ).await?;

    // --- 会计档案 (KJ_ACCT) ---
    let ka_folder_mapping = serde_json::json!({
        "levels": [
            {"level": 0, "field": "year"},
            {"level": 1, "field": "month"},
            {"level": 2, "field": "voucher_type"}
        ]
    });
    let ka_filename_regex = serde_json::json!({
        "pattern": "^(?<fonds>\\d+)-(?<voucher>[\\w]+)-(?<seq>\\d+)\\.(?i:pdf)$",
        "group_mapping": {
            "fonds": "fonds_code",
            "voucher": "voucher_no",
            "seq": "seq_no"
        }
    });
    let ka_stamp: serde_json::Value = serde_json::from_str(
        include_str!("../../schemas/template_kj_acct.json")
    ).map_err(|e| format!("解析 template_kj_acct.json 失败: {}", e))?;

    upsert_template(
        pool, "KJ_ACCT", "会计档案", Some("4格归档章，适用于会计档案"), 1,
        &ka_folder_mapping.to_string(),
        &ka_filename_regex.to_string(),
        &ka_stamp["field_registry"].to_string(),
        &ka_stamp.to_string(),
        &ka_stamp["page_number"].to_string(),
    ).await?;

    // --- 声像档案 (SX) ---
    let sx_folder_mapping = serde_json::json!({
        "levels": [
            {"level": 0, "field": "year"},
            {"level": 1, "field": "media_type"}
        ]
    });
    let sx_filename_regex = serde_json::json!({
        "pattern": "^(?<fonds>\\d+)-(?<year>\\d{4})-(?<mediatype>[\\w\\u4e00-\\u9fff]+)-(?<seq>\\d+)\\.(?i:pdf|jpg|png)$",
        "group_mapping": {
            "fonds": "fonds_code",
            "year": "year",
            "mediatype": "media_type",
            "seq": "seq_no"
        }
    });
    let sx_stamp: serde_json::Value = serde_json::from_str(
        include_str!("../../schemas/template_sx.json")
    ).map_err(|e| format!("解析 template_sx.json 失败: {}", e))?;

    upsert_template(
        pool, "SX", "声像档案", Some("4格归档章，适用于声像档案"), 1,
        &sx_folder_mapping.to_string(),
        &sx_filename_regex.to_string(),
        &sx_stamp["field_registry"].to_string(),
        &sx_stamp.to_string(),
        &sx_stamp["page_number"].to_string(),
    ).await?;

    Ok(())
}

/// 内置模板 upsert（根据 code 唯一约束）
async fn upsert_template(
    pool: &SqlitePool,
    code: &str, name: &str, description: Option<&str>, is_builtin: i32,
    folder_mapping: &str, filename_regex: &str,
    field_registry: &str, stamp_schema: &str, page_number_config: &str,
) -> Result<(), String> {
    sqlx::query(
        r#"
        INSERT INTO archive_templates (code, name, description, is_builtin, folder_mapping, filename_regex, field_registry, stamp_schema, page_number_config)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            folder_mapping = excluded.folder_mapping,
            filename_regex = excluded.filename_regex,
            field_registry = excluded.field_registry,
            stamp_schema = excluded.stamp_schema,
            page_number_config = excluded.page_number_config,
            updated_at = (datetime('now', 'localtime'))
        "#
    )
    .bind(code)
    .bind(name)
    .bind(description)
    .bind(is_builtin)
    .bind(folder_mapping)
    .bind(filename_regex)
    .bind(field_registry)
    .bind(stamp_schema)
    .bind(page_number_config)
    .execute(pool)
    .await
    .map_err(|e| format!("写入模板失败: {}", e))?;
    Ok(())
}

/// 获取所有档案类型模板列表
pub async fn list_templates(pool: &SqlitePool) -> Result<Vec<ArchiveTemplate>, String> {
    let rows = sqlx::query_as::<_, ArchiveTemplate>(
        "SELECT * FROM archive_templates ORDER BY is_builtin DESC, id ASC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("查询模板列表失败: {}", e))?;
    Ok(rows)
}

/// 获取单个模板详情
pub async fn get_template(pool: &SqlitePool, template_id: i64) -> Result<ArchiveTemplate, String> {
    let row = sqlx::query_as::<_, ArchiveTemplate>(
        "SELECT * FROM archive_templates WHERE id = ?"
    )
    .bind(template_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("查询模板失败: {}", e))?;
    row.ok_or_else(|| "模板不存在".to_string())
}

/// 创建自定义模板
pub async fn create_template(
    pool: &SqlitePool,
    name: String,
    code: String,
    description: Option<String>,
    base_template_id: Option<i64>,
) -> Result<i64, String> {
    // 检查 code 是否已存在
    let (cnt,): (i32,) = sqlx::query_as(
        "SELECT COUNT(*) FROM archive_templates WHERE code = ?"
    )
    .bind(&code)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("检查code失败: {}", e))?;
    if cnt > 0 {
        return Err("模板代码已存在，请使用其他代码".to_string());
    }

    // 从基准模板复制配置
    let (folder_mapping, filename_regex, field_registry, stamp_schema, page_number_config) =
        if let Some(base_id) = base_template_id {
            let base = get_template(pool, base_id).await?;
            (base.folder_mapping, base.filename_regex,
             base.field_registry, base.stamp_schema, base.page_number_config)
        } else {
            ("{}".to_string(), "{}".to_string(),
             "[]".to_string(), "{}".to_string(), "{}".to_string())
        };

    let result = sqlx::query(
        r#"
        INSERT INTO archive_templates (code, name, description, is_builtin, folder_mapping, filename_regex, field_registry, stamp_schema, page_number_config)
        VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)
        "#
    )
    .bind(code)
    .bind(name)
    .bind(description)
    .bind(folder_mapping)
    .bind(filename_regex)
    .bind(field_registry)
    .bind(stamp_schema)
    .bind(page_number_config)
    .execute(pool)
    .await
    .map_err(|e| format!("创建模板失败: {}", e))?;

    Ok(result.last_insert_rowid())
}

/// 更新模板配置（仅自定义模板可更新）
pub async fn update_template(
    pool: &SqlitePool,
    template_id: i64,
    folder_mapping: String,
    filename_regex: String,
    field_registry: String,
    stamp_schema: String,
    page_number_config: String,
) -> Result<(), String> {
    let t = get_template(pool, template_id).await?;
    if t.is_builtin {
        return Err("内置模板不可修改，如需调整请基于该模板创建自定义模板".to_string());
    }
    sqlx::query(
        r#"
        UPDATE archive_templates
        SET folder_mapping = ?, filename_regex = ?, field_registry = ?, stamp_schema = ?, page_number_config = ?, updated_at = (datetime('now', 'localtime'))
        WHERE id = ?
        "#
    )
    .bind(folder_mapping)
    .bind(filename_regex)
    .bind(field_registry)
    .bind(stamp_schema)
    .bind(page_number_config)
    .bind(template_id)
    .execute(pool)
    .await
    .map_err(|e| format!("更新模板失败: {}", e))?;
    Ok(())
}

/// 删除模板（仅自定义模板可删除）
pub async fn delete_template(pool: &SqlitePool, template_id: i64) -> Result<(), String> {
    let t = get_template(pool, template_id).await?;
    if t.is_builtin {
        return Err("内置模板不可删除".to_string());
    }
    sqlx::query("DELETE FROM archive_templates WHERE id = ?")
        .bind(template_id)
        .execute(pool)
        .await
        .map_err(|e| format!("删除模板失败: {}", e))?;
    Ok(())
}

/// 保存配置方案
pub async fn save_config_scheme(
    pool: &SqlitePool,
    scheme_name: String,
    template_id: i64,
    scheme_json: String,
) -> Result<i64, String> {
    let result = sqlx::query(
        r#"
        INSERT INTO config_schemes (name, template_id, scheme_json)
        VALUES (?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
            template_id = excluded.template_id,
            scheme_json = excluded.scheme_json,
            updated_at = (datetime('now', 'localtime'))
        "#
    )
    .bind(scheme_name)
    .bind(template_id)
    .bind(scheme_json)
    .execute(pool)
    .await
    .map_err(|e| format!("保存配置方案失败: {}", e))?;
    Ok(result.last_insert_rowid())
}

/// 加载配置方案列表
pub async fn list_config_schemes(
    pool: &SqlitePool,
    template_id: Option<i64>,
) -> Result<Vec<crate::models::scheme::SchemeInfo>, String> {
    let rows = if let Some(tid) = template_id {
        sqlx::query_as::<_, SchemeInfo>(
            "SELECT id, name, template_id, created_at FROM config_schemes WHERE template_id = ? ORDER BY id DESC"
        )
        .bind(tid)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("查询配置方案失败: {}", e))?
    } else {
        sqlx::query_as::<_, SchemeInfo>(
            "SELECT id, name, template_id, created_at FROM config_schemes ORDER BY id DESC"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| format!("查询配置方案失败: {}", e))?
    };
    Ok(rows)
}

/// 提交手动坐标
pub async fn submit_manual_pos(
    pool: &SqlitePool,
    file_id: i64,
    x_mm: f32,
    y_mm: f32,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE files SET manual_x_mm = ?, manual_y_mm = ?, updated_at = (datetime('now', 'localtime')) WHERE id = ?"
    )
    .bind(x_mm)
    .bind(y_mm)
    .bind(file_id)
    .execute(pool)
    .await
    .map_err(|e| format!("提交手动坐标失败: {}", e))?;
    Ok(())
}

// （SchemeInfo 已移至 models/scheme.rs，此处不再重复定义）
