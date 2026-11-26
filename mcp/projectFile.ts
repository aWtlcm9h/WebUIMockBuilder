// プロジェクトファイル（*.uimock.json）の読み書き。MCP サーバーと開発サーバーの両方から使う
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const FILE_SUFFIX = '.uimock.json';

/** 相対パスは実行時のカレントディレクトリから解決する。対象は *.uimock.json に限る */
export function resolveFile(file: string | undefined | null, fallback = process.env.UIMOCK_FILE || `ui${FILE_SUFFIX}`): string {
  const path = resolve(file && file.trim() ? file.trim() : fallback);
  if (!path.endsWith(FILE_SUFFIX)) throw new Error(`プロジェクトファイルの名前は ${FILE_SUFFIX} で終わる必要があります: ${path}`);
  return path;
}

/** ファイルの版を表す文字列（内容のハッシュ）。変更検知と、保存時の衝突検知に使う */
export function etagOf(path: string): string | null {
  if (!existsSync(path)) return null;
  return createHash('sha1').update(readFileSync(path)).digest('hex');
}

export function readText(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

/** 書きかけのファイルを他のプロセスが読まないよう、一時ファイルに書いてから置き換える */
export function writeText(path: string, text: string): string {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, path);
  return etagOf(path)!;
}
