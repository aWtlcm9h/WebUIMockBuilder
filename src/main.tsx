import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './parts';
import './styles.css';
import App from './App';
import { startFileSync } from './model/fileSync';

// 初回描画の前に配色を決める（ライト→ダークのちらつきを防ぐ）。以降の追従は App の useTheme が行う
try {
  const saved = localStorage.getItem('webui-mock-builder:theme');
  const dark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
} catch {
  /* ignore */
}

// プロジェクトファイルとの同期（開発サーバーで、ファイルが指定されているときだけ有効）
void startFileSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
