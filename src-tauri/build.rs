// src-tauri/build.rs
// Tauri v2 构建脚本：生成上下文、编译插件权限
// 跳过图标验证（开发阶段）

fn main() {
    // 设置环境变量以跳过图标验证
    std::env::set_var("TAURI_SKIP_ICON_VALIDATION", "true");
    
    tauri_build::build()
}
