#!/bin/sh
# MCP サーバーの起動スクリプト。どのフォルダから呼ばれても動くよう、自分の場所から依存を解決する。
# 相対パスのプロジェクトファイルは、呼び出し元（エージェントの作業フォルダ）から解決される。
DIR="$(cd "$(dirname "$0")/.." && pwd)"

# GUI アプリから起動されると、シェルの PATH が引き継がれず node が見つからないことがある。
# その場合は NODE_BIN_DIR で node のあるフォルダを指定するか、よくある場所から探す。
if [ -n "$NODE_BIN_DIR" ]; then
  PATH="$NODE_BIN_DIR:$PATH"
elif ! command -v node >/dev/null 2>&1; then
  for d in "$HOME/.local/node/bin" "$HOME/.volta/bin" /opt/homebrew/bin /usr/local/bin; do
    if [ -x "$d/node" ]; then
      PATH="$d:$PATH"
      break
    fi
  done
fi
export PATH

if ! command -v node >/dev/null 2>&1; then
  echo "webui-mock: node が見つかりません。NODE_BIN_DIR に node のあるフォルダを指定してください。" >&2
  exit 1
fi
if [ ! -x "$DIR/node_modules/.bin/tsx" ]; then
  echo "webui-mock: 依存パッケージがありません。$DIR で npm install を実行してください。" >&2
  exit 1
fi

exec "$DIR/node_modules/.bin/tsx" --tsconfig "$DIR/tsconfig.json" "$DIR/mcp/server.ts"
