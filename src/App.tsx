import { Component, useEffect, type ReactNode } from 'react';
import { useStore } from './model/store';
import { findParent } from './model/tree';
import { Canvas } from './editor/Canvas';
import { LeftPanel } from './editor/LeftPanel';
import { PropertiesPanel } from './editor/PropertiesPanel';
import { Toolbar } from './editor/Toolbar';

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      const st = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
      } else if (st.mode === 'edit' && st.selectedId) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          st.deleteNode(st.selectedId);
        } else if (mod && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          st.duplicateNode(st.selectedId);
        } else if (e.key === 'Escape') {
          const sc = st.project.screens.find((s) => s.id === st.currentScreenId);
          const parent = sc && findParent(sc.root, st.selectedId);
          st.select(parent?.id ?? null);
        }
      } else if (st.mode === 'preview' && e.key === 'Escape') {
        st.closeModal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** ビルダーの配色を <html data-theme> に反映する。system のときは OS の設定に追従する */
function useTheme() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

/** 画面下の通知。外部の変更を読み込んだときなどに出す */
function NoticeBar() {
  const notice = useStore((s) => s.notice);
  useEffect(() => {
    // 情報の通知は自動で消す。警告（手元の編集が保存されなかった場合）は閉じるまで残す
    if (!notice || notice.kind === 'warn') return;
    const t = window.setTimeout(() => useStore.getState().setNotice(null), 10000);
    return () => window.clearTimeout(t);
  }, [notice]);
  if (!notice) return null;
  const st = useStore.getState();
  return (
    <div className={`notice-bar ${notice.kind ?? 'info'}`} role="status">
      <span className="notice-text">{notice.text}</span>
      {notice.undoable && (
        <button
          className="btn sm"
          onClick={() => {
            st.undo();
            st.setNotice(null);
          }}
        >
          元に戻す
        </button>
      )}
      <button className="icon-btn" title="閉じる" onClick={() => st.setNotice(null)}>
        ×
      </button>
    </div>
  );
}

/** 描画中の例外で画面全体が真っ白になるのを防ぎ、復旧手段を出す */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const st = useStore.getState();
    const recover = (fn: () => void) => () => {
      fn();
      this.setState({ error: null });
    };
    return (
      <div className="error-screen">
        <h3>表示中にエラーが発生しました</h3>
        <pre>{error.message}</pre>
        <div className="btn-row">
          <button className="btn" disabled={!st.past.length} onClick={recover(st.undo)}>
            直前の操作を取り消す
          </button>
          <button className="btn" onClick={recover(st.newProject)}>
            新規プロジェクトで開始
          </button>
          <button className="btn" onClick={recover(st.loadSample)}>
            サンプルを読み込む
          </button>
        </div>
      </div>
    );
  }
}

export default function App() {
  useShortcuts();
  useTheme();
  const mode = useStore((s) => s.mode);
  return (
    <div className={`app mode-${mode}`}>
      <ErrorBoundary>
        <Toolbar />
        <div className="workspace">
          {mode === 'edit' && <LeftPanel />}
          <main className="canvas-area">
            <Canvas />
          </main>
          {mode === 'edit' && <PropertiesPanel />}
        </div>
        <NoticeBar />
      </ErrorBoundary>
    </div>
  );
}
