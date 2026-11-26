import { useRef, useState } from 'react';
import { useStore, type ThemeSetting } from '../model/store';
import { linkFile, requestedFile } from '../model/fileSync';
import { VIEWPORT_WIDTH, type Viewport } from '../model/types';
import { toCompactJson, toMarkdown } from '../export/agentSpec';
import { downloadText, readProjectFile, safeFileName, serializeProject } from '../export/io';

function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project);
  const [tab, setTab] = useState<'md' | 'json'>('md');
  const [copied, setCopied] = useState(false);
  const text = tab === 'md' ? toMarkdown(project) : toCompactJson(project);
  const base = safeFileName(project.name);
  const kb = (new Blob([text]).size / 1024).toFixed(1);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <b>コーディングエージェント向けに出力</b>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="seg">
          <button className={tab === 'md' ? 'on' : ''} onClick={() => setTab('md')}>
            Markdown（推奨・プロンプトに貼る）
          </button>
          <button className={tab === 'json' ? 'on' : ''} onClick={() => setTab('json')}>
            コンパクトJSON（構造の厳密な参照用）
          </button>
        </div>
        <textarea className="export-text" readOnly value={text} />
        <div className="btn-row">
          <span className="hint">{kb} KB</span>
          <span style={{ flex: 1 }} />
          <button
            className="btn"
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'コピーしました' : 'コピー'}
          </button>
          <button
            className="btn primary"
            onClick={() =>
              tab === 'md'
                ? downloadText(`${base}.ui-spec.md`, text, 'text/markdown')
                : downloadText(`${base}.ui-spec.json`, text)
            }
          >
            ダウンロード
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toolbar() {
  const project = useStore((s) => s.project);
  const mode = useStore((s) => s.mode);
  const zoom = useStore((s) => s.zoom);
  const theme = useStore((s) => s.theme);
  const fileSync = useStore((s) => s.fileSync);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const st = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showExport, setShowExport] = useState(false);

  return (
    <header className="toolbar">
      <span className="brand">WebUI Mock Builder</span>
      <input
        className="f-input project-name"
        value={project.name}
        onChange={(e) => st.setProjectMeta({ name: e.target.value })}
        title="プロジェクト名"
      />
      <div className="tb-group">
        <button className="btn" onClick={() => confirm('現在のプロジェクトを破棄して新規作成しますか？（保存していない変更は失われます）') && st.newProject()}>
          新規
        </button>
        <button
          className="btn"
          onClick={() => {
            // 変更があるときだけ確認する（開くと現在のプロジェクトと履歴は置き換わる）
            if (canUndo && !confirm('別のプロジェクトを開くと、現在のプロジェクトは置き換えられます。保存していない変更は失われます。続けますか？')) return;
            fileRef.current?.click();
          }}
        >
          開く
        </button>
        <button className="btn" onClick={() => downloadText(`${safeFileName(project.name)}.uimock.json`, serializeProject(project))}>
          保存
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              st.loadProject(await readProjectFile(f));
            } catch (err) {
              alert(`読み込みに失敗しました: ${(err as Error).message}`);
            }
          }}
        />
      </div>
      <button
        className={`file-chip ${fileSync ? fileSync.state : 'off'}`}
        title={
          fileSync
            ? `${fileSync.file}\n${fileSync.message ?? ''}\nクリックで連携先を変更（空にすると解除）`
            : 'プロジェクトファイル（*.uimock.json）と同期します。コーディングエージェント（MCP）の編集がすぐ反映されます'
        }
        onClick={() => {
          const path = prompt('連携するプロジェクトファイルのパス（*.uimock.json）。空にすると連携を解除します。', fileSync?.file ?? requestedFile() ?? '');
          if (path !== null) linkFile(path);
        }}
      >
        {fileSync
          ? `📄 ${fileSync.file.split('/').pop()} · ${fileSync.state === 'synced' ? '同期済み' : fileSync.state === 'saving' ? '保存中…' : 'エラー'}`
          : '📄 ファイル連携'}
      </button>
      <div className="tb-group">
        <button className="btn" disabled={!canUndo} onClick={st.undo} title="元に戻す (⌘Z)">
          ↶
        </button>
        <button className="btn" disabled={!canRedo} onClick={st.redo} title="やり直す (⌘⇧Z)">
          ↷
        </button>
      </div>
      <span style={{ flex: 1 }} />
      <select
        className="f-input"
        style={{ width: 'auto' }}
        value={project.viewport}
        onChange={(e) => st.setProjectMeta({ viewport: e.target.value as Viewport })}
      >
        {(Object.keys(VIEWPORT_WIDTH) as Viewport[]).map((v) => (
          <option key={v} value={v}>
            {v} {VIEWPORT_WIDTH[v]}px
          </option>
        ))}
      </select>
      <select
        className="f-input"
        style={{ width: 'auto' }}
        value={theme}
        title="ビルダーの配色"
        onChange={(e) => st.setTheme(e.target.value as ThemeSetting)}
      >
        <option value="system">配色: OSに合わせる</option>
        <option value="light">配色: ライト</option>
        <option value="dark">配色: ダーク</option>
      </select>
      <select
        className="f-input"
        style={{ width: 'auto' }}
        value={String(zoom)}
        title="表示倍率"
        onChange={(e) => st.setZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}
      >
        <option value="fit">幅に合わせる</option>
        {[0.5, 0.75, 1].map((z) => (
          <option key={z} value={z}>
            {z * 100}%
          </option>
        ))}
      </select>
      <div className="seg">
        <button className={mode === 'edit' ? 'on' : ''} onClick={() => st.setMode('edit')}>
          編集
        </button>
        <button className={mode === 'preview' ? 'on' : ''} onClick={() => st.setMode('preview')}>
          プレビュー
        </button>
      </div>
      <button className="btn primary" onClick={() => setShowExport(true)}>
        エージェント向けに出力
      </button>
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
    </header>
  );
}
