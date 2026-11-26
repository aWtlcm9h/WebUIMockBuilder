// プロジェクトファイル（*.uimock.json）との同期。
// 開発サーバーのAPI（vite.config.ts）経由でファイルを読み書きし、
// エージェント（MCP）など外部からの変更を検知して画面に反映する。
//
// 同時に編集された場合は、外部（ファイル）の内容が勝つ。
// ビルダーは保存時に「最後に読んだ版のままか」を確かめ、変わっていたら保存をやめて読み込み直す。
// 読み込み直す前の内容は履歴に入るので、「元に戻す」で取り戻せる。
import { useStore } from './store';
import { normalizeProject } from './validate';
import { describeChanges, hasChanges, summarizeChanges } from './diff';

const POLL_MS = 1500;
const SAVE_DELAY_MS = 500;

const api = (path: string, file: string | null) => `${path}${file ? `?file=${encodeURIComponent(file)}` : ''}`;

/** URL の ?file= で指定されたファイル。なければ開発サーバー起動時の UIMOCK_FILE が使われる */
export function requestedFile(): string | null {
  return new URLSearchParams(location.search).get('file');
}

export function linkFile(path: string) {
  const url = new URL(location.href);
  if (path.trim()) url.searchParams.set('file', path.trim());
  else url.searchParams.delete('file');
  location.href = url.toString();
}

export async function startFileSync() {
  const file = requestedFile();
  const setStatus = useStore.getState().setFileSync;
  let etag: string | null = null;
  /** ファイルと一致していると分かっている内容。自分の保存を外部の変更と取り違えないために使う */
  let syncedJson = '';
  let saveTimer: number | undefined;
  let busy = false;

  let first: { enabled?: boolean; file?: string; etag?: string | null; text?: string | null; error?: string };
  try {
    const res = await fetch(api('/api/project', file));
    if (!res.headers.get('content-type')?.includes('json')) return; // APIのない環境（静的ビルドなど）
    first = await res.json();
  } catch {
    return;
  }
  if (first.error) return setStatus({ file: file ?? '', state: 'error', message: first.error });
  if (!first.enabled || !first.file) return;
  const path = first.file;

  /** ファイルの内容を読み込んで画面に反映する。localUnsaved は、保存できなかった手元の編集があるとき true */
  const pullRemote = async (localUnsaved: boolean) => {
    const full = await (await fetch(api('/api/project', file))).json();
    if (full.text == null) return;
    window.clearTimeout(saveTimer);
    const before = useStore.getState().project;
    const project = normalizeProject(JSON.parse(full.text));
    etag = full.etag;
    syncedJson = JSON.stringify(project);
    const changes = summarizeChanges(before, project);
    useStore.getState().replaceFromFile(project);
    setStatus({ file: path, state: 'synced' });
    if (!hasChanges(changes)) return;
    useStore.getState().setNotice(
      localUnsaved
        ? {
            kind: 'warn',
            undoable: true,
            text: `編集中にファイルが外部（エージェントなど）で更新されたため、ファイルの内容を読み込みました。直前のあなたの編集は保存されていません。「元に戻す」で読み込む前の状態に戻せます。（${describeChanges(changes)}）`,
          }
        : { kind: 'info', undoable: true, text: `ファイルが外部（エージェントなど）で更新されました: ${describeChanges(changes)}` },
    );
  };

  const save = async () => {
    const json = JSON.stringify(useStore.getState().project);
    if (json === syncedJson || busy) return;
    busy = true;
    setStatus({ file: path, state: 'saving' });
    try {
      const res = await fetch(api('/api/project', file), {
        method: 'PUT',
        headers: { 'X-Base-Etag': etag ?? '' },
        body: JSON.stringify(useStore.getState().project, null, 1),
      });
      const data = await res.json();
      if (res.status === 409) {
        // 最後に読んだあとでファイルが変わっていた。上書きせず、ファイルの内容を読み込む
        await pullRemote(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      etag = data.etag;
      syncedJson = json;
      setStatus({ file: path, state: 'synced' });
    } catch (e) {
      setStatus({ file: path, state: 'error', message: `保存に失敗: ${(e as Error).message}` });
    } finally {
      busy = false;
      // 保存中にさらに編集されていたら、続けて保存する
      if (JSON.stringify(useStore.getState().project) !== syncedJson) scheduleSave();
    }
  };
  const scheduleSave = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(save, SAVE_DELAY_MS);
  };

  // 初回: ファイルがあれば読み込み、なければ現在の内容で作成する
  try {
    if (first.text != null) {
      const project = normalizeProject(JSON.parse(first.text));
      syncedJson = JSON.stringify(project);
      etag = first.etag ?? null;
      useStore.getState().loadProject(project);
      setStatus({ file: path, state: 'synced' });
    } else {
      await save();
    }
  } catch (e) {
    setStatus({ file: path, state: 'error', message: `読み込みに失敗: ${(e as Error).message}` });
  }

  // 画面での編集をファイルに保存する
  useStore.subscribe((s, prev) => {
    if (s.project === prev.project) return;
    if (JSON.stringify(s.project) === syncedJson) return;
    scheduleSave();
  });

  // 外部（エージェントなど）からの変更を取り込む
  window.setInterval(async () => {
    if (busy) return;
    try {
      const data = await (await fetch(api('/api/project/etag', file))).json();
      if (!data.etag || data.etag === etag || busy) return;
      busy = true;
      try {
        await pullRemote(JSON.stringify(useStore.getState().project) !== syncedJson);
      } finally {
        busy = false;
      }
    } catch (e) {
      setStatus({ file: path, state: 'error', message: `再読み込みに失敗: ${(e as Error).message}` });
    }
  }, POLL_MS);
}
