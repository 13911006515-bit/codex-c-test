#!/bin/bash
set -euo pipefail
BLOOM_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BLOOM_DIR"

fail() {
  printf '\n%s\n' "$1"
  read -r -p '按回车键关闭此窗口。' _ || true
  exit 1
}

BLOOM_VERSION="$(/usr/bin/sw_vers -productVersion)"
IFS=. read -r BLOOM_MAJOR BLOOM_MINOR BLOOM_PATCH <<< "$BLOOM_VERSION"
if (( BLOOM_MAJOR < 13 || (BLOOM_MAJOR == 13 && ${BLOOM_MINOR:-0} < 5) )); then
  fail "此版本需要 macOS 13.5 或更新版本。你的系统版本为 $BLOOM_VERSION。"
fi

BLOOM_ARCH="$(/usr/bin/uname -m)"
# A Terminal running through Rosetta can report x86_64 on an Apple silicon Mac.
if [[ "$(/usr/sbin/sysctl -n hw.optional.arm64 2>/dev/null || true)" == '1' ]]; then
  BLOOM_ARCH=arm64
fi
case "$BLOOM_ARCH" in
  arm64) BLOOM_NODE="$BLOOM_DIR/runtime/arm64/node" ;;
  x86_64) BLOOM_NODE="$BLOOM_DIR/runtime/x64/node" ;;
  *) fail "暂不支持此处理器：$BLOOM_ARCH" ;;
esac
[[ -x "$BLOOM_NODE" ]] || fail '运行文件缺失或不可执行，请使用 macOS 自带的归档实用工具完整解压下载包。'
printf '正在启动指尖花园……\n浏览器将自动打开。请保持此终端窗口开启，停止时按 Control+C。\n\n'
if ! "$BLOOM_NODE" "$BLOOM_DIR/serve.cjs"; then
  fail '启动未完成。请查看上方错误信息；系统若提示安全确认，请参阅同文件夹内的“使用说明.txt”。'
fi
