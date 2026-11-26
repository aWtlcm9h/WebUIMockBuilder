// エージェントに渡す部品カタログ（使える type と props の一覧）
import { COMPONENT_REF } from '../model/types';
import { allParts } from '../parts/registry';

export function partCatalog() {
  const parts = allParts().filter((p) => p.type !== COMPONENT_REF);
  return parts.map((p) => {
    const parents = p.hidden ? parts.filter((q) => q.allowedChildren?.includes(p.type)).map((q) => q.type) : undefined;
    return {
      type: p.type,
      label: p.label,
      category: p.category,
      description: p.description,
      container: p.container ? true : undefined,
      allowedChildren: p.allowedChildren,
      minChildren: p.minChildren,
      onlyInside: parents,
      defaultSize: p.defaultLayout,
      props: p.fields.map((f) => ({
        key: f.key,
        label: f.label,
        kind: f.kind === 'list' ? 'string[]' : f.kind === 'textarea' ? 'text' : f.kind,
        options: f.kind === 'select' ? f.options.map((o) => o.value) : undefined,
        default: p.defaultProps[f.key],
      })),
    };
  });
}

/** write_screens に渡すツリーの書き方 */
export const SPEC_GUIDE = `# 画面ツリーの書き方（write_screens）

ノード: { "type": 部品の種類, "props"?: {...}, "size"?: { "w"?, "h"?, "colSpan"? }, "name"?: 識別名, "onClick"?, "comments"?: [文字列], "children"?: [ノード] }

- type: カタログの type。props は書いたキーだけが既定値を上書きする（省略したキーは既定値）。
- レイアウト: container は props.direction が "column"（縦）か "row"（横）。grid は props.columns で列数。入れ子で画面を組む。
- size: w/h は "fill"（親の残りを占有）/ "auto"（内容に合わせる）/ 数値（px）/ "50%"。省略すると部品の既定の大きさ（defaultSize。なければ内容に合わせる）。colSpan は親が grid のときの列スパン。
- children: container が true の部品だけが持てる。allowedChildren がある部品（tabs, navMenu）はその種類の子だけを持てる。onlyInside がある部品（tabPanel, navItem）は、その親の中にだけ置ける。
- tabs: 子は tabPanel（props.label がタブ名）。各 tabPanel の children がそのタブの中身。
- onClick: { "navigate": "S2" または画面名 } で画面遷移。モーダル画面へ遷移すると前の画面に重ねて開く。{ "action": "close" } はモーダルを閉じる。
- comments: 見た目では伝わらない意図・挙動のメモ。人にもエージェントにも最優先の要件として表示される。
- 共通パーツ: 複数の画面で使う要素（ヘッダー、サイドバーなど）は components に { "name", "root" } で1回だけ定義し、画面側は { "type": "componentRef", "component": "名前 または C1", "size": {...} } で配置する。共通パーツの中に componentRef は置けない。
- navItem は、遷移先が表示中の画面のとき自動で選択中の見た目になる（props.active は通常 false のまま）。
- 画面: { "name", "kind"?: "page" | "modal", "description"?: 画面の目的, "comments"?, "root": container のノード }。同じ name（または id: "S1" など）の画面は置き換え、なければ追加する。
- これはワイヤーフレーム。色や装飾は指定できない。文言や件数はサンプルとして入れる。
`;
