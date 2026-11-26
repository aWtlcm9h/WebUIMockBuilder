import { useCurrentScreen, useStore } from '../model/store';
import { findParent, pathTo, walkNodes } from '../model/tree';
import { APPEARANCE_LABEL, COMPONENT_REF, LINK_BACK, VIEWPORT_WIDTH, type Appearance, type Screen, type SharedComponent, type UINode, type Viewport } from '../model/types';
import { componentContaining, countInstances, findNodeAnywhere, findTreeRoot, getComponent, whyNotComponent } from '../model/components';
import { canAccept, getPart } from '../parts/registry';
import { CommentsBox } from './Comments';
import { FieldInput, Row, SizeInput } from './fields';

/** 共通パーツのインスタンスを選択したときの設定 */
function InstanceSection({ node, comp }: { node: UINode; comp: SharedComponent | undefined }) {
  const st = useStore.getState();
  const uses = useStore((s) => (comp ? countInstances(s.project, comp.id) : 0));
  if (!comp) return <div className="panel-section hint">参照先の共通パーツが見つかりません。削除してください。</div>;
  return (
    <div className="panel-section">
      <div className="section-title">共通パーツ</div>
      <div className="notice">
        {uses}か所で使われています。もう一度クリックすると中の要素を選べます。中身の変更は、すべての使用箇所に反映されます。
      </div>
      <Row label="共通パーツ名">
        <input className="f-input" value={comp.name} onChange={(e) => st.renameComponent(comp.id, e.target.value)} />
      </Row>
      <div className="btn-row">
        <button className="btn sm" onClick={() => st.select(comp.root.id)}>
          中身を編集
        </button>
        <button className="btn sm" title="この場所だけ共通パーツとの連動をやめ、独立したコピーにする" onClick={() => st.detachInstance(node.id)}>
          この場所だけ解除
        </button>
      </div>
    </div>
  );
}

interface NodePropsArgs {
  node: UINode;
  screen: Screen;
  /** ノードが属するツリーのルート（画面、または共通パーツの中身） */
  root: UINode;
  /** ノードが共通パーツの中身に含まれる場合、その共通パーツ */
  owner: SharedComponent | undefined;
}

