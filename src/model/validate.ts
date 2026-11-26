import { APPEARANCE_LABEL, COMPONENT_REF, LINK_BACK, type Appearance, type Comment, type Project, type Screen, type SharedComponent, type UINode, type Viewport } from './types';
import { uid } from './tree';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function normComments(v: unknown): Comment[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((c) => isObj(c) && typeof c.text === 'string')
    .map((c) => ({ id: typeof c.id === 'string' ? c.id : uid('c'), text: c.text as string, createdAt: typeof c.createdAt === 'string' ? c.createdAt : '' }));
  return out.length ? out : undefined;
}

function normNode(v: unknown, screenIds: Set<string>, seen: Set<string>, allowRef = true): UINode | null {
  if (!isObj(v) || typeof v.type !== 'string' || !v.type) return null;
  // 共通パーツの中に共通パーツは置けない
  if (v.type === COMPONENT_REF && !allowRef) return null;
  let id = typeof v.id === 'string' && v.id ? v.id : uid();
  if (seen.has(id)) id = uid();
  seen.add(id);
  const node: UINode = { id, type: v.type, props: {} };
  if (isObj(v.props)) {
    for (const [k, val] of Object.entries(v.props)) {
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') node.props[k] = val;
      else if (Array.isArray(val)) node.props[k] = val.map(String);
    }
  }
  if (typeof v.name === 'string' && v.name) node.name = v.name;
  if (isObj(v.layout)) {
    const l = v.layout;
    node.layout = {};
    if (typeof l.width === 'string') node.layout.width = l.width;
    if (typeof l.height === 'string') node.layout.height = l.height;
    if (typeof l.colSpan === 'number' && l.colSpan >= 1) node.layout.colSpan = Math.floor(l.colSpan);
  }
  if (isObj(v.link) && typeof v.link.screenId === 'string' && (v.link.screenId === LINK_BACK || screenIds.has(v.link.screenId))) {
    node.link = { screenId: v.link.screenId };
  }
  const comments = normComments(v.comments);
  if (comments) node.comments = comments;
  if (Array.isArray(v.children)) {
    node.children = v.children.map((c) => normNode(c, screenIds, seen, allowRef)).filter((c): c is UINode => c !== null);
  }
  return node;
}

/**
 * 外部から読み込んだデータ（ファイル・自動保存）を検査し、描画しても落ちない形に整える。
 * プロジェクトとして成立しない場合は例外を投げる。
 */
export function normalizeProject(data: unknown): Project {
  if (!isObj(data) || data.format !== 'webui-mock') throw new Error('WebUI Mock Builder のプロジェクトファイルではありません');
  if (data.version !== 1) throw new Error(`未対応のバージョンです: ${String(data.version)}`);
  if (!Array.isArray(data.screens) || data.screens.length === 0) throw new Error('画面データがありません');

  const rawScreens = data.screens.filter(isObj);
  const screenIds = new Set<string>();
  for (const s of rawScreens) if (typeof s.id === 'string' && s.id) screenIds.add(s.id);

  const seen = new Set<string>();
  const usedScreenIds = new Set<string>();
  const screens: Screen[] = [];
  for (const s of rawScreens) {
    const root = normNode(s.root, screenIds, seen);
    if (!root) continue;
    root.children ??= [];
    let id = typeof s.id === 'string' && s.id ? s.id : uid('s');
    if (usedScreenIds.has(id)) id = uid('s');
    usedScreenIds.add(id);
    const screen: Screen = {
      id,
      name: typeof s.name === 'string' && s.name ? s.name : '画面',
      kind: s.kind === 'modal' ? 'modal' : 'page',
      root,
    };
    if (typeof s.description === 'string' && s.description) screen.description = s.description;
    const comments = normComments(s.comments);
    if (comments) screen.comments = comments;
    screens.push(screen);
  }
  if (!screens.length) throw new Error('画面データが壊れています');

  const viewport: Viewport = data.viewport === 'tablet' || data.viewport === 'mobile' ? data.viewport : 'desktop';
  const project: Project = {
    format: 'webui-mock',
    version: 1,
    name: typeof data.name === 'string' && data.name ? data.name : '無題のプロジェクト',
    viewport,
    screens,
  };
  if (typeof data.description === 'string' && data.description) project.description = data.description;
  if (typeof data.appearance === 'string' && data.appearance in APPEARANCE_LABEL) project.appearance = data.appearance as Appearance;

  if (Array.isArray(data.components)) {
    const components: SharedComponent[] = [];
    const usedIds = new Set<string>();
    for (const c of data.components.filter(isObj)) {
      const root = normNode(c.root, screenIds, seen, false);
      if (!root || typeof c.id !== 'string' || !c.id || usedIds.has(c.id)) continue;
      usedIds.add(c.id);
      root.layout = { width: 'fill', height: 'fill' };
      components.push({ id: c.id, name: typeof c.name === 'string' && c.name ? c.name : '共通パーツ', root });
    }
    if (components.length) project.components = components;
  }
  return project;
}
