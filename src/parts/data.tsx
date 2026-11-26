import type { PartDef } from './types';
import { list, opt, rng } from './common';
import { ChartView } from './Chart';

const CAT = 'データ表示';

const CHART_LABEL: Record<string, string> = {
  line: '折れ線',
  bar: '棒',
  area: '面',
  scatter: '散布図',
  pie: '円',
  donut: 'ドーナツ',
};

export const dataParts: PartDef[] = [
  {
    type: 'chart',
    label: 'グラフ',
    category: CAT,
    icon: '📈',
    description: 'サンプルデータで表示。種類・系列・サイズを変更できる',
    fields: [
      { key: 'title', label: 'タイトル', kind: 'text' },
      {
        key: 'chartType',
        label: 'グラフの種類',
        kind: 'select',
        options: Object.entries(CHART_LABEL).map(([value, label]) => ({ value, label })),
      },
      { key: 'series', label: '系列名', kind: 'list', hint: '1行1系列' },
      { key: 'points', label: 'データ点数', kind: 'number', min: 2, max: 50 },
      { key: 'xLabel', label: 'X軸の意味', kind: 'text', placeholder: '例: 時刻' },
      { key: 'yLabel', label: 'Y軸の意味', kind: 'text', placeholder: '例: トークン数' },
      { key: 'legend', label: '凡例を表示', kind: 'boolean' },
      { key: 'seed', label: 'サンプルの形（乱数シード）', kind: 'number', min: 1, max: 9999 },
    ],
    defaultProps: { title: 'グラフ', chartType: 'line', series: ['系列A', '系列B'], points: 12, xLabel: '時刻', yLabel: '値', legend: true, seed: 7 },
    defaultLayout: { height: '260' },
    render: ({ props }) => <ChartView p={props} />,
    describe: (p) => {
      const kind = CHART_LABEL[String(p.chartType)] ?? p.chartType;
      const legend = p.legend ? ' / 凡例あり' : '';
      if (p.chartType === 'pie' || p.chartType === 'donut') return `グラフ（${kind}）「${p.title}」 構成比を表示${legend}`;
      return `グラフ（${kind}）「${p.title}」 系列: ${list(p.series).join(', ')} / X軸: ${p.xLabel || '-'} / Y軸: ${p.yLabel || '-'}${legend}`;
    },
  },
  {
    type: 'table',
    label: 'テーブル',
    category: CAT,
    icon: '▦',
    fields: [
      { key: 'columns', label: '列名', kind: 'list' },
      { key: 'rows', label: '表示行数', kind: 'number', min: 1, max: 30 },
      { key: 'selectable', label: '行選択チェック', kind: 'boolean' },
      { key: 'rowActions', label: '行アクション', kind: 'list', hint: '例: 詳細, 削除' },
      { key: 'search', label: '検索ボックス', kind: 'boolean' },
      { key: 'pagination', label: 'ページネーション', kind: 'boolean' },
    ],
    defaultProps: { columns: ['名前', 'ステータス', '更新日時'], rows: 5, selectable: false, rowActions: [], search: false, pagination: true },
    render: ({ props }) => {
      const cols = list(props.columns);
      const acts = list(props.rowActions);
      const r = rng(cols.length * 31 + Number(props.rows));
      return (
        <div className="wf-table-wrap">
          {props.search && <div className="wf-input search" style={{ maxWidth: 240, marginBottom: 6 }}>検索</div>}
          <table className="wf-table">
            <thead>
              <tr>
                {props.selectable && <th style={{ width: 24 }}><span className="wf-check" /></th>}
                {cols.map((c, i) => <th key={i}>{c}</th>)}
                {acts.length > 0 && <th />}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Number(props.rows) || 1 }, (_, ri) => (
                <tr key={ri}>
                  {props.selectable && <td><span className="wf-check" /></td>}
                  {cols.map((_, ci) => (
                    <td key={ci}>
                      <span className="wf-line" style={{ width: `${40 + r() * 50}%` }} />
                    </td>
                  ))}
                  {acts.length > 0 && (
                    <td className="wf-row-actions">
                      {acts.map((a, i) => <span key={i} className="wf-link">{a}</span>)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {props.pagination && <div className="wf-pager">‹ 1 2 3 … ›</div>}
        </div>
      );
    },
    describe: (p) =>
      `テーブル 列: ${list(p.columns).join(' | ')}（${p.rows}行表示${p.selectable ? ', 行選択' : ''}${list(p.rowActions).length ? `, 行アクション: ${list(p.rowActions).join('/')}` : ''}${p.search ? ', 検索' : ''}${p.pagination ? ', ページネーション' : ''}）`,
  },
  {
    type: 'kpi',
    label: 'KPIタイル',
    category: CAT,
    icon: '#',
    fields: [
      { key: 'label', label: '指標名', kind: 'text' },
      { key: 'value', label: '値（例）', kind: 'text' },
      { key: 'delta', label: '増減（例）', kind: 'text' },
      { key: 'sparkline', label: 'ミニグラフ', kind: 'boolean' },
    ],
    defaultProps: { label: '指標', value: '1,234', delta: '+12%', sparkline: false },
    render: ({ props }) => (
      <div className="wf-kpi">
        <div className="wf-kpi-label">{String(props.label)}</div>
        <div className="wf-kpi-value">{String(props.value)}</div>
        {props.delta && <div className="wf-kpi-delta">{String(props.delta)}</div>}
        {props.sparkline && (
          <svg viewBox="0 0 100 20" className="wf-spark" preserveAspectRatio="none">
            <polyline points="0,15 15,12 30,14 45,8 60,10 75,5 100,7" fill="none" style={{ stroke: 'var(--muted)' }} strokeWidth={1.5} />
          </svg>
        )}
      </div>
    ),
    describe: (p) => `KPIタイル「${p.label}」値例 ${p.value}${p.delta ? `（${p.delta}）` : ''}${p.sparkline ? ' ミニグラフ付き' : ''}`,
  },
  {
    type: 'list',
    label: 'リスト',
    category: CAT,
    icon: '≡',
    fields: [
      { key: 'items', label: '項目', kind: 'list' },
      { key: 'avatar', label: '先頭アイコン', kind: 'boolean' },
      { key: 'secondary', label: '2行目（補足）', kind: 'boolean' },
      { key: 'trailing', label: '右端の要素', kind: 'select', options: opt(['none', 'なし'], ['badge', 'バッジ'], ['button', 'ボタン'], ['chevron', '›']) },
    ],
    defaultProps: { items: ['項目1', '項目2', '項目3'], avatar: true, secondary: true, trailing: 'chevron' },
    render: ({ props }) => (
      <div className="wf-list">
        {list(props.items).map((it, i) => (
          <div key={i} className="wf-list-item">
            {props.avatar && <span className="wf-avatar sm">{it.slice(0, 1)}</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>{it}</div>
              {props.secondary && <span className="wf-line" style={{ width: '50%' }} />}
            </div>
            {props.trailing === 'badge' && <span className="wf-badge">状態</span>}
            {props.trailing === 'button' && <span className="wf-btn secondary sm">操作</span>}
            {props.trailing === 'chevron' && <span className="wf-muted">›</span>}
          </div>
        ))}
      </div>
    ),
    describe: (p) => `リスト 項目: ${list(p.items).join(', ')}${p.avatar ? '（アイコン付き）' : ''}${p.secondary ? '（補足行あり）' : ''}${p.trailing !== 'none' ? ` 右端: ${p.trailing}` : ''}`,
  },
  {
    type: 'keyValue',
    label: 'キー・値リスト',
    category: CAT,
    icon: ':',
    fields: [{ key: 'items', label: '項目（キー: 値）', kind: 'list', hint: '例: モデル: claude-opus' }],
    defaultProps: { items: ['ID: agent-001', 'モデル: LLM-A', '作成日: 2026-01-01'] },
    render: ({ props }) => (
      <dl className="wf-kv">
        {list(props.items).map((it, i) => {
          const [k, ...v] = it.split(':');
          return (
            <div key={i}>
              <dt>{k}</dt>
              <dd>{v.join(':').trim()}</dd>
            </div>
          );
        })}
      </dl>
    ),
    describe: (p) => `キー・値リスト: ${list(p.items).join(' / ')}`,
  },
  {
    type: 'progress',
    label: '進捗バー',
    category: CAT,
    icon: '▰',
    fields: [
      { key: 'label', label: 'ラベル', kind: 'text' },
      { key: 'value', label: '値 (%)', kind: 'number', min: 0, max: 100 },
      { key: 'style', label: '見た目', kind: 'select', options: opt(['bar', 'バー'], ['steps', 'ステップ']) },
      { key: 'steps', label: 'ステップ名', kind: 'list' },
    ],
    defaultProps: { label: '進捗', value: 60, style: 'bar', steps: ['計画', '実行', '検証', '完了'] },
    render: ({ props }) =>
      props.style === 'steps' ? (
        <div className="wf-steps">
          {list(props.steps).map((s, i, a) => (
            <span key={i} className={(i + 1) / a.length <= Number(props.value) / 100 ? 'done' : ''}>
              <i>{i + 1}</i>
              {s}
            </span>
          ))}
        </div>
      ) : (
        <div className="wf-progress">
          <div className="wf-progress-head">
            <span>{String(props.label)}</span>
            <span>{Number(props.value)}%</span>
          </div>
          <div className="wf-progress-track">
            <div style={{ width: `${Number(props.value)}%` }} />
          </div>
        </div>
      ),
    describe: (p) =>
      p.style === 'steps' ? `ステップ表示: ${list(p.steps).join(' → ')}` : `進捗バー「${p.label}」（例 ${p.value}%）`,
  },
  {
    type: 'logViewer',
    label: 'ログビューア',
    category: CAT,
    icon: '⌸',
    fields: [
      { key: 'title', label: 'タイトル', kind: 'text' },
      { key: 'lines', label: 'サンプル行', kind: 'list' },
      { key: 'filter', label: 'レベルフィルタ', kind: 'boolean' },
      { key: 'follow', label: '自動スクロール', kind: 'boolean' },
    ],
    defaultProps: {
      title: 'ログ',
      lines: ['[INFO] 起動しました', '[INFO] タスクを受信', '[WARN] レート制限に近づいています', '[ERROR] ツール呼び出し失敗'],
      filter: true,
      follow: true,
    },
    defaultLayout: { height: '200' },
    render: ({ props }) => (
      <div className="wf-log">
        <div className="wf-log-head">
          <span>{String(props.title)}</span>
          <span className="wf-muted">
            {props.filter && 'ALL ▾ '}
            {props.follow && '⤓追従'}
          </span>
        </div>
        <pre>{list(props.lines).join('\n')}</pre>
      </div>
    ),
    describe: (p) => `ログビューア「${p.title}」（等幅表示${p.filter ? ', レベルフィルタ' : ''}${p.follow ? ', 末尾に自動追従' : ''}）`,
  },
];
