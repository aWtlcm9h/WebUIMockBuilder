// エージェントが書いたコンパクトな仕様（toCompactJson と同じ形）をプロジェクトに取り込む。
// MCP サーバーから使う。画面に依存しない純粋な処理。
import { COMPONENT_REF, LINK_BACK, type Comment, type Project, type Props, type PropValue, type Screen, type SharedComponent, type UINode } from '../model/types';
import { allRoots, deleteComponent } from '../model/components';
import { uid } from '../model/tree';
import { canAccept, createNode, getPart } from '../parts/registry';

export interface CompactNode {
  type: string;
  name?: string;
  props?: Record<string, unknown>;
  size?: { w?: string | number; h?: string | number; colSpan?: number | string };
  onClick?: { navigate?: string; action?: string };
  comments?: string[];
  children?: CompactNode[];
  /** type が componentRef のとき: 共通パーツのID（C1 など）または名前 */
  component?: string;
}

export interface ScreenInput {
  /** 既存の画面を置き換えるときのID（S1 など）。省略時は name が一致する画面を置き換え、なければ追加する */
  id?: string;
  name: string;
  kind?: 'page' | 'modal';
  description?: string;
  comments?: string[];
  root: CompactNode;
}

export interface ComponentInput {
  id?: string;
  name: string;
  root: CompactNode;
}

export interface SpecInput {
  screens?: ScreenInput[];
  components?: ComponentInput[];
  /** true のとき、既存の画面と共通パーツをすべて捨ててから書き込む */
  replaceAll?: boolean;
}

export interface ApplyResult {
  project: Project;
  warnings: string[];
  screens: string[];
  components: string[];
}