function NodeProps({ node, screen, root, owner }: NodePropsArgs) {
  const def = getPart(node.type);
  const st = useStore.getState();
  const screens = useStore((s) => s.project.screens);
  const project = useStore((s) => s.project);
  const path = pathTo(root, node.id);
  const parent = findParent(root, node.id);
  const isRoot = root.id === node.id;
  const isInstance = node.type === COMPONENT_REF;
  const canMakeComponent = !isInstance && !whyNotComponent(project, node.id) && !!parent && canAccept(parent.type, COMPONENT_REF);
  const childType = def?.allowedChildren?.length === 1 ? def.allowedChildren[0] : null;
  const childDef = childType ? getPart(childType) : null;

  if (!def) {
    return (
      <div className="panel-section">
        <div className="panel-title">未登録のパーツ: {node.type}</div>
        <div className="hint">このパーツの定義が見つかりません。パーツを登録するか、削除してください。</div>
        <div className="btn-row">
          <button className="btn sm danger" onClick={() => st.deleteNode(node.id)}>
            削除
          </button>
        </div>
      </div>
    );
  }
  const minChildren = def.minChildren ?? 0;

  return (
    <>
      <div className="panel-section">
        {owner && (
          <div className="notice">
            ◈ 共通パーツ「{owner.name}」の中身です。変更は、使われているすべての画面に反映されます。
          </div>
        )}
        <div className="crumbs">
          {path.map((p, i) => (
            <span key={p.id}>
              {i > 0 && <span className="crumb-sep">›</span>}
              <button className={`crumb ${p.id === node.id ? 'cur' : ''}`} onClick={() => st.select(p.id)}>
                {p.name || getPart(p.type)?.label || p.type}
              </button>
            </span>
          ))}
        </div>
        <div className="panel-title">
          <span className="part-icon">{def.icon}</span> {isInstance ? (getComponent(project, String(node.props.componentId))?.name ?? def.label) : def.label}
        </div>
        {def.description && <div className="hint">{def.description}</div>}
        {!isRoot && (
          <div className="btn-row">
            <button className="btn sm" title="前へ" onClick={() => st.moveSibling(node.id, -1)}>
              ↑
            </button>
            <button className="btn sm" title="後ろへ" onClick={() => st.moveSibling(node.id, 1)}>
              ↓
            </button>
            <button className="btn sm" onClick={() => st.duplicateNode(node.id)}>
              複製
            </button>
            <button className="btn sm danger" onClick={() => st.deleteNode(node.id)}>
              削除
            </button>
            {canMakeComponent && (
              <button
                className="btn sm"
                title="この要素を共通パーツにして、複数の画面で使い回せるようにする"
                onClick={() => st.makeComponent(node.id)}
              >
                ◈ 共通パーツにする
              </button>
            )}
          </div>
        )}
      </div>

      {isInstance && <InstanceSection node={node} comp={getComponent(project, String(node.props.componentId))} />}

      <div className="panel-section">
        <div className="section-title">プロパティ</div>
        <Row label="識別名（任意）">
          <input
            className="f-input"
            value={node.name ?? ''}
            placeholder="例: agentList（エージェントへの参照用）"
            onChange={(e) => st.updateNode(node.id, { name: e.target.value.replace(/\s/g, '') })}
          />
        </Row>
        {def.fields.map((f) => (
          <Row key={f.key} label={f.label} inline={f.kind === 'boolean'}>
            <FieldInput field={f} value={node.props[f.key]} onChange={(v) => st.updateProps(node.id, { [f.key]: v })} />
          </Row>
        ))}
      </div>

      {childType && childDef && (
        <div className="panel-section">
          <div className="section-title">{childDef.label}</div>
          {(node.children ?? []).map((c, i, arr) => (
            <div key={c.id} className="child-row">
              <input
                className="f-input"
                value={String(c.props.label ?? '')}
                onChange={(e) => st.updateProps(c.id, { label: e.target.value })}
              />
              <button className="icon-btn" title="選択" onClick={() => st.select(c.id)}>
                ✎
              </button>
              <button className="icon-btn" title="前へ" disabled={i === 0} onClick={() => st.moveSibling(c.id, -1)}>
                ↑
              </button>
              <button className="icon-btn" title="後ろへ" disabled={i === arr.length - 1} onClick={() => st.moveSibling(c.id, 1)}>
                ↓
              </button>
              <button className="icon-btn" title="削除" disabled={arr.length <= minChildren} onClick={() => st.deleteNode(c.id)}>
                ×
              </button>
            </div>
          ))}
          <button
            className="btn sm"
            onClick={() => st.addChild(node.id, childType, { label: `${childDef.label}${(node.children?.length ?? 0) + 1}` })}
          >
            ＋ {childDef.label}を追加
          </button>
        </div>
      )}

      {isRoot && !owner && screen.kind === 'modal' && (
        <div className="panel-section">
          <div className="section-title">サイズ</div>
          <Row label="モーダルの幅">
            <SizeInput value={node.layout?.width} onChange={(v) => st.updateNode(node.id, { layout: { ...node.layout, width: v } })} />
          </Row>
        </div>
      )}

      {!isRoot && (
        <div className="panel-section">
          <div className="section-title">サイズ</div>
          <Row label="幅">
            <SizeInput value={node.layout?.width} onChange={(v) => st.updateNode(node.id, { layout: { ...node.layout, width: v } })} />
          </Row>
          <Row label="高さ">
            <SizeInput value={node.layout?.height} onChange={(v) => st.updateNode(node.id, { layout: { ...node.layout, height: v } })} />
          </Row>
          {parent?.type === 'grid' && (
            <Row label="列スパン">
              <input
                className="f-input"
                type="number"
                min={1}
                max={12}
                value={node.layout?.colSpan ?? 1}
                onChange={(e) => st.updateNode(node.id, { layout: { ...node.layout, colSpan: Number(e.target.value) || 1 } })}
              />
            </Row>
          )}
        </div>
      )}

      <div className="panel-section">
        <div className="section-title">画面遷移</div>
        <Row label="クリック時の遷移先">
          <select
            className="f-input"
            value={node.link?.screenId ?? ''}
            onChange={(e) => st.updateNode(node.id, { link: e.target.value ? { screenId: e.target.value } : undefined }, false)}
          >
            <option value="">（なし）</option>
            {screens.map((s) => (
              <option key={s.id} value={s.id}>
                {s.kind === 'modal' ? '⧉ ' : ''}
                {s.name}
                {s.id === screen.id ? '（この画面）' : ''}
              </option>
            ))}
            <option value={LINK_BACK}>閉じる（モーダルを閉じて前の画面に戻る）</option>
          </select>
        </Row>
        {node.link && node.link.screenId !== LINK_BACK && node.link.screenId !== screen.id && (
          <button className="btn sm" onClick={() => st.navigate(node.link!.screenId)}>
            遷移先の画面を開く
          </button>
        )}
      </div>

      <div className="panel-section">
        <div className="section-title">コメント</div>
        <CommentsBox target={{ screenId: screen.id, nodeId: node.id }} comments={node.comments} />
      </div>
    </>
  );
}

