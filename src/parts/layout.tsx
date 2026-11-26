import { useState } from 'react';
import { COMPONENT_REF } from '../model/types';
import type { PartDef, RenderCtx } from './types';
import { containerDefaults, containerFields, describeFlex, flexStyle, list, opt } from './common';

const CAT = 'レイアウト';

function TabsView({ ctx }: { ctx: RenderCtx }) {
  const { node, props, mode } = ctx;
  const panels = node.children ?? [];
  const activeId = String(ctx.uiState.active ?? '');
  const active = panels.find((p) => p.id === activeId) ?? panels[0];
  const [editing, setEditing] = useState<string | null>(null);
  const vertical = props.position === 'left';

  return (
    <div className={`wf-tabs ${vertical ? 'vertical' : ''} variant-${props.variant}`}>
      <div className="wf-tabbar">
        {panels.map((p) => (
          <div
            key={p.id}
            className={`wf-tab ${p.id === active?.id ? 'active' : ''}`}
            onClick={(e) => {
              // プレビューでは、祖先に付いた画面遷移を発火させない
              if (mode === 'preview') e.stopPropagation();
              ctx.setUiState('active', p.id);
            }}
            onDoubleClick={(e) => {
              if (mode !== 'edit') return;
              e.stopPropagation();
              setEditing(p.id);
            }}
            title={mode === 'edit' ? 'ダブルクリックで名前を編集' : undefined}
          >
            {editing === p.id ? (
              <input
                className="wf-tab-input"
                autoFocus
                defaultValue={String(p.props.label)}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  ctx.updateChildProps(p.id, { label: e.target.value || 'タブ' });
                  setEditing(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setEditing(null);
                  e.stopPropagation();
                }}
              />
            ) : (
              <span>{String(p.props.label)}</span>
            )}
            {mode === 'edit' && panels.length > 1 && editing !== p.id && (
              <button
                className="wf-tab-x"
                title="タブを削除"
                onClick={(e) => {
                  e.stopPropagation();
                  ctx.removeChild(p.id);
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {mode === 'edit' && (
          <button
            className="wf-tab-add"
            title="タブを追加"
            onClick={(e) => {
              e.stopPropagation();
              const id = ctx.addChild('tabPanel', { label: `タブ${panels.length + 1}` });
              if (id) ctx.setUiState('active', id);
            }}
          >
            ＋
          </button>
        )}
      </div>
      <div className="wf-tabbody">{active && ctx.renderNode(active)}</div>
    </div>
  );
}

export const layoutParts: PartDef[] = [
  {
    type: COMPONENT_REF,
    label: '共通パーツ',
    category: CAT,
    icon: '◈',
    description: '複数の画面で共有するパーツ。中身を編集すると、使っているすべての画面に反映される',
    inPalette: false,
    fields: [],
    defaultProps: { componentId: '' },
    render: (ctx) => ctx.renderComponent(String(ctx.props.componentId)),
  },
  {
    type: 'container',
    label: 'コンテナ (Flex)',
    category: CAT,
    icon: '▤',
    description: '子要素を縦または横に並べる箱',
    container: true,
    fields: [
      ...containerFields,
      { key: 'border', label: '枠線を表示', kind: 'boolean' },
    ],
    defaultProps: { ...containerDefaults, border: false },
    render: (ctx) =>
      ctx.renderChildren({
        direction: ctx.props.direction === 'row' ? 'row' : 'column',
        style: flexStyle(ctx.props),
        className: ctx.props.border ? 'wf-bordered' : '',
      }),
    describe: (p) => `Flexコンテナ（${describeFlex(p)}${p.border ? ', 枠線あり' : ''}）`,
  },
  {
    type: 'grid',
    label: 'グリッド',
    category: CAT,
    icon: '▦',
    description: '列数を指定して子要素を格子状に並べる',
    container: true,
    fields: [
      { key: 'columns', label: '列数', kind: 'number', min: 1, max: 12 },
      { key: 'gap', label: '間隔 (px)', kind: 'number', min: 0, max: 64 },
      { key: 'padding', label: '内側余白 (px)', kind: 'number', min: 0, max: 64 },
    ],
    defaultProps: { columns: 3, gap: 12, padding: 8 },
    render: (ctx) =>
      ctx.renderChildren({
        direction: 'grid',
        style: {
          gridTemplateColumns: `repeat(${Number(ctx.props.columns) || 1}, minmax(0, 1fr))`,
          gap: Number(ctx.props.gap),
          padding: Number(ctx.props.padding),
        },
      }),
    describe: (p) => `Grid（${p.columns}列, gap ${p.gap}px）`,
  },
  {
    type: 'card',
    label: 'カード / パネル',
    category: CAT,
    icon: '▢',
    description: 'タイトル付きの枠。中に要素を置ける',
    container: true,
    fields: [
      { key: 'title', label: 'タイトル', kind: 'text' },
      { key: 'actions', label: '右上のアクション', kind: 'list', hint: '1行1つ（例: 編集）' },
      ...containerFields,
    ],
    defaultProps: { ...containerDefaults, title: 'パネル', actions: [], padding: 12 },
    render: (ctx) => (
      <div className="wf-card">
        {(ctx.props.title || list(ctx.props.actions).length > 0) && (
          <div className="wf-card-head">
            <span className="wf-card-title">{String(ctx.props.title)}</span>
            <span className="wf-card-actions">
              {list(ctx.props.actions).map((a, i) => (
                <span key={i} className="wf-chip">
                  {a}
                </span>
              ))}
            </span>
          </div>
        )}
        {ctx.renderChildren({
          direction: ctx.props.direction === 'row' ? 'row' : 'column',
          style: { ...flexStyle(ctx.props), flex: 1 },
        })}
      </div>
    ),
    describe: (p) =>
      `カード「${p.title}」（${describeFlex(p)}${list(p.actions).length ? `, アクション: ${list(p.actions).join(' / ')}` : ''}）`,
  },
  {
    type: 'tabs',
    label: 'タブ',
    category: CAT,
    icon: '⊟',
    description: 'タブ切替。タブごとに中身を編集できる（ダブルクリックで名前変更）',
    container: true,
    allowedChildren: ['tabPanel'],
    minChildren: 1,
    fields: [
      { key: 'variant', label: '見た目', kind: 'select', options: opt(['line', '下線'], ['boxed', '箱型'], ['pill', 'ピル']) },
      { key: 'position', label: 'タブの位置', kind: 'select', options: opt(['top', '上'], ['left', '左']) },
    ],
    defaultProps: { variant: 'line', position: 'top' },
    defaultLayout: { height: 'auto' },
    defaultChildren: () => [
      { type: 'tabPanel', props: { label: 'タブ1' } },
      { type: 'tabPanel', props: { label: 'タブ2' } },
    ],
    render: (ctx) => <TabsView ctx={ctx} />,
    describe: (p, n) =>
      `タブ（${(n.children ?? []).length}枚, 位置: ${p.position === 'left' ? '左' : '上'}, 見た目: ${p.variant}）。クリックで下のパネルを切替`,
  },
  {
    type: 'tabPanel',
    label: 'タブパネル',
    category: CAT,
    icon: '▭',
    hidden: true,
    container: true,
    fields: [{ key: 'label', label: 'タブ名', kind: 'text' }, ...containerFields],
    defaultProps: { ...containerDefaults, label: 'タブ', padding: 12 },
    defaultLayout: { width: 'fill', height: 'fill' },
    render: (ctx) =>
      ctx.renderChildren({
        direction: ctx.props.direction === 'row' ? 'row' : 'column',
        style: flexStyle(ctx.props),
        emptyLabel: `「${ctx.props.label}」の中身をここにドロップ`,
      }),
    describe: (p) => `タブ「${p.label}」の中身（${describeFlex(p)}）`,
  },
  {
    type: 'header',
    label: 'ヘッダー / アプリバー',
    category: CAT,
    icon: '▔',
    description: 'ロゴとタイトル。右側に要素を置ける',
    container: true,
    fields: [
      { key: 'title', label: 'タイトル', kind: 'text' },
      { key: 'logo', label: 'ロゴを表示', kind: 'boolean' },
      { key: 'gap', label: '間隔 (px)', kind: 'number', min: 0, max: 64 },
    ],
    defaultProps: { title: 'アプリ名', logo: true, gap: 8 },
    defaultLayout: { width: 'fill' },
    render: (ctx) => (
      <div className="wf-header">
        {ctx.props.logo && <span className="wf-logo">LOGO</span>}
        <span className="wf-header-title">{String(ctx.props.title)}</span>
        {ctx.renderChildren({
          direction: 'row',
          style: { gap: Number(ctx.props.gap), justifyContent: 'flex-end', alignItems: 'center', flex: 1, padding: 2 },
          emptyLabel: '右側の要素',
        })}
      </div>
    ),
    describe: (p) => `ヘッダー（タイトル「${p.title}」${p.logo ? ', ロゴあり' : ''}。右寄せで子要素を配置）`,
  },
  {
    type: 'sidebar',
    label: 'サイドバー',
    category: CAT,
    icon: '▌',
    description: '画面端の縦長エリア',
    container: true,
    fields: [{ key: 'title', label: '見出し', kind: 'text' }, { key: 'collapsible', label: '折りたたみ可能', kind: 'boolean' }, ...containerFields],
    defaultProps: { ...containerDefaults, title: '', collapsible: false },
    defaultLayout: { width: '240', height: 'fill' },
    render: (ctx) => (
      <div className="wf-sidebar">
        {(ctx.props.title || ctx.props.collapsible) && (
          <div className="wf-sidebar-head">
            <span>{String(ctx.props.title)}</span>
            {ctx.props.collapsible && <span className="wf-muted">«</span>}
          </div>
        )}
        {ctx.renderChildren({ direction: ctx.props.direction === 'row' ? 'row' : 'column', style: { ...flexStyle(ctx.props), flex: 1 } })}
      </div>
    ),
    describe: (p) => `サイドバー${p.title ? `「${p.title}」` : ''}（${describeFlex(p)}${p.collapsible ? ', 折りたたみ可能' : ''}）`,
  },
  {
    type: 'navMenu',
    label: 'ナビメニュー',
    category: CAT,
    icon: '☰',
    description: 'メニュー項目のリスト。各項目に遷移先を設定できる',
    container: true,
    allowedChildren: ['navItem'],
    fields: [{ key: 'direction', label: '向き', kind: 'select', options: opt(['column', '縦'], ['row', '横']) }],
    defaultProps: { direction: 'column' },
    defaultChildren: () => [
      { type: 'navItem', props: { label: 'ダッシュボード', active: false } },
      { type: 'navItem', props: { label: 'エージェント', active: false } },
      { type: 'navItem', props: { label: '設定', active: false } },
    ],
    render: (ctx) =>
      ctx.renderChildren({
        direction: ctx.props.direction === 'row' ? 'row' : 'column',
        style: { gap: 2, padding: 2 },
      }),
    describe: (p, n) => `ナビメニュー（${p.direction === 'row' ? '横' : '縦'}, ${(n.children ?? []).length}項目）`,
  },
  {
    type: 'navItem',
    label: 'メニュー項目',
    category: CAT,
    icon: '›',
    hidden: true,
    fields: [
      { key: 'label', label: 'ラベル', kind: 'text' },
      { key: 'icon', label: 'アイコンを表示', kind: 'boolean' },
      { key: 'active', label: '常に選択中にする（遷移先の画面では自動で選択中になる）', kind: 'boolean' },
      { key: 'badge', label: 'バッジ', kind: 'text', placeholder: '例: 3' },
    ],
    defaultProps: { label: '項目', icon: true, active: false, badge: '' },
    render: ({ props, node, screenId }) => (
      // 遷移先が表示中の画面なら、自動で選択中の見た目にする（共通パーツにしても画面ごとに切り替わる）
      <div className={`wf-navitem ${props.active || node.link?.screenId === screenId ? 'active' : ''}`}>
        {props.icon && <span className="wf-icon-box" />}
        <span style={{ flex: 1 }}>{String(props.label)}</span>
        {props.badge && <span className="wf-badge">{String(props.badge)}</span>}
      </div>
    ),
    describe: (p, n) =>
      `メニュー項目「${p.label}」${p.active ? '（常に選択中）' : n.link ? '（遷移先の画面を表示中は選択中の見た目）' : ''}${p.badge ? `［バッジ: ${p.badge}］` : ''}`,
  },
  {
    type: 'divider',
    label: '区切り線',
    category: CAT,
    icon: '─',
    fields: [{ key: 'label', label: 'ラベル', kind: 'text' }],
    defaultProps: { label: '' },
    render: ({ props }) => (
      <div className="wf-divider">{props.label ? <span>{String(props.label)}</span> : null}</div>
    ),
    describe: (p) => `区切り線${p.label ? `「${p.label}」` : ''}`,
  },
  {
    type: 'spacer',
    label: 'スペーサー',
    category: CAT,
    icon: '↔',
    description: '残りの余白を埋める（右寄せなどに使う）',
    fields: [],
    defaultProps: {},
    defaultLayout: { width: 'fill' },
    render: ({ mode }) => <div className={mode === 'edit' ? 'wf-spacer' : ''} />,
    describe: () => 'スペーサー（余白を埋める）',
  },
];
