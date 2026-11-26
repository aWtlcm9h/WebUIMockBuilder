import { useState } from 'react';
import { dragState, useStore } from '../model/store';
import { findNode, findParent } from '../model/tree';
import { findTreeRoot } from '../model/components';
import { COMPONENT_REF, type Props } from '../model/types';
import { allParts, canAccept, categories } from '../parts/registry';

function ScreenList() {
  const screens = useStore((s) => s.project.screens);
  const current = useStore((s) => s.currentScreenId);
  const st = useStore.getState();
  const [renaming, setRenaming] = useState<string | null>(null);

  return (
    <div className="panel-section">
      <div className="section-title">
        画面
        <span className="section-actions">
          <button className="icon-btn" title="ページを追加" onClick={() => st.addScreen('page')}>
            ＋
          </button>
          <button className="icon-btn" title="モーダルを追加" onClick={() => st.addScreen('modal')}>
            ⧉
          </button>
        </span>
      </div>
      <div className="screen-list">
        {screens.map((s, i) => (
          <div
            key={s.id}
            className={`screen-item ${s.id === current ? 'active' : ''}`}
            onClick={() => st.setScreen(s.id)}
            onDoubleClick={() => setRenaming(s.id)}
          >
            <span className="screen-kind">{s.kind === 'modal' ? '⧉' : '▭'}</span>
            {renaming === s.id ? (
              <input
                className="f-input"
                autoFocus
                defaultValue={s.name}
                onBlur={(e) => {
                  st.updateScreen(s.id, { name: e.target.value || s.name });
                  setRenaming(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setRenaming(null);
                }}
              />
            ) : (
              <span className="screen-name">{s.name}</span>
            )}
            <span className="screen-actions" onClick={(e) => e.stopPropagation()}>
              <button className="icon-btn" title="上へ" disabled={i === 0} onClick={() => st.moveScreen(s.id, -1)}>
                ↑
              </button>
              <button className="icon-btn" title="複製" onClick={() => st.duplicateScreen(s.id)}>
                ⎘
              </button>
              <button
                className="icon-btn"
                title="削除"
                disabled={screens.length <= 1}
                onClick={() => confirm(`画面「${s.name}」を削除しますか？`) && st.removeScreen(s.id)}
              >
                ×
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** パレットのクリックで追加: 選択中のコンテナの末尾、またはその兄弟として後ろに追加 */
function addByClick(type: string, props?: Props) {
  const st = useStore.getState();
  const screen = st.project.screens.find((s) => s.id === st.currentScreenId)!;
  // 選択中の要素は、画面のツリーか共通パーツの中身にある。共通パーツは共通パーツの中には置けない
  let root = st.selectedId ? findTreeRoot(st.project, st.selectedId) : null;
  if (root && type === COMPONENT_REF && root.id !== screen.root.id) root = null;
  const sel = root && st.selectedId ? findNode(root, st.selectedId) : null;
  if (sel && canAccept(sel.type, type)) return st.addNode(sel.id, sel.children?.length ?? 0, type, props);
  if (sel && root) {
    const parent = findParent(root, sel.id);
    if (parent && canAccept(parent.type, type)) {
      const idx = parent.children!.findIndex((c) => c.id === sel.id);
      return st.addNode(parent.id, idx + 1, type, props);
    }
  }
  st.addNode(screen.root.id, screen.root.children?.length ?? 0, type, props);
}

function ComponentList() {
  const components = useStore((s) => s.project.components ?? []);
  const st = useStore.getState();
  const [renaming, setRenaming] = useState<string | null>(null);
  return (
    <div className="panel-section">
      <div className="section-title">共通パーツ</div>
      {components.length === 0 && (
        <div className="hint">ヘッダーなど複数の画面で使う要素を選び、右パネルの「◈ 共通パーツにする」で登録できます。</div>
      )}
      {components.map((c) => (
        <div
          key={c.id}
          className="component-item"
          draggable={renaming !== c.id}
          title="ドラッグで配置／クリックで追加／ダブルクリックで名前変更"
          onDragStart={(e) => {
            dragState.payload = { kind: 'new', type: COMPONENT_REF, props: { componentId: c.id } };
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', c.id);
          }}
          onDragEnd={() => {
            dragState.payload = null;
            useStore.getState().setDropTarget(null);
          }}
          onClick={() => renaming !== c.id && addByClick(COMPONENT_REF, { componentId: c.id })}
          onDoubleClick={() => setRenaming(c.id)}
        >
          <span className="part-icon">◈</span>
          {renaming === c.id ? (
            <input
              className="f-input"
              autoFocus
              defaultValue={c.name}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                st.renameComponent(c.id, e.target.value || c.name);
                setRenaming(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setRenaming(null);
              }}
            />
          ) : (
            <span className="screen-name">{c.name}</span>
          )}
          <span className="screen-actions" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn" title="中身を編集" onClick={() => st.select(c.root.id)}>
              ✎
            </button>
            <button
              className="icon-btn"
              title="削除"
              onClick={() =>
                confirm(`共通パーツ「${c.name}」を削除しますか？\n使われている場所は、それぞれ独立したコピーとして残ります。`) && st.deleteComponent(c.id)
              }
            >
              ×
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function Palette() {
  const [q, setQ] = useState('');
  const parts = allParts().filter((p) => !p.hidden && p.inPalette !== false && (!q || `${p.label}${p.type}${p.description ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="panel-section palette">
      <div className="section-title">パーツ</div>
      <input className="f-input" placeholder="パーツを検索" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="hint">ドラッグで配置／クリックで選択中の要素に追加</div>
      {categories().map((cat) => {
        const items = parts.filter((p) => p.category === cat);
        if (!items.length) return null;
        return (
          <div key={cat} className="palette-cat">
            <div className="palette-cat-title">{cat}</div>
            <div className="palette-grid">
              {items.map((p) => (
                <div
                  key={p.type}
                  className="palette-item"
                  draggable
                  title={p.description ?? p.label}
                  onDragStart={(e) => {
                    dragState.payload = { kind: 'new', type: p.type };
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', p.type);
                  }}
                  onDragEnd={() => {
                    dragState.payload = null;
                    useStore.getState().setDropTarget(null);
                  }}
                  onClick={() => addByClick(p.type)}
                >
                  <span className="part-icon">{p.icon}</span>
                  <span className="palette-label">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LeftPanel() {
  return (
    <aside className="panel left">
      <ScreenList />
      <ComponentList />
      <Palette />
    </aside>
  );
}
