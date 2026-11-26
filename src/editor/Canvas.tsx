import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { dragState, useCurrentScreen, useStore } from '../model/store';
import { findNode } from '../model/tree';
import { containsRef, findNodeAnywhere, getComponent } from '../model/components';
import { COMPONENT_REF, LINK_BACK, VIEWPORT_WIDTH, type Screen, type UINode } from '../model/types';
import { canAccept, getPart } from '../parts/registry';
import type { ChildrenAreaOptions, RenderCtx } from '../parts/types';

type Dir = 'row' | 'column' | 'grid';

const EMPTY_UI = {};

function sizeStyle(node: UINode, parentDir: Dir | null): CSSProperties {
  const st: CSSProperties = {};
  const w = node.layout?.width ?? 'auto';
  const h = node.layout?.height ?? 'auto';
  const isNum = (v: string) => /^\d+(\.\d+)?$/.test(v);

  if (w === 'fill') {
    if (parentDir === 'row') Object.assign(st, { flex: '1 1 0', minWidth: 0 });
    else if (parentDir === 'column') st.alignSelf = 'stretch';
    else if (!parentDir) st.width = '100%';
  } else if (isNum(w)) {
    st.width = Number(w);
    if (parentDir === 'row') st.flexShrink = 0;
  } else if (w.endsWith('%')) st.width = w;

  if (h === 'fill') {
    if (parentDir === 'column') Object.assign(st, { flex: st.flex ? st.flex : '1 1 0', minHeight: 0 });
    else if (parentDir === 'row') st.alignSelf = 'stretch';
    else if (!parentDir) st.flex = '1 0 auto';
  } else if (isNum(h)) {
    st.height = Number(h);
    if (parentDir === 'column') st.flexShrink = 0;
  } else if (h.endsWith('%')) st.height = h;

  // 横並びで幅も高さも fill のときは flex を幅方向に使う
  if (parentDir === 'row' && w !== 'fill' && h === 'fill') st.alignSelf = 'stretch';
  if (parentDir === 'grid' && node.layout?.colSpan && node.layout.colSpan > 1) st.gridColumn = `span ${node.layout.colSpan}`;
  return st;
}

/** 共通パーツのインスタンスの内側を描画しているとき、そのインスタンスの情報 */
interface Instance {
  refId: string;
  componentId: string;
}
const InstanceCtx = createContext<Instance | null>(null);

/**
 * インスタンスの「中に入っている」か。
 * インスタンス自体か、その共通パーツの中の要素が選択されていれば、中の要素を直接操作できる。
 * そうでなければ、クリックやドラッグはインスタンス全体に対して働く。
 */
function isEntered(inst: Instance): boolean {
  const { selectedId, project } = useStore.getState();
  if (!selectedId) return false;
  if (selectedId === inst.refId) return true;
  const comp = getComponent(project, inst.componentId);
  return !!comp && !!findNode(comp.root, selectedId);
}

function ChildrenArea({ node, screenId, opts }: { node: UINode; screenId: string; opts: ChildrenAreaOptions }) {
  const mode = useStore((s) => s.mode);
  const dropTarget = useStore((s) => (s.dropTarget?.parentId === node.id ? s.dropTarget : null));
  const inst = useContext(InstanceCtx);
  const dir: Dir = opts.direction ?? 'column';
  const children = node.children ?? [];

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    const payload = dragState.payload;
    if (!payload) return;
    if (!canAccept(node.type, payload.type)) return;
    const project = useStore.getState().project;
    const moving = payload.kind === 'move' ? findNodeAnywhere(project, payload.id) : null;
    // 自分自身や自分の子孫の中には移動できない
    if (moving && findNode(moving, node.id)) return;
    // 共通パーツの中に共通パーツは置けない
    if (inst && (payload.type === COMPONENT_REF || (moving && containsRef(moving)))) return;
    const isScreenRoot = project.screens.some((s) => s.root.id === node.id);
    const area = e.currentTarget;
    const rect = area.getBoundingClientRect();
    const EDGE = 6;
    const nearEdge =
      e.clientX - rect.left < EDGE || rect.right - e.clientX < EDGE || e.clientY - rect.top < EDGE || rect.bottom - e.clientY < EDGE;
    // 端に寄せたときは親コンテナへのドロップとして扱う
    if (nearEdge && !isScreenRoot) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = payload.kind === 'move' ? 'move' : 'copy';

    const els = Array.from(area.children).filter((el) => (el as HTMLElement).dataset.nodeId) as HTMLElement[];
    let index = els.length;
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      const before =
        dir === 'row'
          ? e.clientX < r.left + r.width / 2
          : dir === 'column'
            ? e.clientY < r.top + r.height / 2
            : e.clientY < r.top || (e.clientY < r.bottom && e.clientX < r.left + r.width / 2);
      if (before) {
        index = i;
        break;
      }
    }
    useStore.getState().setDropTarget({ parentId: node.id, index });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const st = useStore.getState();
    const t = st.dropTarget;
    const payload = dragState.payload;
    if (!t || t.parentId !== node.id || !payload) return;
    e.preventDefault();
    e.stopPropagation();
    if (payload.kind === 'new') st.addNode(t.parentId, t.index, payload.type, payload.props);
    else st.moveNode(payload.id, t.parentId, t.index);
    dragState.payload = null;
    st.setDropTarget(null);
  };

  const items: ReactNode[] = children.map((c) => <NodeView key={c.id} node={c} screenId={screenId} parentDir={dir} />);
  if (dropTarget) items.splice(dropTarget.index, 0, <div key="__drop" className={`wf-drop-indicator dir-${dir}`} />);

  const style: CSSProperties = {
    ...(dir === 'grid' ? { display: 'grid' } : { display: 'flex', flexDirection: dir }),
    ...opts.style,
  };

  return (
    <div
      className={`wf-children ${opts.className ?? ''} ${dropTarget ? 'drop-active' : ''} ${children.length === 0 ? 'empty' : ''}`}
      style={style}
      onDragOver={mode === 'edit' ? onDragOver : undefined}
      onDrop={mode === 'edit' ? onDrop : undefined}
    >
      {items}
      {children.length === 0 && mode === 'edit' && !dropTarget && (
        <div className="wf-empty-hint">{opts.emptyLabel ?? 'ここにパーツをドロップ'}</div>
      )}
    </div>
  );
}

