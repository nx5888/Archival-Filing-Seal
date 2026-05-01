// src-tauri/src/main.rs
// 电子档案归档章印制工具 - 入口文件

fn main() {
    // 创建 tokio runtime，用于初始化数据库（异步操作）
    let rt = tokio::runtime::Runtime::new()
        .expect("无法创建 tokio runtime");

    // 数据库路径：放在 src-tauri 目录下（开发模式）
    // 生产模式下可改为 app data 目录
    let db_path = "gdz.db";

    // 初始化数据库 + 内置模板
    let pool = rt
        .block_on(async {
            gdz_gj_lib::init_db_and_templates(db_path).await
        })
        .expect("数据库初始化失败，请检查文件权限");

    // 启动 Tauri 主循环（将连接池交给 Tauri 托管）
    gdz_gj_lib::run(pool);
}
