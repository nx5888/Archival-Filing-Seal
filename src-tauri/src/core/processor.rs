// src-tauri/src/core/processor.rs
// 批量处理主循环

use serde::Serialize;
use sqlx::SqlitePool;

use crate::models::config::StampConfig;

/// 启动批量处理
pub async fn start_batch_stamp(
    _pool: &SqlitePool,
    _app: tauri::AppHandle,
    batch_ids: Vec<i64>,
    _config: StampConfig,
    _schema_json: String,
) -> Result<crate::models::batch::BatchResult, String> {
    let mut success: u32 = 0;
    let mut failed: u32 = 0;
    let mut errors: Vec<String> = Vec::new();

    for batch_id in batch_ids {
        // TODO: 从数据库读取该 batch 下的所有文件
        // TODO: 逐文件调用 pdf_editor 处理
        // TODO: 更新数据库状态
        //
        // 伪代码：
        // let files = db::get_files_by_batch(_pool, batch_id).await?;
        // for file in files {
        //     match pdf_editor::stamp_pdf(&file, &_config, &_schema_json).await {
        //         Ok(_) => { success += 1; db::mark_completed(_pool, file.id).await; }
        //         Err(e) => { failed += 1; errors.push(format!("{}: {}", file.file_path, e)); }
        //     }
        // }
        //
        // 进度通知前端：
        // _app.emit("stamp-progress", ProgressPayload { batch_id, current, total, ..  });
        let _ = batch_id;
    }

    Ok(crate::models::batch::BatchResult {
        total: success + failed,
        success,
        failed,
        errors,
    })
}

/// 处理进度负载（通过事件发送给前端）
#[derive(Debug, Serialize)]
pub struct ProgressPayload {
    pub batch_id: i64,
    pub file_path: String,
    pub current: usize,
    pub total: usize,
    pub status: String, // "processing" | "completed" | "failed"
    pub error: Option<String>,
}