/** 共通パーツの中身を描画する。中の要素は定義そのものなので、編集は全インスタンスに反映される */
function ComponentInstance({ refNode, screenId }: { refNode: UINode; screenId: string }) {
  const componentId = String(refNode.props.componentId ?? '');
  const comp = useStore((s) => getComponent(s.project, componentId));
  const nested = useContext(InstanceCtx);
  if (!comp || nested) {
    return <div className="wf-unknown-body">{nested ? '共通パーツの中に共通パーツは置けません' : '共通パーツが見つかりません'}</div>;
  }
  return (
    <InstanceCtx.Provider value={{ refId: refNode.id, componentId }}>
      <NodeView node={comp.root} screenId={screenId} parentDir="column" locked />
    </InstanceCtx.Provider>
  );
}

interface NodeViewProps {
  node: UINode;
  screenId: string;
  parentDir: Dir | null;
  /** ツリーのルート（共通パーツの中身のルート）で、移動・削除できない */
  locked?: boolean;
}

export function NodeView({ node, screenId, parentDir, locked }: NodeViewProps) {
  const inst = useContext(InstanceCtx);
  const componentName = useStore((s) => (node.type === COMPONENT_REF ? getComponent(s.project, String(node.props.componentId))?.name : undefined));
  const mode = useStore((s) => s.mode);
  const selected = useStore((s) => s.selectedId === node.id);
  const uiState = useStore((s) => s.ui[node.id] ?? EMPTY_UI);
  const linkName = useStore((s) =>
    !node.link ? undefined : node.link.screenId === LINK_BACK ? '閉じる' : s.project.screens.find((x) => x.id === node.link!.screenId)?.name,
  );
  const def = getPart(node.type);
  const isRoot = parentDir === null || !!locked;
  const isInstance = node.type === COMPONENT_REF;

  const ctx: RenderCtx = useMemo(() => {
    const st = useStore.getState;
    return {
      node,
      props: node.props,
      mode,
      uiState,
      screenId,
      renderComponent: () => <ComponentInstance refNode={node} screenId={screenId} />,
      renderChildren: (opts = {}) => <ChildrenArea node={node} screenId={screenId} opts={opts} />,
      renderNode: (child) => <NodeView key={child.id} node={child} screenId={screenId} parentDir="column" />,
      setUiState: (k, v) => st().setUi(node.id, k, v),
      addChild: (type, props) => st().addChild(node.id, type, props),
      updateChildProps: (id, patch) => st().updateProps(id, patch, false),
      removeChild: (id) => st().deleteNode(id),
    };
  }, [node, mode, uiState, screenId]);


  const comments = node.comments?.length ?? 0;
  const edit = mode === 'edit';

  return (
    <div
      data-node-id={node.id}
      data-wfill={node.layout?.width && node.layout.width !== 'auto' ? '' : undefined}
      className={`wf-node t-${node.type} ${def ? '' : 'wf-unknown'} ${selected ? 'selected' : ''} ${edit ? 'editing' : ''} ${node.link && !edit ? 'clickable' : ''} ${parentDir === null ? 'root' : ''} ${isInstance ? 'instance' : ''}`}
      // 共通パーツの中身のルートは、インスタンスの枠いっぱいに広げる（枠が内容に合わせる設定なら内容の大きさになる）
      style={locked ? { flex: '1 1 auto', alignSelf: 'stretch', minWidth: 0, minHeight: 0 } : sizeStyle(node, parentDir)}
      draggable={edit && !isRoot}
      onDragStart={(e) => {
        // ルートや、中に入っていないインスタンスの中身は、外側（インスタンス全体）のドラッグに任せる
        if (!edit || isRoot || (inst && !isEntered(inst))) return;
        e.stopPropagation();
        dragState.payload = { kind: 'move', id: node.id, type: node.type };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', node.id);
      }}
      onDragEnd={() => {
        dragState.payload = null;
        useStore.getState().setDropTarget(null);
      }}
      onClick={(e) => {
        if (edit) {
          e.stopPropagation();
          // 共通パーツは、1回目のクリックでインスタンス全体、選択後のクリックで中の要素を選ぶ
          useStore.getState().select(inst && !isEntered(inst) ? inst.refId : node.id);
        } else if (node.link) {
          // 遷移のない要素のクリックは、遷移を持つ祖先（カード全体など）に伝える
          e.stopPropagation();
          useStore.getState().navigate(node.link.screenId);
        }
      }}
    >
      {def ? def.render(ctx) : <div className="wf-unknown-body">未登録のパーツ: {node.type}</div>}
      {edit && selected && !isRoot && !isInstance && (
        <span className="wf-node-label">{node.name ? `${def?.label ?? node.type} · ${node.name}` : (def?.label ?? node.type)}</span>
      )}
      {edit && isInstance && <span className="wf-instance-label">◈ {componentName ?? '?'}</span>}
      {edit && (comments > 0 || node.link) && (
        <span className="wf-node-badges">
          {node.link && <span className="wf-link-badge" title="クリック時の遷移先">→ {linkName ?? '?'}</span>}
          {comments > 0 && <span className="wf-comment-badge" title="コメント">💬 {comments}</span>}
        </span>
      )}
    </div>
  );
}

