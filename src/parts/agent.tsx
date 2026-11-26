import type { PartDef } from './types';
import { list, opt } from './common';

const CAT = 'LLMエージェント';

const STATUS = opt(['idle', '待機'], ['running', '実行中'], ['waiting', '承認待ち'], ['error', 'エラー'], ['done', '完了']);
const statusLabel = (s: unknown) => STATUS.find((o) => o.value === s)?.label ?? String(s);

export const agentParts: PartDef[] = [
  {
    type: 'chatView',
    label: 'チャット / 会話ログ',
    category: CAT,
    icon: '💬',
    description: 'ユーザーと複数エージェントの発言',
    fields: [
      { key: 'speakers', label: '発言者（順番に表示）', kind: 'list', hint: 'user と書くとユーザー側（右寄せ）' },
      { key: 'showToolCalls', label: 'ツール呼び出しを挟む', kind: 'boolean' },
      { key: 'showModel', label: 'モデル名を表示', kind: 'boolean' },
      { key: 'streaming', label: '末尾をストリーミング中にする', kind: 'boolean' },
    ],
    defaultProps: { speakers: ['user', 'Planner', 'Coder', 'user', 'Reviewer'], showToolCalls: true, showModel: true, streaming: true },
    defaultLayout: { height: '360' },
    render: ({ props }) => {
      const sp = list(props.speakers);
      return (
        <div className="wf-chat">
          {sp.map((s, i) => {
            const isUser = s.toLowerCase() === 'user';
            return (
              <div key={i}>
                {props.showToolCalls && !isUser && i === 2 && <div className="wf-toolcall">⚙ tool: search_code(...) ✓</div>}
                <div className={`wf-msg ${isUser ? 'user' : ''}`}>
                  {!isUser && (
                    <div className="wf-msg-who">
                      <span className="wf-avatar sm">{s.slice(0, 1)}</span>
                      {s}
                      {props.showModel && <span className="wf-chip">model</span>}
                    </div>
                  )}
                  <div className="wf-bubble">
                    <span className="wf-line" style={{ width: '90%' }} />
                    <span className="wf-line" style={{ width: i % 2 ? '50%' : '70%' }} />
                    {props.streaming && i === sp.length - 1 && <span className="wf-cursor">▍</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    },
    describe: (p) =>
      `会話ログ 発言者: ${list(p.speakers).join(' → ')}（userは右寄せ吹き出し、エージェントは名前とアバター付き左寄せ${p.showModel ? '、モデル名表示' : ''}${p.showToolCalls ? '、途中にツール呼び出し行を表示' : ''}${p.streaming ? '、末尾はストリーミング表示' : ''}）`,
  },
  {
    type: 'chatInput',
    label: 'チャット入力欄',
    category: CAT,
    icon: '✎',
    fields: [
      { key: 'placeholder', label: 'プレースホルダー', kind: 'text' },
      { key: 'attach', label: '添付ボタン', kind: 'boolean' },
      { key: 'agentSelect', label: '宛先エージェント選択', kind: 'boolean' },
      { key: 'modelSelect', label: 'モデル選択', kind: 'boolean' },
      { key: 'stop', label: '停止ボタン', kind: 'boolean' },
    ],
    defaultProps: { placeholder: 'エージェントに指示を入力…', attach: true, agentSelect: true, modelSelect: false, stop: true },
    render: ({ props }) => (
      <div className="wf-chatinput">
        <div className="wf-chatinput-text">{String(props.placeholder)}</div>
        <div className="wf-chatinput-bar">
          {props.attach && <span className="wf-chip">📎</span>}
          {props.agentSelect && <span className="wf-chip">宛先: 全員 ▾</span>}
          {props.modelSelect && <span className="wf-chip">モデル ▾</span>}
          <span style={{ flex: 1 }} />
          {props.stop && <span className="wf-btn secondary sm">■ 停止</span>}
          <span className="wf-btn primary sm">送信</span>
        </div>
      </div>
    ),
    describe: (p) =>
      `チャット入力欄（${[p.attach && '添付', p.agentSelect && '宛先エージェント選択', p.modelSelect && 'モデル選択', p.stop && '停止ボタン'].filter(Boolean).join(', ')}、送信ボタン）`,
  },
  {
    type: 'agentCard',
    label: 'エージェントカード',
    category: CAT,
    icon: '🤖',
    fields: [
      { key: 'name', label: '名前', kind: 'text' },
      { key: 'role', label: '役割', kind: 'text' },
      { key: 'model', label: 'モデル', kind: 'text' },
      { key: 'status', label: '状態', kind: 'select', options: STATUS },
      { key: 'metrics', label: '指標を表示（トークン/コスト）', kind: 'boolean' },
      { key: 'actions', label: 'アクション', kind: 'list' },
    ],
    defaultProps: { name: 'Planner', role: 'タスク分解', model: 'LLM-A', status: 'running', metrics: true, actions: ['停止', 'ログ'] },
    render: ({ props }) => (
      <div className="wf-agent">
        <div className="wf-agent-head">
          <span className="wf-avatar">{String(props.name).slice(0, 1)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="wf-agent-name">{String(props.name)}</div>
            <div className="wf-muted">{String(props.role)}</div>
          </div>
          <span className={`wf-status s-${props.status}`}>{statusLabel(props.status)}</span>
        </div>
        <div className="wf-agent-meta">
          <span className="wf-chip">{String(props.model)}</span>
          {props.metrics && <span className="wf-muted">12.3k tok · $0.04</span>}
        </div>
        {list(props.actions).length > 0 && (
          <div className="wf-agent-actions">
            {list(props.actions).map((a, i) => (
              <span key={i} className="wf-btn ghost sm">
                {a}
              </span>
            ))}
          </div>
        )}
      </div>
    ),
    describe: (p) =>
      `エージェントカード「${p.name}」役割: ${p.role} / モデル: ${p.model} / 状態: ${statusLabel(p.status)}${p.metrics ? ' / トークン・コスト表示' : ''}${list(p.actions).length ? ` / アクション: ${list(p.actions).join(', ')}` : ''}`,
  },
  {
    type: 'taskBoard',
    label: 'タスクボード (カンバン)',
    category: CAT,
    icon: '▥',
    fields: [
      { key: 'columns', label: '列', kind: 'list' },
      { key: 'cards', label: '1列あたりのカード数', kind: 'number', min: 0, max: 8 },
      { key: 'assignee', label: '担当エージェント表示', kind: 'boolean' },
    ],
    defaultProps: { columns: ['未着手', '実行中', 'レビュー', '完了'], cards: 2, assignee: true },
    defaultLayout: { height: '280' },
    render: ({ props }) => (
      <div className="wf-board">
        {list(props.columns).map((c, ci) => (
          <div key={ci} className="wf-board-col">
            <div className="wf-board-head">
              {c} <span className="wf-muted">{props.cards}</span>
            </div>
            {Array.from({ length: Number(props.cards) || 0 }, (_, i) => (
              <div key={i} className="wf-board-card">
                <span className="wf-line" style={{ width: '80%' }} />
                {props.assignee && (
                  <span className="wf-avatar-wrap">
                    <span className="wf-avatar xs">A</span>
                    <span className="wf-muted">agent</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    ),
    describe: (p) => `カンバン 列: ${list(p.columns).join(' → ')}（カードはドラッグで列移動${p.assignee ? '、担当エージェント表示' : ''}）`,
  },
  {
    type: 'timeline',
    label: '実行タイムライン',
    category: CAT,
    icon: '⋮',
    description: 'エージェントのステップ・ツール呼び出し履歴',
    fields: [
      { key: 'steps', label: 'ステップ（エージェント: 内容）', kind: 'list' },
      { key: 'timestamps', label: '時刻を表示', kind: 'boolean' },
      { key: 'expandable', label: '詳細を展開できる', kind: 'boolean' },
    ],
    defaultProps: {
      steps: ['Planner: タスクを3つに分解', 'Coder: tool read_file', 'Coder: tool write_file', 'Reviewer: 差分をレビュー'],
      timestamps: true,
      expandable: true,
    },
    render: ({ props }) => (
      <div className="wf-timeline">
        {list(props.steps).map((s, i) => {
          const [who, ...rest] = s.split(':');
          return (
            <div key={i} className="wf-tl-item">
              <span className="wf-tl-dot" />
              <div style={{ flex: 1 }}>
                <b>{who}</b> {rest.join(':')}
                {props.expandable && <span className="wf-muted"> ▸</span>}
              </div>
              {props.timestamps && <span className="wf-muted">12:0{i}</span>}
            </div>
          );
        })}
      </div>
    ),
    describe: (p) =>
      `実行タイムライン（縦に時系列${p.timestamps ? '、時刻付き' : ''}${p.expandable ? '、各ステップ展開で詳細（入出力）表示' : ''}）例: ${list(p.steps).join(' / ')}`,
  },
  {
    type: 'streamOutput',
    label: '思考ログ / ストリーム出力',
    category: CAT,
    icon: '≋',
    fields: [
      { key: 'title', label: 'タイトル', kind: 'text' },
      { key: 'collapsible', label: '折りたたみ可能', kind: 'boolean' },
      { key: 'lines', label: '行数', kind: 'number', min: 1, max: 20 },
    ],
    defaultProps: { title: '思考中…', collapsible: true, lines: 4 },
    render: ({ props }) => (
      <div className="wf-stream">
        <div className="wf-stream-head">
          {props.collapsible && '▾ '}
          {String(props.title)}
        </div>
        {Array.from({ length: Number(props.lines) || 1 }, (_, i) => (
          <span key={i} className="wf-line" style={{ width: i === (Number(props.lines) || 1) - 1 ? '40%' : `${70 + ((i * 13) % 30)}%` }} />
        ))}
        <span className="wf-cursor">▍</span>
      </div>
    ),
    describe: (p) => `ストリーム出力「${p.title}」（逐次表示${p.collapsible ? '、折りたたみ可能' : ''}）`,
  },
  {
    type: 'workflowGraph',
    label: 'ワークフロー図',
    category: CAT,
    icon: '⇄',
    description: 'エージェント間の連携フロー（ノードとエッジ）',
    fields: [
      { key: 'nodes', label: 'ノード', kind: 'list' },
      { key: 'edges', label: 'エッジ（A>B）', kind: 'list', hint: '例: Planner>Coder' },
      { key: 'editable', label: 'ノード編集可能（ドラッグで接続）', kind: 'boolean' },
      { key: 'activeNode', label: '実行中ノード名', kind: 'text' },
    ],
    defaultProps: {
      nodes: ['Input', 'Planner', 'Coder', 'Reviewer', 'Output'],
      edges: ['Input>Planner', 'Planner>Coder', 'Coder>Reviewer', 'Reviewer>Coder', 'Reviewer>Output'],
      editable: false,
      activeNode: 'Coder',
    },
    defaultLayout: { height: '220' },
    render: ({ props, node }) => {
      const markerId = `arr-${node.id}`;
      const nodes = list(props.nodes);
      const W = 600;
      const H = 160;
      const pos = (i: number) => ({ x: 50 + (i * (W - 100)) / Math.max(1, nodes.length - 1), y: H / 2 + (i % 2 ? -30 : 30) });
      const idx = (n: string) => nodes.indexOf(n.trim());
      return (
        <div className="wf-graph">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
            <defs>
              <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'var(--muted)' }} />
              </marker>
            </defs>
            {list(props.edges).map((e, i) => {
              const [a, b] = e.split('>');
              const ia = idx(a ?? '');
              const ib = idx(b ?? '');
              if (ia < 0 || ib < 0) return null;
              const pa = pos(ia);
              const pb = pos(ib);
              const back = ib < ia;
              const mx = (pa.x + pb.x) / 2;
              const my = (pa.y + pb.y) / 2 + (back ? 45 : 0);
              return (
                <path
                  key={i}
                  d={`M${pa.x},${pa.y} Q${mx},${my} ${pb.x},${pb.y}`}
                  fill="none"
                  style={{ stroke: 'var(--muted)' }}
                  strokeDasharray={back ? '4 3' : ''}
                  markerEnd={`url(#${markerId})`}
                />
              );
            })}
            {nodes.map((n, i) => {
              const p = pos(i);
              const active = n === props.activeNode;
              return (
                <g key={i}>
                  <rect x={p.x - 42} y={p.y - 14} width={84} height={28} rx={6} style={{ fill: active ? 'var(--wf-dark)' : 'var(--wf-surface)', stroke: 'var(--wf-dark)' }} />
                  <text x={p.x} y={p.y + 4} fontSize={11} textAnchor="middle" style={{ fill: active ? 'var(--wf-on-dark)' : 'var(--wf-ink)' }}>
                    {n}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      );
    },
    describe: (p) =>
      `ワークフロー図 ノード: ${list(p.nodes).join(', ')} / エッジ: ${list(p.edges).map((e) => e.replace('>', '→')).join(', ')}${p.activeNode ? ` / 実行中ノード「${p.activeNode}」を強調` : ''}${p.editable ? ' / ノードのドラッグ・接続で編集可能' : ' / 表示のみ'}`,
  },
  {
    type: 'approval',
    label: '承認リクエスト (HITL)',
    category: CAT,
    icon: '✋',
    description: 'エージェントが人間の承認を求めるパネル',
    fields: [
      { key: 'title', label: 'タイトル', kind: 'text' },
      { key: 'agent', label: '要求元エージェント', kind: 'text' },
      { key: 'detail', label: '内容', kind: 'textarea' },
      { key: 'actions', label: 'ボタン', kind: 'list' },
      { key: 'diff', label: '差分/引数プレビュー', kind: 'boolean' },
    ],
    defaultProps: {
      title: 'ツール実行の承認',
      agent: 'Coder',
      detail: 'shell: npm install を実行しようとしています',
      actions: ['承認', '修正して承認', '却下'],
      diff: true,
    },
    render: ({ props }) => (
      <div className="wf-approval">
        <div className="wf-approval-head">
          ✋ {String(props.title)} <span className="wf-chip">{String(props.agent)}</span>
        </div>
        <div>{String(props.detail)}</div>
        {props.diff && <pre className="wf-code">{'+ args: { cmd: "..." }'}</pre>}
        <div className="wf-row-gap">
          {list(props.actions).map((a, i) => (
            <span key={i} className={`wf-btn ${i === 0 ? 'primary' : i === list(props.actions).length - 1 ? 'danger' : 'secondary'} sm`}>
              {a}
            </span>
          ))}
        </div>
      </div>
    ),
    describe: (p) =>
      `承認リクエスト「${p.title}」要求元: ${p.agent} / 内容: ${p.detail}${p.diff ? ' / 引数・差分プレビュー' : ''} / ボタン: ${list(p.actions).join(', ')}`,
  },
  {
    type: 'usageMeter',
    label: 'トークン / コストメーター',
    category: CAT,
    icon: '◔',
    fields: [
      { key: 'label', label: 'ラベル', kind: 'text' },
      { key: 'used', label: '使用量（例）', kind: 'text' },
      { key: 'limit', label: '上限（例）', kind: 'text' },
      { key: 'percent', label: '使用率 (%)', kind: 'number', min: 0, max: 100 },
      { key: 'breakdown', label: 'エージェント別内訳', kind: 'boolean' },
    ],
    defaultProps: { label: 'トークン使用量', used: '182k', limit: '500k', percent: 36, breakdown: true },
    render: ({ props }) => (
      <div className="wf-meter">
        <div className="wf-progress-head">
          <span>{String(props.label)}</span>
          <span>
            {String(props.used)} / {String(props.limit)}
          </span>
        </div>
        <div className="wf-progress-track">
          <div style={{ width: `${Number(props.percent)}%` }} />
        </div>
        {props.breakdown && (
          <div className="wf-meter-break">
            {['Planner', 'Coder', 'Reviewer'].map((a, i) => (
              <span key={a}>
                <i style={{ opacity: 1 - i * 0.3 }} />
                {a}
              </span>
            ))}
          </div>
        )}
      </div>
    ),
    describe: (p) => `使用量メーター「${p.label}」例 ${p.used}/${p.limit}${p.breakdown ? '（エージェント別内訳あり）' : ''}`,
  },
  {
    type: 'modalFrame',
    label: 'ダイアログ枠',
    category: 'レイアウト',
    icon: '⧉',
    description: '画面内に置くダイアログの見た目（別画面のモーダルは画面一覧で作成）',
    container: true,
    fields: [
      { key: 'title', label: 'タイトル', kind: 'text' },
      { key: 'footer', label: 'フッターボタン', kind: 'list' },
    ],
    defaultProps: { title: 'ダイアログ', footer: ['キャンセル', 'OK'] },
    render: (ctx) => (
      <div className="wf-dialog">
        <div className="wf-dialog-head">
          {String(ctx.props.title)}
          <span>×</span>
        </div>
        {ctx.renderChildren({ direction: 'column', style: { gap: 8, padding: 12, flex: 1 } })}
        {list(ctx.props.footer).length > 0 && (
          <div className="wf-dialog-foot">
            {list(ctx.props.footer).map((b, i, a) => (
              <span key={i} className={`wf-btn ${i === a.length - 1 ? 'primary' : 'secondary'} sm`}>
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
    ),
    describe: (p) => `ダイアログ「${p.title}」フッター: ${list(p.footer).join(', ')}`,
  },
];