/** 仕様に誤りがあって書き込めないときのエラー。messages に修正すべき点が入る */
export class SpecError extends Error {
  constructor(public messages: string[]) {
    super(messages.join('\n'));
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const screenRef = (p: Project, s: Screen) => `S${p.screens.indexOf(s) + 1}`;
export const componentRef = (p: Project, c: SharedComponent) => `C${(p.components ?? []).indexOf(c) + 1}`;

/** "S2" のようなIDか、名前で画面を探す */
export function resolveScreen(p: Project, ref: string): Screen | undefined {
  const m = /^S(\d+)$/.exec(ref.trim());
  if (m) return p.screens[Number(m[1]) - 1];
  return p.screens.find((s) => s.name === ref.trim());
}

export function resolveComponent(p: Project, ref: string): SharedComponent | undefined {
  const m = /^C(\d+)$/.exec(ref.trim());
  if (m) return p.components?.[Number(m[1]) - 1];
  return p.components?.find((c) => c.name === ref.trim());
}

export function emptyBase(): Project {
  return { format: 'webui-mock', version: 1, name: '新規プロジェクト', viewport: 'desktop', screens: [] };
}

function normSize(v: unknown, where: string, warnings: string[]): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim().replace(/px$/, '');
  if (s === 'auto' || s === 'fill' || /^\d+(\.\d+)?%?$/.test(s)) return s;
  warnings.push(`${where}: size の値 "${String(v)}" は使えません（fill / auto / 数値(px) / "50%"）。無視しました`);
  return undefined;
}

function toComments(v: unknown): Comment[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const list = v.filter((t) => typeof t === 'string' && t.trim()).map((t) => ({ id: uid('c'), text: String(t), createdAt: new Date().toISOString() }));
  return list.length ? list : undefined;
}

interface Ctx {
  project: Project;
  errors: string[];
  warnings: string[];
  /** 遷移先は全画面を書き込んだあとで解決する */
  pendingLinks: { node: UINode; ref: string; where: string }[];
}

function coerceProp(def: PropValue, v: unknown): PropValue | undefined {
  if (Array.isArray(def)) return Array.isArray(v) ? v.map(String) : undefined;
  if (typeof def === 'number') return typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined;
  if (typeof def === 'boolean') return typeof v === 'boolean' ? v : undefined;
  return typeof v === 'string' || typeof v === 'number' ? String(v) : undefined;
}

function buildNode(c: unknown, parentType: string | null, inComponent: boolean, where: string, ctx: Ctx): UINode | null {
  if (!isObj(c) || typeof c.type !== 'string') {
    ctx.errors.push(`${where}: ノードには type が必要です`);
    return null;
  }
  const here = `${where} > ${c.type}${typeof c.name === 'string' ? `#${c.name}` : ''}`;
  let node: UINode;

  if (c.type === COMPONENT_REF) {
    if (inComponent) {
      ctx.errors.push(`${here}: 共通パーツの中に共通パーツは置けません`);
      return null;
    }
    const comp = typeof c.component === 'string' ? resolveComponent(ctx.project, c.component) : undefined;
    if (!comp) {
      ctx.errors.push(`${here}: component "${String(c.component)}" が見つかりません。同じ呼び出しの components で定義するか、既存のID（C1 など）か名前を指定してください`);
      return null;
    }
    if (parentType && !canAccept(parentType, COMPONENT_REF)) {
      ctx.errors.push(`${here}: ${parentType} の中には置けません`);
      return null;
    }
    node = { id: uid(), type: COMPONENT_REF, props: { componentId: comp.id } };
  } else {
    const def = getPart(c.type);
    if (!def) {
      ctx.errors.push(`${here}: "${c.type}" という部品はありません。get_part_catalog で使える type を確認してください`);
      return null;
    }
    if (parentType && !canAccept(parentType, c.type)) {
      const allowed = getPart(parentType)?.allowedChildren;
      ctx.errors.push(
        `${here}: ${parentType} の中に ${c.type} は置けません${allowed ? `（置けるのは ${allowed.join(', ')}）` : getPart(parentType)?.container ? `（${c.type} は専用の親の中にだけ置けます）` : `（${parentType} は子を持てません）`}`,
      );
      return null;
    }
    const props: Props = {};
    for (const [k, v] of Object.entries(isObj(c.props) ? c.props : {})) {
      if (!(k in def.defaultProps)) {
        ctx.warnings.push(`${here}: props.${k} は ${c.type} にありません（使えるのは ${Object.keys(def.defaultProps).join(', ') || 'なし'}）。無視しました`);
        continue;
      }
      const val = coerceProp(def.defaultProps[k], v);
      if (val === undefined) {
        ctx.warnings.push(`${here}: props.${k} の型が違います（既定値は ${JSON.stringify(def.defaultProps[k])}）。無視しました`);
        continue;
      }
      const field = def.fields.find((f) => f.key === k);
      if (field?.kind === 'select' && !field.options.some((o) => o.value === val)) {
        ctx.warnings.push(`${here}: props.${k} は ${field.options.map((o) => o.value).join(' / ')} のどれかです。"${String(val)}" は無視しました`);
        continue;
      }
      props[k] = val;
    }
    node = createNode(c.type, props);
    if (def.container) {
      const kids = Array.isArray(c.children) ? c.children : [];
      const built = kids.map((k) => buildNode(k, c.type as string, inComponent, here, ctx)).filter((n): n is UINode => n !== null);
      // 子の指定がなく、最小数に満たない部品（タブなど）は既定の子を使う
      if (built.length >= (def.minChildren ?? 0) && (Array.isArray(c.children) || !def.minChildren)) node.children = built;
    } else if (Array.isArray(c.children) && c.children.length) {
      ctx.warnings.push(`${here}: ${c.type} は子を持てません。children は無視しました`);
    }
  }

  if (typeof c.name === 'string' && c.name.trim()) node.name = c.name.replace(/\s/g, '');
  if (isObj(c.size)) {
    const w = normSize(c.size.w, here, ctx.warnings);
    const h = normSize(c.size.h, here, ctx.warnings);
    node.layout = { ...node.layout };
    if (w) node.layout.width = w;
    if (h) node.layout.height = h;
    const span = Number(c.size.colSpan);
    if (span > 1) node.layout.colSpan = Math.floor(span);
  }
  if (isObj(c.onClick)) {
    if (c.onClick.action === 'close') node.link = { screenId: LINK_BACK };
    else if (typeof c.onClick.navigate === 'string') ctx.pendingLinks.push({ node, ref: c.onClick.navigate, where: here });
    else ctx.warnings.push(`${here}: onClick は { "navigate": "S2 または画面名" } か { "action": "close" } です。無視しました`);
  }
  const comments = toComments(c.comments);
  if (comments) node.comments = comments;
  return node;
}

/**
 * 画面・共通パーツをプロジェクトに書き込む（同じIDか名前のものは置き換え、なければ追加）。
 * 誤りがあれば何も書き込まずに SpecError を投げる。
 */
export function applySpec(base: Project | null, input: SpecInput): ApplyResult {
  const project: Project = base ? structuredClone(base) : emptyBase();
  if (input.replaceAll) {
    project.screens = [];
    delete project.components;
  }
  const hadScreens = project.screens.length > 0;
  const ctx: Ctx = { project, errors: [], warnings: [], pendingLinks: [] };

  // 1. 共通パーツの枠を先に確保する（画面や他の定義から参照できるように）
  const compTargets: { comp: SharedComponent; input: ComponentInput }[] = [];
  for (const ci of input.components ?? []) {
    if (!isObj(ci) || typeof ci.name !== 'string' || !ci.name.trim()) {
      ctx.errors.push('components: 各要素には name と root が必要です');
      continue;
    }
    let comp = (ci.id && resolveComponent(project, ci.id)) || resolveComponent(project, ci.name);
    if (!comp) {
      comp = { id: uid('k'), name: ci.name, root: { id: uid(), type: 'container', props: {} } };
      project.components = [...(project.components ?? []), comp];
    }
    comp.name = ci.name;
    compTargets.push({ comp, input: ci });
  }

  // 2. 画面の枠を確保する（遷移先として参照できるように）
  const screenTargets: { screen: Screen; input: ScreenInput }[] = [];
  for (const si of input.screens ?? []) {
    if (!isObj(si) || typeof si.name !== 'string' || !si.name.trim()) {
      ctx.errors.push('screens: 各要素には name と root が必要です');
      continue;
    }
    let screen = (si.id && resolveScreen(project, si.id)) || resolveScreen(project, si.name);
    if (si.id && !screen && hadScreens) ctx.warnings.push(`画面 id "${si.id}" は存在しないため、新しい画面として追加しました`);
    if (!screen) {
      screen = { id: uid('s'), name: si.name, kind: 'page', root: { id: uid(), type: 'container', props: {} } };
      project.screens.push(screen);
    }
    screen.name = si.name;
    if (si.kind === 'modal' || si.kind === 'page') screen.kind = si.kind;
    if (si.description !== undefined) {
      if (si.description) screen.description = si.description;
      else delete screen.description;
    }
    const comments = toComments(si.comments);
    if (comments) screen.comments = comments;
    else if (si.comments) delete screen.comments;
    screenTargets.push({ screen, input: si });
  }

  // 3. ツリーを組み立てる
  for (const { comp, input: ci } of compTargets) {
    const root = buildNode(ci.root, null, true, `共通パーツ「${ci.name}」`, ctx);
    if (!root) continue;
    root.layout = { width: 'fill', height: 'fill' };
    comp.root = root;
  }
  for (const { screen, input: si } of screenTargets) {
    let root = buildNode(si.root, null, false, `画面「${si.name}」`, ctx);
    if (!root) continue;
    if (root.type !== 'container') {
      // 画面のルートは Flex コンテナにする
      const wrap = createNode('container', { direction: 'column', gap: 0, padding: 0 });
      wrap.children = [root];
      root = wrap;
      ctx.warnings.push(`画面「${si.name}」: ルートは container である必要があるため、container で包みました`);
    }
    root.layout = screen.kind === 'modal' ? { width: root.layout?.width && root.layout.width !== 'fill' ? root.layout.width : '520', height: 'auto' } : { width: 'fill', height: 'fill' };
    screen.root = root;
  }

  // 4. 遷移先を解決する
  for (const l of ctx.pendingLinks) {
    const target = resolveScreen(project, l.ref);
    if (target) l.node.link = { screenId: target.id };
    else ctx.warnings.push(`${l.where}: 遷移先 "${l.ref}" の画面が見つかりません（S1 などのIDか画面名）。遷移は設定していません`);
  }

  if (!project.screens.length) ctx.errors.push('画面が1つもありません。screens を1つ以上指定してください');
  if (ctx.errors.length) throw new SpecError(ctx.errors);

  return {
    project,
    warnings: ctx.warnings,
    screens: screenTargets.map((t) => `${screenRef(project, t.screen)}「${t.screen.name}」`),
    components: compTargets.map((t) => `${componentRef(project, t.comp)}「${t.comp.name}」`),
  };
}

/** 画面・共通パーツを削除する。共通パーツの使用箇所はコピーとして残す */
export function removeItems(base: Project, refs: { screens?: string[]; components?: string[] }): { project: Project; removed: string[] } {
  const project = structuredClone(base);
  const errors: string[] = [];
  const removed: string[] = [];
  const screens = (refs.screens ?? []).map((r) => resolveScreen(project, r) ?? (errors.push(`画面 "${r}" が見つかりません`), undefined));
  const comps = (refs.components ?? []).map((r) => resolveComponent(project, r) ?? (errors.push(`共通パーツ "${r}" が見つかりません`), undefined));
  if (errors.length) throw new SpecError(errors);
  const screenIds = new Set(screens.map((s) => s!.id));
  if (screenIds.size >= project.screens.length) throw new SpecError(['すべての画面は削除できません（最低1画面が必要です）']);
  for (const c of comps) {
    removed.push(`共通パーツ「${c!.name}」`);
    deleteComponent(project, c!.id);
  }
  for (const s of screens) removed.push(`画面「${s!.name}」`);
  project.screens = project.screens.filter((s) => !screenIds.has(s.id));
  const unlink = (n: UINode) => {
    if (n.link && screenIds.has(n.link.screenId)) delete n.link;
    n.children?.forEach(unlink);
  };
  allRoots(project).forEach(unlink);
  return { project, removed };
}
