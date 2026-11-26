import type { ReactNode } from 'react';
import type { Props, PropValue, UINode } from '../model/types';

/** プロパティパネルを自動生成するためのフィールド定義 */
export type PropField =
  | { key: string; label: string; kind: 'text'; placeholder?: string }
  | { key: string; label: string; kind: 'textarea'; rows?: number }
  | { key: string; label: string; kind: 'number'; min?: number; max?: number; step?: number }
  | { key: string; label: string; kind: 'boolean' }
  | { key: string; label: string; kind: 'select'; options: { value: string; label: string }[] }
  /** 1行1項目の文字列リスト */
  | { key: string; label: string; kind: 'list'; hint?: string };

export interface RenderCtx {
  node: UINode;
  props: Props;
  mode: 'edit' | 'preview';
  /** コンテナ系パーツ用: 子要素のドロップ領域を描画する */
  renderChildren: (opts?: ChildrenAreaOptions) => ReactNode;
  /** 表示中の画面ID（遷移先が現在の画面かどうかの判定などに使う） */
  screenId: string;
  /** 共通パーツの中身を描画する（componentRef 用） */
  renderComponent: (componentId: string) => ReactNode;
  /** 任意の子ノードを描画する（タブパネルなど） */
  renderNode: (child: UINode) => ReactNode;
  /** ノード単位の一時UI状態（アクティブタブなど。保存されない） */
  uiState: Record<string, PropValue>;
  setUiState: (key: string, value: PropValue) => void;
  /** 子ノードの追加（タブ追加など）。追加したノードのIDを返す */
  addChild: (type: string, props?: Props) => string | undefined;
  updateChildProps: (childId: string, patch: Props) => void;
  removeChild: (childId: string) => void;
}

export interface ChildrenAreaOptions {
  direction?: 'row' | 'column' | 'grid';
  style?: React.CSSProperties;
  className?: string;
  /** 空のときに表示する文言 */
  emptyLabel?: string;
}

export interface PartDef {
  type: string;
  label: string;
  category: string;
  /** パレットに表示する短いアイコン文字 */
  icon: string;
  description?: string;
  fields: PropField[];
  defaultProps: Props;
  defaultLayout?: { width?: string; height?: string };
  /** 子要素を受け入れるか */
  container?: boolean;
  /** 受け入れる子のタイプ（未指定なら hidden 以外すべて） */
  allowedChildren?: string[];
  /** 生成時に自動で作る子要素 */
  defaultChildren?: () => { type: string; props?: Props }[];
  /** パレットに表示しない（タブパネルなど親専用パーツ） */
  hidden?: boolean;
  /** false にするとパレットに出さない（親を選ばず配置はできる） */
  inPalette?: boolean;
  /** 子要素の最小数（これ以下には削除できない） */
  minChildren?: number;
  render: (ctx: RenderCtx) => ReactNode;
  /** エージェント向けの1行説明 */
  describe?: (props: Props, node: UINode) => string;
}
