// 共通パーツ（複数の画面で共有するコンポーネント）に関する純粋な操作
import type { Project, SharedComponent, UINode } from './types';
import { COMPONENT_REF } from './types';
import { cloneWithNewIds, findNode, findParent, uid, walkNodes } from './tree';

export const componentIdOf = (n: UINode): string | null =>
  n.type === COMPONENT_REF && typeof n.props.componentId === 'string' ? n.props.componentId : null;

export function getComponent(p: Project, id: string | null): SharedComponent | undefined {
  return id ? p.components?.find((c) => c.id === id) : undefined;
}

/** ノードが属するツリー（画面または共通パーツ）のルートを探す */
export function findTreeRoot(p: Project, nodeId: string): UINode | null {
  for (const sc of p.screens) if (findNode(sc.root, nodeId)) return sc.root;
  for (const c of p.components ?? []) if (findNode(c.root, nodeId)) return c.root;
  return null;
}

export function findNodeAnywhere(p: Project, nodeId: string): UINode | null {
  const root = findTreeRoot(p, nodeId);
  return root ? findNode(root, nodeId) : null;
}

/** ノードが共通パーツの定義の中にあれば、その共通パーツを返す */
export function componentContaining(p: Project, nodeId: string): SharedComponent | undefined {
  return p.components?.find((c) => findNode(c.root, nodeId));
}

export function containsRef(n: UINode): boolean {
  let found = false;
  walkNodes(n, (x) => {
    if (x.type === COMPONENT_REF) found = true;
  });
  return found;
}

/** 画面・共通パーツの全ツリーのルート */
export function allRoots(p: Project): UINode[] {
  return [...p.screens.map((s) => s.root), ...(p.components ?? []).map((c) => c.root)];
}

export function countInstances(p: Project, componentId: string): number {
  let n = 0;
  for (const s of p.screens) walkNodes(s.root, (x) => void (componentIdOf(x) === componentId && n++));
  return n;
}

/** このノードを共通パーツにできるか（できない場合は理由を返す） */
export function whyNotComponent(p: Project, nodeId: string): string | null {
  const root = findTreeRoot(p, nodeId);
  if (!root) return 'ノードが見つかりません';
  if (root.id === nodeId) return '画面全体は共通パーツにできません';
  if (componentContaining(p, nodeId)) return '共通パーツの中身は、さらに共通パーツにできません';
  const node = findNode(root, nodeId)!;
  if (containsRef(node)) return '共通パーツを含む要素は共通パーツにできません';
  return null;
}

/**
 * ノードを共通パーツの定義に移し、元の位置を参照（インスタンス）に置き換える。
 * サイズ指定はインスタンス側に残す。戻り値はインスタンスのノードID。
 */
export function makeComponent(p: Project, nodeId: string, name: string): string | null {
  if (whyNotComponent(p, nodeId)) return null;
  const root = findTreeRoot(p, nodeId)!;
  const parent = findParent(root, nodeId)!;
  const idx = parent.children!.findIndex((c) => c.id === nodeId);
  const node = parent.children![idx];
  const comp: SharedComponent = { id: uid('k'), name, root: node };
  const ref: UINode = { id: uid(), type: COMPONENT_REF, props: { componentId: comp.id } };
  if (node.layout) ref.layout = node.layout;
  node.layout = { width: 'fill', height: 'fill' };
  parent.children![idx] = ref;
  p.components = [...(p.components ?? []), comp];
  return ref.id;
}

/** インスタンス1つを、共通パーツの中身のコピーに戻す。戻り値はコピーのノードID */
export function detachInstance(p: Project, refNodeId: string): string | null {
  const root = findTreeRoot(p, refNodeId);
  const parent = root && findParent(root, refNodeId);
  if (!parent?.children) return null;
  const idx = parent.children.findIndex((c) => c.id === refNodeId);
  const ref = parent.children[idx];
  const comp = getComponent(p, componentIdOf(ref));
  if (!comp) return null;
  const copy = cloneWithNewIds(comp.root);
  if (ref.layout) copy.layout = ref.layout;
  else delete copy.layout;
  if (ref.comments?.length) copy.comments = [...(copy.comments ?? []), ...ref.comments];
  parent.children[idx] = copy;
  return copy.id;
}

/** 共通パーツを削除する。使われている場所はすべてコピーに戻す */
export function deleteComponent(p: Project, componentId: string) {
  for (const s of p.screens) {
    const refs: string[] = [];
    walkNodes(s.root, (x) => void (componentIdOf(x) === componentId && refs.push(x.id)));
    refs.forEach((id) => detachInstance(p, id));
  }
  p.components = (p.components ?? []).filter((c) => c.id !== componentId);
  if (!p.components.length) delete p.components;
}