function ScreenFrame({ screen, zoom }: { screen: Screen; zoom: number }) {
  const viewport = useStore((s) => s.project.viewport);
  const width = VIEWPORT_WIDTH[viewport];
  if (screen.kind === 'modal') {
    return (
      <div className="wf-frame modal-backdrop" style={{ width, zoom }}>
        <div className="wf-modal">
          <NodeView node={screen.root} screenId={screen.id} parentDir={null} />
        </div>
      </div>
    );
  }
  return (
    <div className="wf-frame" style={{ width, zoom }}>
      <NodeView node={screen.root} screenId={screen.id} parentDir={null} />
    </div>
  );
}

/** 'fit' のときはキャンバス幅に合わせた倍率を計算する */
function useZoom(frameWidth: number) {
  const ref = useRef<HTMLDivElement>(null);
  const zoomSetting = useStore((s) => s.zoom);
  const [avail, setAvail] = useState(frameWidth);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth - 48));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const zoom = zoomSetting === 'fit' ? Math.min(1, Math.max(0.3, avail / frameWidth)) : zoomSetting;
  return { ref, zoom };
}

export function Canvas() {
  const mode = useStore((s) => s.mode);
  const screen = useCurrentScreen();
  const stack = useStore((s) => s.previewStack);
  const screens = useStore((s) => s.project.screens);
  const viewport = useStore((s) => s.project.viewport);
  const { ref, zoom } = useZoom(VIEWPORT_WIDTH[viewport]);

  if (mode === 'preview') {
    const shown = stack.map((id) => screens.find((s) => s.id === id)).filter(Boolean) as Screen[];
    const base = shown.find((s) => s.kind === 'page') ?? screens.find((s) => s.kind === 'page');
    const modals = shown.filter((s) => s.kind === 'modal');
    return (
      <div className="canvas-scroll preview" ref={ref}>
        <div className="wf-frame" style={{ width: VIEWPORT_WIDTH[viewport], position: 'relative', zoom }}>
          {base && <NodeView node={base.root} screenId={base.id} parentDir={null} />}
          {modals.map((m) => (
            <div key={m.id} className="wf-preview-overlay" onClick={() => useStore.getState().closeModal()}>
              <div className="wf-modal" onClick={(e) => e.stopPropagation()}>
                <NodeView node={m.root} screenId={m.id} parentDir={null} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="canvas-scroll"
      ref={ref}
      onClick={() => useStore.getState().select(null)}
      onDragOver={() => useStore.getState().setDropTarget(null)}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) useStore.getState().setDropTarget(null);
      }}
    >
      <ScreenFrame screen={screen} zoom={zoom} />
    </div>
  );
}
