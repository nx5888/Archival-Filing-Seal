#!/usr/bin/env bash
# find_cargo.sh — 自动查找 cargo 并运行命令
# 用法: bash find_cargo.sh check
#       bash find_cargo.sh build --release
#       bash find_cargo.sh test

set -e

CARGO=""

# 方法1：直接 which/command -v
if command -v cargo.exe &>/dev/null; then
    CARGO="cargo.exe"
elif command -v cargo &>/dev/null; then
    CARGO="cargo"
fi

# 方法2：检查 rustup 默认安装路径
if [ -z "$CARGO" ]; then
    for dir in \
        "$HOME/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin" \
        "$HOME/.rustup/toolchains/nightly-x86_64-pc-windows-msvc/bin" \
        "$USERPROFILE/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin" \
        "$USERPROFILE/.cargo/bin"; do
        if [ -f "$dir/cargo.exe" ]; then
            CARGO="$dir/cargo.exe"
            break
        fi
    done
fi

# 方法3：用 python 搜索
if [ -z "$CARGO" ] && command -v python3 &>/dev/null; then
    CARGO=$(python3 -c "
import os, glob
homes = [os.path.expanduser('~'), os.environ.get('USERPROFILE','')]
for h in homes:
    for pattern in ['**/.rustup/toolchains/*/bin/cargo.exe', '**/.cargo/bin/cargo.exe']:
        for p in glob.glob(os.path.join(h, pattern), recursive=True):
            print(p); exit(0)
" 2>/dev/null)
fi

if [ -z "$CARGO" ]; then
    echo "Cannot find cargo. Please install Rust first:"
    echo "  winget install --id Rust.Rust.MSVC -e"
    echo "  or visit https://rustup.rs"
    exit 1
fi

echo "Found cargo: $CARGO"
echo "Running: cargo $*"
echo "---"

exec "$CARGO" "$@"
