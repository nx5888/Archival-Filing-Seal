// src-tauri/src/core/processor.rs
// 批量处理主循环

use serde::Serialize;
use tauri::AppHandle;

use crate::models::config::StampConfig;
use crate::models::batch::BatchResult;
use crate::core::pdf_editor;

/// 进度负载（通过事件发送给前端）
#[derive(Debug, Serialize, Clone)]
pub struct ProgressPayload {
    pub current: usize,
    pub total: usize,
    pub file_path: String,
    pub status: String,      // "processing" | "completed" | "failed"
    pub output_path: Option<String>,
    pub error: Option<String>,
}

/// 启动批量处理
/// file_paths: 前端传入的待处理 PDF 路径列表
pub async fn start_batch_stamp(
    app: AppHandle,
    file_paths: Vec<String>,
    config: StampConfig,
    schema_json: String,
) -> Result<BatchResult, String> {
    let total = file_paths.len();
    let mut success: u32 = 0;
    let mut failed: u32 = 0;
    let mut errors: Vec<String> = Vec::new();

    for (i, file_path) in file_paths.iter().enumerate() {
        let current = i + 1;
        let fp = file_path.clone();

        // 发送"处理中"进度
        let _ = app.emit("stamp-progress", ProgressPayload {
            current,
            total,
            file_path: fp.clone(),
            status: "processing".into(),
            output_path: None,
            error: None,
        });

        match pdf_editor::stamp_pdf(&fp, &config, &schema_json).await {
            Ok(out_path) => {
                success += 1;
                let _ = app.emit("stamp-progress", ProgressPayload {
                    current,
                    total,
                    file_path: fp.clone(),
                    status: "completed".into(),
                    output_path: Some(out_path),
                    error: None,
                });
            }
            Err(e) => {
                failed += 1;
                let msg = format!("{}: {}", fp, e);
                errors.push(msg.clone());
                let _ = app.emit("stamp-progress", ProgressPayload {
                    current,
                    total,
                    file_path: fp,
                    status: "failed".into(),
                    output_path: None,
                    error: Some(msg),
                });
            }
        }
    }

    Ok(BatchResult {
        total: success + failed,
        success,
        failed,
        errors,
    })
}
