import type { UINode } from './types';

export function uid(prefix = 'n'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function findNode(root: UINode, id: string): UINode | null {
  if (root.id === id) return root;
  for (const c of root.children ?? []) {
    const f = findNode(c, id);
    if (f) return f;
  }
  return null;
}

export function findParent(root: UINode, id: string): UINode | null {
  for (const c of root.children ?? []) {
    if (c.id === id) return root;
    const f = findParent(c, id);
    if (f) return f;
  }
  return null;
}

/** ルートから対象ノードまでのパス（対象を含む） */
export function pathTo(root: UINode, id: string): UINode[] {
  if (root.id === id) return [root];
  for (const c of root.children ?? []) {
    const p = pathTo(c, id);
    if (p.length) return [root, ...p];
  }
  return [];
}

export function isDescendant(root: UINode, ancestorId: string, id: string): boolean {
  const a = findNode(root, ancestorId);
  return !!a && !!findNode(a, id);
}

export function removeNode(root: UINode, id: string): UINode | null {
  const parent = findParent(root, id);
  if (!parent?.children) return null;
  const idx = parent.children.findIndex((c) => c.id === id);
  const [removed] = parent.children.splice(idx, 1);
  return removed;
}

export function insertNode(root: UINode, parentId: string, index: number, node: UINode) {
  const parent = findNode(root, parentId);
  if (!parent) return;
  parent.children ??= [];
  const i = Math.max(0, Math.min(index, parent.children.length));
  parent.children.splice(i, 0, node);
}

/** ID を振り直したディープコピー（複製用） */
export function cloneWithNewIds(node: UINode): UINode {
  const c: UINode = structuredClone(node);
  const walk = (n: UINode) => {
    n.id = uid();
    n.comments = n.comments?.map((cm) => ({ ...cm, id: uid('c') }));
    n.children?.forEach(walk);
  };
  walk(c);
  return c;
}

export function walkNodes(root: UINode, fn: (n: UINode, depth: number, parent: UINode | null) => void) {
  const rec = (n: UINode, d: number, p: UINode | null) => {
    fn(n, d, p);
    n.children?.forEach((c) => rec(c, d + 1, n));
  };
  rec(root, 0, null);
}
