// src-tauri/src/models/scheme.rs
// 配置方案相关结构体

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// 配置方案简要信息（列表返回）
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SchemeInfo {
    pub id: i64,
    pub name: String,
    pub template_id: i64,
    pub created_at: Option<String>,
}