function ScreenProps({ screen }: { screen: Screen }) {
  const st = useStore.getState();
  const project = useStore((s) => s.project);
  const all: { node: UINode; text: string }[] = [];
  walkNodes(screen.root, (n) => n.comments?.forEach((c) => all.push({ node: n, text: c.text })));

  return (
    <>
      <div className="panel-section">
        <div className="section-title">画面</div>
        <Row label="画面名">
          <input className="f-input" value={screen.name} onChange={(e) => st.updateScreen(screen.id, { name: e.target.value })} />
        </Row>
        <Row label="種別">
          <select
            className="f-input"
            value={screen.kind}
            onChange={(e) => st.updateScreen(screen.id, { kind: e.target.value as Screen['kind'] })}
          >
            <option value="page">ページ</option>
            <option value="modal">モーダル（前の画面に重ねる）</option>
          </select>
        </Row>
        <Row label="画面の目的・説明">
          <textarea
            className="f-input"
            rows={3}
            value={screen.description ?? ''}
            onChange={(e) => st.updateScreen(screen.id, { description: e.target.value })}
          />
        </Row>
      </div>
      <div className="panel-section">
        <div className="section-title">画面へのコメント</div>
        <CommentsBox target={{ screenId: screen.id }} comments={screen.comments} placeholder="画面全体の要件・挙動" />
      </div>
      {all.length > 0 && (
        <div className="panel-section">
          <div className="section-title">この画面のパーツへのコメント</div>
          {all.map((c, i) => (
            <button key={i} className="comment-link" onClick={() => st.select(c.node.id)}>
              <b>{c.node.name || getPart(c.node.type)?.label}</b>: {c.text}
            </button>
          ))}
        </div>
      )}
      <div className="panel-section">
        <div className="section-title">プロジェクト</div>
        <Row label="プロジェクト名">
          <input className="f-input" value={project.name} onChange={(e) => st.setProjectMeta({ name: e.target.value })} />
        </Row>
        <Row label="アプリの概要">
          <textarea
            className="f-input"
            rows={3}
            value={project.description ?? ''}
            onChange={(e) => st.setProjectMeta({ description: e.target.value })}
          />
        </Row>
        <Row label="作るアプリのテーマ要件">
          <select
            className="f-input"
            value={project.appearance ?? ''}
            onChange={(e) => st.setProjectMeta({ appearance: (e.target.value || undefined) as Appearance | undefined })}
          >
            <option value="">（指定なし）</option>
            {(Object.keys(APPEARANCE_LABEL) as Appearance[]).map((a) => (
              <option key={a} value={a}>
                {APPEARANCE_LABEL[a]}
              </option>
            ))}
          </select>
        </Row>
        <div className="hint">エージェントへの出力に要件として書かれます。ビルダーの配色とは別の設定です。</div>
        <Row label="想定画面幅">
          <select
            className="f-input"
            value={project.viewport}
            onChange={(e) => st.setProjectMeta({ viewport: e.target.value as Viewport })}
          >
            {(Object.keys(VIEWPORT_WIDTH) as Viewport[]).map((v) => (
              <option key={v} value={v}>
                {v} ({VIEWPORT_WIDTH[v]}px)
              </option>
            ))}
          </select>
        </Row>
      </div>
    </>
  );
}

export function PropertiesPanel() {
  const screen = useCurrentScreen();
  const selectedId = useStore((s) => s.selectedId);
  const project = useStore((s) => s.project);
  // 選択中のノードは、画面のツリーか共通パーツの中身のどちらかにある
  const node = selectedId ? findNodeAnywhere(project, selectedId) : null;
  const root = selectedId ? findTreeRoot(project, selectedId) : null;
  return (
    <aside className="panel right">
      {node && root ? (
        <NodeProps node={node} screen={screen} root={root} owner={componentContaining(project, node.id)} />
      ) : (
        <ScreenProps screen={screen} />
      )}
    </aside>
  );
}
