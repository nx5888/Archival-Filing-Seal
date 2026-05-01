// src-tauri/src/core/processor.rs
// 批量处理主循环

use std::sync::Arc;
use futures::future::join_all;
use serde::Serialize;
use tauri::Emitter;
use tokio::sync::Semaphore;
use crate::models::config::StampConfig;
use crate::models::batch::BatchResult;

/// 启动批量盖章处理
///
/// # 参数
/// - `app`: Tauri AppHandle，用于向前端发送进度事件
/// - `file_paths`: 需要处理的 PDF 文件路径列表（前端从扫描结果中收集）
/// - `config`: 归档章配置（全宗号、保管期限、偏移等）
/// - `schema_json`: 归档章布局 schema JSON（单元格定义）
///
/// # 事件通知
/// 通过 Tauri Event 向前端发送 `stamp-progress` 事件，包含：
///   - current/total: 当前进度
///   - file_path: 当前处理的文件
///   - status: "processing" | "completed" | "failed"
///   - output_path/error: 结果或错误信息
pub async fn start_batch_stamp(
    app: tauri::AppHandle,
    file_paths: Vec<String>,
    config: StampConfig,
    schema_json: String,
) -> Result<BatchResult, String> {
    let total = file_paths.len();
    let concurrency = 4usize;
    let semaphore = Arc::new(Semaphore::new(concurrency));
    let config = Arc::new(config);
    let schema_json = Arc::new(schema_json);

    // 为每个文件创建一个 async Future
    let futures = file_paths
        .into_iter()
        .enumerate()
        .map(|(i, file_path)| {
            let app = app.clone();
            let semaphore = semaphore.clone();
            let config = config.clone();
            let schema_json = schema_json.clone();

            async move {
                // 获取并发许可
                let _permit = semaphore.acquire().await.unwrap();
                let current = i + 1;

                // 发送开始处理事件
                let _ = emit_progress(
                    &app,
                    ProgressPayload {
                        current,
                        total,
                        file_path: file_path.clone(),
                        status: "processing".to_string(),
                        output_path: String::new(),
                        error: None,
                    },
                );

                // 调用盖章引擎（带重试）
                let result = async {
                    for retry in 0..=2 {
                        match crate::core::pdf_editor::stamp_pdf(
                            &file_path,
                            &config,
                            &schema_json,
                            None,
                        ).await {
                            Ok(output_path) => return Ok(output_path),
                            Err(e) if retry < 2 => {
                                tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                            }
                            Err(e) => return Err(e),
                        }
                    }
                    Err("重试次数已用完".to_string())
                }.await;

                match result {
                    Ok(output_path) => {
                        let _ = emit_progress(
                            &app,
                            ProgressPayload {
                                current,
                                total,
                                file_path: file_path.clone(),
                                status: "completed".to_string(),
                                output_path,
                                error: None,
                            },
                        );
                        (true, None)
                    }
                    Err(e) => {
                        let _ = emit_progress(
                            &app,
                            ProgressPayload {
                                current,
                                total,
                                file_path: file_path.clone(),
                                status: "failed".to_string(),
                                output_path: String::new(),
                                error: Some(e.clone()),
                            },
                        );
                        (false, Some(format!("{}: {}", file_path, e)))
                    }
                }
            }
        });

    let results = join_all(futures).await;

    let success = results.iter().filter(|(ok, _)| *ok).count();
    let failed = results.iter().filter(|(ok, _)| !*ok).count();
    let errors: Vec<String> = results.into_iter()
        .filter_map(|(_, err)| err)
        .collect();

    Ok(BatchResult {
        total: success + failed,
        success,
        failed,
        errors,
    })
}

/// 发送进度事件到前端
fn emit_progress(app: &tauri::AppHandle, payload: ProgressPayload) -> Result<(), String> {
    app.emit("stamp-progress", &payload)
        .map_err(|e| format!("发送进度事件失败: {}", e))
}

/// 处理进度负载（通过 Tauri Event 发送给前端）
#[derive(Debug, Serialize, Clone)]
pub struct ProgressPayload {
    pub current: usize,
    pub total: usize,
    pub file_path: String,
    pub status: String,       // "processing" | "completed" | "failed"
    pub output_path: String,
    pub error: Option<String>,
}
