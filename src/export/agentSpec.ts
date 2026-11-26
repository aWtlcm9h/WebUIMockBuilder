// コーディングエージェント向けの出力（Markdown + コンパクトJSON）
import { APPEARANCE_LABEL, COMPONENT_REF, LINK_BACK, type Project, type Props, type Screen, type UINode } from '../model/types';
import { componentIdOf, countInstances, getComponent } from '../model/components';
import { getPart } from '../parts/registry';
import { walkNodes } from '../model/tree';

/** 1行に収める（改行は区切りに置換） */
const oneLine = (s: string) => s.replace(/\s*\r?\n\s*/g, ' / ').trim();
const cell = (s: string) => oneLine(s).replace(/\|/g, '\\|');
const mermaidText = (s: string) => oneLine(s).replace(/"/g, "'").replace(/[\[\]]/g, ' ');

const sizeText = (v: string | undefined) => {
  if (!v || v === 'auto') return null;
  if (v === 'fill') return 'fill';
  if (/^\d+$/.test(v)) return `${v}px`;
  return v;
};

/** 共通パーツの出力用ID（C1, C2, ...） */
const cid = (p: Project, componentId: string | null) => {
  const i = (p.components ?? []).findIndex((c) => c.id === componentId);
  return i < 0 ? null : `C${i + 1}`;
};

function nodeLine(node: UINode, p: Project): string {
  const screens = p.screens;
  const def = getPart(node.type);
  const comp = getComponent(p, componentIdOf(node));
  const desc =
    node.type === COMPONENT_REF
      ? comp
        ? `共通パーツ ${cid(p, comp.id)}「${comp.name}」を配置（中身は「共通パーツ」の節を参照）`
        : '共通パーツ（参照先なし）'
      : def?.describe
        ? def.describe(node.props, node)
        : (def?.label ?? node.type);
  const attrs: string[] = [];
  const w = sizeText(node.layout?.width);
  const h = sizeText(node.layout?.height);
  if (w) attrs.push(`幅:${w}`);
  if (h) attrs.push(`高さ:${h}`);
  if (node.layout?.colSpan && node.layout.colSpan > 1) attrs.push(`列スパン:${node.layout.colSpan}`);
  let line = `${node.name ? `\`#${node.name}\` ` : ''}${oneLine(desc)}`;
  if (attrs.length) line += ` [${attrs.join(', ')}]`;
  if (node.link?.screenId === LINK_BACK) line += ' → クリックで閉じる（モーダルを閉じて前の画面に戻る）';
  else if (node.link) {
    const t = screens.find((s) => s.id === node.link!.screenId);
    if (t) line += ` → クリックで「${t.name}」${t.kind === 'modal' ? 'モーダルを開く' : 'へ遷移'}`;
  }
  return line;
}

function treeLines(node: UINode, p: Project, depth: number, out: string[]) {
  const ind = '  '.repeat(depth);
  out.push(`${ind}- ${nodeLine(node, p)}`);
  for (const c of node.comments ?? []) out.push(`${ind}  - 💬 **${oneLine(c.text)}**`);
  for (const ch of node.children ?? []) treeLines(ch, p, depth + 1, out);
}

function transitions(p: Project) {
  const edges: { from: Screen; to: Screen; via: string }[] = [];
  const seen = new Set<string>();
  for (const s of p.screens) {
    const visit = (n: UINode) => {
      // 共通パーツは中身をたどる（その画面からの遷移として数える）
      const comp = getComponent(p, componentIdOf(n));
      if (comp) walkNodes(comp.root, visit);
      if (!n.link) return;
      const to = p.screens.find((x) => x.id === n.link!.screenId);
      if (!to || to.id === s.id) return; // 自画面へのリンク（選択中メニューなど）は除外
      const label = String(n.props.label ?? n.props.text ?? n.props.title ?? getPart(n.type)?.label ?? n.type);
      const via = `${getPart(n.type)?.label ?? n.type}「${label}」`;
      const key = `${s.id}|${to.id}|${via}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ from: s, to, via });
    };
    walkNodes(s.root, visit);
  }
  return edges;
}

