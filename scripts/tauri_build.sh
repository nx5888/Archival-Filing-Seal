#!/usr/bin/env bash
# tauri_build.sh — 自动查找 cargo 并运行 tauri build/packaging
# 用法: bash tauri_build.sh              # 开发模式 tauri dev
#       bash tauri_build.sh build        # 生产构建
#       bash tauri_build.sh build --release
#       bash tauri_build.sh sign         # 签名（Windows）

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 查找 cargo 并添加到 PATH
CARGO_PATH=""
if [ -f "$SCRIPT_DIR/find_cargo.sh" ]; then
    # 使用 find_cargo.sh 的逻辑查找 cargo
    for dir in \
        "$HOME/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin" \
        "$HOME/.rustup/toolchains/nightly-x86_64-pc-windows-msvc/bin" \
        "$USERPROFILE/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin" \
        "$USERPROFILE/.cargo/bin"; do
        if [ -f "$dir/cargo.exe" ]; then
            CARGO_PATH="$dir"
            break
        fi
    done
fi

if [ -z "$CARGO_PATH" ]; then
    echo "Cannot find cargo. Please install Rust first."
    exit 1
fi

# 将 cargo 路径添加到 PATH
export PATH="$CARGO_PATH:$PATH"

# 确保 Web 前端已构建
echo "==> Checking frontend build..."
if [ ! -d "$PROJECT_ROOT/dist" ]; then
    echo "Frontend not built, building now..."
    cd "$PROJECT_ROOT"
    npm install && npm run build
fi

# 进入项目根目录并运行 tauri 命令（使用 npx）
cd "$PROJECT_ROOT"

CARGO_CMD="$1"
shift || true

echo "==> Running: npx tauri ${CARGO_CMD} $*"
echo "==> In: $PROJECT_ROOT"
echo "==> Using cargo from: $CARGO_PATH"
echo "---"

# 使用 npx 运行 tauri CLI（它安装在 node_modules/.bin/tauri）
exec npx tauri "${CARGO_CMD}" "$@"
