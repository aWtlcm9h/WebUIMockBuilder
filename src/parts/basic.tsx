import type { PartDef } from './types';
import { list, opt } from './common';

const CAT = '基本';

export const basicParts: PartDef[] = [
  {
    type: 'heading',
    label: '見出し',
    category: CAT,
    icon: 'H',
    fields: [
      { key: 'text', label: 'テキスト', kind: 'text' },
      { key: 'level', label: 'レベル', kind: 'select', options: opt(['1', 'H1'], ['2', 'H2'], ['3', 'H3']) },
    ],
    defaultProps: { text: '見出し', level: '2' },
    render: ({ props }) => <div className={`wf-h wf-h${props.level}`}>{String(props.text)}</div>,
    describe: (p) => `見出しH${p.level}「${p.text}」`,
  },
  {
    type: 'text',
    label: 'テキスト',
    category: CAT,
    icon: 'T',
    fields: [
      { key: 'text', label: 'テキスト', kind: 'textarea', rows: 3 },
      { key: 'tone', label: '種類', kind: 'select', options: opt(['body', '本文'], ['muted', '補足（薄い）'], ['code', 'コード']) },
      { key: 'dummyLines', label: 'ダミー行（0で非表示）', kind: 'number', min: 0, max: 10 },
    ],
    defaultProps: { text: 'テキスト', tone: 'body', dummyLines: 0 },
    render: ({ props }) => (
      <div className={`wf-text tone-${props.tone}`}>
        {props.text && <div style={{ whiteSpace: 'pre-wrap' }}>{String(props.text)}</div>}
        {Array.from({ length: Number(props.dummyLines) || 0 }, (_, i) => (
          <div key={i} className="wf-line" style={{ width: i === Number(props.dummyLines) - 1 ? '60%' : '100%' }} />
        ))}
      </div>
    ),
    describe: (p) =>
      `テキスト（${p.tone}）「${String(p.text).replace(/\n/g, ' ')}」${Number(p.dummyLines) ? ` + ダミー${p.dummyLines}行` : ''}`,
  },
  {
    type: 'button',
    label: 'ボタン',
    category: CAT,
    icon: '⏺',
    description: '遷移先を設定するとプレビューで画面遷移する',
    fields: [
      { key: 'label', label: 'ラベル', kind: 'text' },
      {
        key: 'variant',
        label: '種類',
        kind: 'select',
        options: opt(['primary', 'プライマリ'], ['secondary', 'セカンダリ'], ['ghost', 'テキスト'], ['danger', '危険操作']),
      },
      { key: 'size', label: 'サイズ', kind: 'select', options: opt(['sm', '小'], ['md', '中'], ['lg', '大']) },
      { key: 'icon', label: 'アイコン付き', kind: 'boolean' },
      { key: 'disabled', label: '無効状態', kind: 'boolean' },
    ],
    defaultProps: { label: 'ボタン', variant: 'primary', size: 'md', icon: false, disabled: false },
    render: ({ props }) => (
      <button className={`wf-btn ${props.variant} ${props.size}`} disabled={!!props.disabled} tabIndex={-1}>
        {props.icon && <span className="wf-icon-box sm" />}
        {String(props.label)}
      </button>
    ),
    describe: (p) => `ボタン「${p.label}」（${p.variant}, ${p.size}${p.icon ? ', アイコン付き' : ''}${p.disabled ? ', 無効' : ''}）`,
  },
  {
    type: 'link',
    label: 'リンク',
    category: CAT,
    icon: '🔗',
    fields: [{ key: 'text', label: 'テキスト', kind: 'text' }],
    defaultProps: { text: 'リンク' },
    render: ({ props }) => <span className="wf-link">{String(props.text)}</span>,
    describe: (p) => `リンク「${p.text}」`,
  },
  {
    type: 'input',
    label: 'テキスト入力',
    category: CAT,
    icon: '⌨',
    fields: [
      { key: 'label', label: 'ラベル', kind: 'text' },
      { key: 'placeholder', label: 'プレースホルダー', kind: 'text' },
      { key: 'inputType', label: '入力種別', kind: 'select', options: opt(['text', 'テキスト'], ['search', '検索'], ['password', 'パスワード'], ['number', '数値'], ['email', 'メール']) },
      { key: 'required', label: '必須', kind: 'boolean' },
    ],
    defaultProps: { label: 'ラベル', placeholder: '入力してください', inputType: 'text', required: false },
    render: ({ props }) => (
      <label className="wf-field">
        {props.label && (
          <span className="wf-field-label">
            {String(props.label)}
            {props.required && <b className="wf-req">*</b>}
          </span>
        )}
        <span className={`wf-input ${props.inputType === 'search' ? 'search' : ''}`}>
          {props.inputType === 'password' ? '••••••' : String(props.placeholder)}
        </span>
      </label>
    ),
    describe: (p) => `入力欄（${p.inputType}）${p.label ? `ラベル「${p.label}」` : ''}placeholder「${p.placeholder}」${p.required ? ' 必須' : ''}`,
  },
  {
    type: 'textarea',
    label: '複数行入力',
    category: CAT,
    icon: '¶',
    fields: [
      { key: 'label', label: 'ラベル', kind: 'text' },
      { key: 'placeholder', label: 'プレースホルダー', kind: 'text' },
      { key: 'rows', label: '行数', kind: 'number', min: 2, max: 20 },
    ],
    defaultProps: { label: 'ラベル', placeholder: '入力してください', rows: 4 },
    render: ({ props }) => (
      <label className="wf-field">
        {props.label && <span className="wf-field-label">{String(props.label)}</span>}
        <span className="wf-input area" style={{ minHeight: Number(props.rows) * 20 }}>
          {String(props.placeholder)}
        </span>
      </label>
    ),
    describe: (p) => `複数行入力（${p.rows}行）ラベル「${p.label}」`,
  },
  {
    type: 'select',
    label: 'セレクト',
    category: CAT,
    icon: '▾',
    fields: [
      { key: 'label', label: 'ラベル', kind: 'text' },
      { key: 'options', label: '選択肢', kind: 'list' },
      { key: 'multiple', label: '複数選択', kind: 'boolean' },
    ],
    defaultProps: { label: 'ラベル', options: ['選択肢A', '選択肢B', '選択肢C'], multiple: false },
    render: ({ props }) => (
      <label className="wf-field">
        {props.label && <span className="wf-field-label">{String(props.label)}</span>}
        <span className="wf-input select">{list(props.options)[0] ?? '選択'}</span>
      </label>
    ),
    describe: (p) => `セレクト${p.multiple ? '（複数選択）' : ''}ラベル「${p.label}」選択肢: ${list(p.options).join(' / ')}`,
  },
  {
    type: 'toggle',
    label: 'チェック / トグル',
    category: CAT,
    icon: '☑',
    fields: [
      { key: 'label', label: 'ラベル', kind: 'text' },
      { key: 'style', label: '見た目', kind: 'select', options: opt(['checkbox', 'チェックボックス'], ['switch', 'スイッチ']) },
      { key: 'checked', label: 'ON', kind: 'boolean' },
    ],
    defaultProps: { label: '有効にする', style: 'switch', checked: true },
    render: ({ props }) => (
      <span className="wf-toggle">
        <span className={`${props.style === 'switch' ? 'wf-switch' : 'wf-check'} ${props.checked ? 'on' : ''}`} />
        {String(props.label)}
      </span>
    ),
    describe: (p) => `${p.style === 'switch' ? 'スイッチ' : 'チェックボックス'}「${p.label}」（初期: ${p.checked ? 'ON' : 'OFF'}）`,
  },
  {
    type: 'radio',
    label: 'ラジオ / セグメント',
    category: CAT,
    icon: '◉',
    fields: [
      { key: 'label', label: 'ラベル', kind: 'text' },
      { key: 'options', label: '選択肢', kind: 'list' },
      { key: 'style', label: '見た目', kind: 'select', options: opt(['radio', 'ラジオ'], ['segment', 'セグメント']) },
    ],
    defaultProps: { label: '', options: ['オプション1', 'オプション2'], style: 'segment' },
    render: ({ props }) => (
      <div className="wf-field">
        {props.label && <span className="wf-field-label">{String(props.label)}</span>}
        <div className={props.style === 'segment' ? 'wf-segment' : 'wf-radios'}>
          {list(props.options).map((o, i) => (
            <span key={i} className={i === 0 ? 'on' : ''}>
              {props.style === 'radio' && <span className={`wf-radio ${i === 0 ? 'on' : ''}`} />}
              {o}
            </span>
          ))}
        </div>
      </div>
    ),
    describe: (p) => `${p.style === 'segment' ? 'セグメント' : 'ラジオ'}${p.label ? `「${p.label}」` : ''}: ${list(p.options).join(' / ')}`,
  },
  {
    type: 'badge',
    label: 'バッジ / タグ',
    category: CAT,
    icon: '●',
    fields: [
      { key: 'text', label: 'テキスト', kind: 'text' },
      { key: 'tone', label: '色', kind: 'select', options: opt(['neutral', '標準'], ['success', '成功'], ['warning', '警告'], ['danger', 'エラー'], ['info', '情報']) },
    ],
    defaultProps: { text: 'ステータス', tone: 'neutral' },
    render: ({ props }) => <span className={`wf-badge tone-${props.tone}`}>{String(props.text)}</span>,
    describe: (p) => `バッジ「${p.text}」（${p.tone}）`,
  },
  {
    type: 'icon',
    label: 'アイコン',
    category: CAT,
    icon: '◇',
    fields: [
      { key: 'name', label: '意味（例: 設定, 通知）', kind: 'text' },
      { key: 'size', label: 'サイズ (px)', kind: 'number', min: 12, max: 64 },
    ],
    defaultProps: { name: '設定', size: 20 },
    render: ({ props }) => (
      <span className="wf-icon" style={{ width: Number(props.size), height: Number(props.size) }} title={String(props.name)}>
        {String(props.name).slice(0, 1)}
      </span>
    ),
    describe: (p) => `アイコン（${p.name}）`,
  },
  {
    type: 'image',
    label: '画像',
    category: CAT,
    icon: '🖼',
    fields: [{ key: 'alt', label: '内容の説明', kind: 'text' }],
    defaultProps: { alt: '画像' },
    defaultLayout: { height: '160' },
    render: ({ props }) => (
      <div className="wf-image">
        <span>{String(props.alt)}</span>
      </div>
    ),
    describe: (p) => `画像プレースホルダー（${p.alt}）`,
  },
  {
    type: 'avatar',
    label: 'アバター',
    category: CAT,
    icon: '◯',
    fields: [
      { key: 'name', label: '名前', kind: 'text' },
      { key: 'showName', label: '名前を表示', kind: 'boolean' },
    ],
    defaultProps: { name: 'User', showName: true },
    render: ({ props }) => (
      <span className="wf-avatar-wrap">
        <span className="wf-avatar">{String(props.name).slice(0, 1)}</span>
        {props.showName && <span>{String(props.name)}</span>}
      </span>
    ),
    describe: (p) => `アバター（${p.name}）`,
  },
];
