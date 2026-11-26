import type { PartDef } from './types';
import type { Props, UINode } from '../model/types';
import { uid } from '../model/tree';

const registry = new Map<string, PartDef>();
const order: string[] = [];

/** パーツを登録する。新しいパーツは parts/ 配下にファイルを置き、parts/index.ts から登録する */
export function registerParts(defs: PartDef[]) {
  for (const d of defs) {
    if (!registry.has(d.type)) order.push(d.type);
    registry.set(d.type, d);
  }
}

export function getPart(type: string): PartDef | undefined {
  return registry.get(type);
}

export function allParts(): PartDef[] {
  return order.map((t) => registry.get(t)!);
}

export function categories(): string[] {
  const cats: string[] = [];
  for (const p of allParts()) if (!p.hidden && p.inPalette !== false && !cats.includes(p.category)) cats.push(p.category);
  return cats;
}

export function canAccept(parentType: string, childType: string): boolean {
  const parent = getPart(parentType);
  if (!parent?.container) return false;
  const child = getPart(childType);
  if (!child) return false;
  if (parent.allowedChildren) return parent.allowedChildren.includes(childType);
  return !child.hidden;
}

/** パーツ定義から新しいノードを生成する */
export function createNode(type: string, props?: Props): UINode {
  const def = getPart(type);
  if (!def) throw new Error(`Unknown part type: ${type}`);
  const node: UINode = {
    id: uid(),
    type,
    props: { ...structuredClone(def.defaultProps), ...(props ?? {}) },
  };
  if (def.defaultLayout) node.layout = { ...def.defaultLayout };
  if (def.container) {
    node.children = (def.defaultChildren?.() ?? []).map((c) => createNode(c.type, c.props));
  }
  return node;
}