export function toMarkdown(p: Project): string {
  const out: string[] = [];
  const sid = (s: Screen) => `S${p.screens.indexOf(s) + 1}`;
  out.push(`# UI仕様（ワイヤーフレーム）: ${p.name}`);
  out.push('');
  out.push('> WebUI Mock Builder で作成したワイヤーフレームの仕様です。色や装飾ではなく、**部品の配置・入れ子構造・画面遷移・挙動**の指示として扱ってください。');
  out.push('');
  out.push('## 読み方（実装時のルール）');
  out.push('- レイアウトツリーの入れ子は、そのまま要素の親子関係です。「縦並び/横並び」は flex-direction: column/row、「Grid（N列）」は N 列の CSS Grid です。');
  out.push('- サイズ: `fill` = 親の残り領域を占有（flex: 1）、`240px` = 固定、指定なし = 内容に合わせる。');
  out.push('- 💬 はユーザーが書いた意図・要件です。**最優先で反映**してください。');
  out.push('- 文言・件数・グラフの値はサンプルです。実データやAPIに置き換えてください。部品の種類と配置は変えないでください。');
  out.push('- `#識別名` はコンポーネント名や data-testid の候補です。');
  if (p.components?.length) out.push('- 「共通パーツ」は**1つのコンポーネントとして実装**し、配置されている各画面で再利用してください。画面ごとに作り直さないでください。');
  out.push(`- 想定画面幅: ${p.viewport}`);
  if (p.appearance) {
    out.push(`- **テーマ要件: ${APPEARANCE_LABEL[p.appearance]}**。ワイヤーフレームは配色を指定しません。${p.appearance === 'light' || p.appearance === 'dark' ? '' : '色はテーマ用の変数（デザイントークン）で定義し、両方のテーマで読みやすくしてください。'}`);
  }
  out.push('');
  if (p.description) {
    out.push('## アプリ概要');
    out.push(p.description);
    out.push('');
  }
  out.push('## 画面一覧');
  out.push('| ID | 画面 | 種別 | 目的 |');
  out.push('|---|---|---|---|');
  for (const s of p.screens) out.push(`| ${sid(s)} | ${cell(s.name)} | ${s.kind === 'modal' ? 'モーダル' : 'ページ'} | ${cell(s.description ?? '')} |`);
  out.push('');

  const edges = transitions(p);
  if (edges.length) {
    out.push('## 画面遷移');
    out.push('```mermaid');
    out.push('flowchart LR');
    for (const s of p.screens) out.push(`  ${sid(s)}${s.kind === 'modal' ? `[["${mermaidText(s.name)}"]]` : `["${mermaidText(s.name)}"]`}`);
    for (const e of edges) out.push(`  ${sid(e.from)} -->|"${mermaidText(e.via)}"| ${sid(e.to)}`);
    out.push('```');
    out.push('');
  }

  if (p.components?.length) {
    out.push('## 共通パーツ');
    for (const c of p.components) {
      out.push(`### ${cid(p, c.id)}: ${oneLine(c.name)}（${countInstances(p, c.id)}か所で使用）`);
      const lines: string[] = [];
      // 大きさは配置する側（インスタンス）で決まるので、定義側には書かない
      treeLines({ ...c.root, layout: undefined }, p, 0, lines);
      out.push(...lines);
      out.push('');
    }
  }

  for (const s of p.screens) {
    out.push(`## ${sid(s)}: ${oneLine(s.name)}${s.kind === 'modal' ? '（モーダル）' : ''}`);
    if (s.description) out.push(s.description);
    for (const c of s.comments ?? []) out.push(`- 💬 **${oneLine(c.text)}**`);
    out.push('');
    const lines: string[] = [];
    treeLines(s.root, p, 0, lines);
    out.push(...lines);
    out.push('');
  }
  return out.join('\n');
}

/** partDefaults と同じ値のプロパティを省いたコンパクトなツリー */
function compactNode(n: UINode, screenIndex: Map<string, string>, p: Project): Record<string, unknown> {
  const def = getPart(n.type);
  const isRef = n.type === COMPONENT_REF;
  const props: Props = {};
  for (const [k, v] of Object.entries(isRef ? {} : n.props)) {
    if (JSON.stringify(def?.defaultProps[k]) !== JSON.stringify(v)) props[k] = v;
  }
  const o: Record<string, unknown> = { type: n.type };
  if (isRef) o.component = cid(p, componentIdOf(n));
  if (n.name) o.name = n.name;
  if (Object.keys(props).length) o.props = props;
  // サイズはパーツ既定値でも明示する（エージェントの解釈を揃えるため）
  const w = n.layout?.width;
  const h = n.layout?.height;
  const size: Record<string, string> = {};
  // 部品に既定の大きさがある軸は、「内容に合わせる」も auto と明示する（省略＝部品の既定の大きさ、と読めるように）
  const dl = isRef ? undefined : def?.defaultLayout;
  if (w && w !== 'auto') size.w = w;
  else if (dl?.width) size.w = 'auto';
  if (h && h !== 'auto') size.h = h;
  else if (dl?.height) size.h = 'auto';
  if (n.layout?.colSpan && n.layout.colSpan > 1) size.colSpan = String(n.layout.colSpan);
  if (Object.keys(size).length) o.size = size;
  if (n.link?.screenId === LINK_BACK) o.onClick = { action: 'close' };
  else if (n.link && screenIndex.has(n.link.screenId)) o.onClick = { navigate: screenIndex.get(n.link.screenId) };
  if (n.comments?.length) o.comments = n.comments.map((c) => c.text);
  if (n.children?.length) o.children = n.children.map((c) => compactNode(c, screenIndex, p));
  return o;
}

export function toCompactJson(p: Project): string {
  const idx = new Map(p.screens.map((s, i) => [s.id, `S${i + 1}`]));
  const parts = new Set<string>();
  const collect = (root: UINode) => walkNodes(root, (n) => void (n.type !== COMPONENT_REF && parts.add(n.type)));
  p.screens.forEach((s) => collect(s.root));
  (p.components ?? []).forEach((c) => collect(c.root));
  const spec = {
    spec: 'webui-mock/agent-spec@1',
    app: { name: p.name, description: p.description, viewport: p.viewport, appearance: p.appearance },
    note: 'ノードの props は partDefaults[type] と同じ値を省略している。省略されたキーは partDefaults の値を使うこと。size: fill=残り領域を占有, 数値=px, auto=内容に合わせる, 省略=部品の既定の大きさ（なければ内容に合わせる）。type が componentRef のノードは components の同じ id の定義を再利用する（1つのコンポーネントとして実装する）。',
    partTypes: Object.fromEntries([...parts].map((t) => [t, getPart(t)?.label ?? t])),
    partDefaults: Object.fromEntries([...parts].map((t) => [t, getPart(t)?.defaultProps ?? {}])),
    screens: p.screens.map((s) => ({
      id: idx.get(s.id),
      name: s.name,
      kind: s.kind,
      description: s.description,
      comments: s.comments?.map((c) => c.text),
      root: compactNode(s.root, idx, p),
    })),
    components: (p.components ?? []).map((c) => ({ id: cid(p, c.id), name: c.name, root: compactNode({ ...c.root, layout: undefined }, idx, p) })),
  };
  return JSON.stringify(spec, null, 1);
}
