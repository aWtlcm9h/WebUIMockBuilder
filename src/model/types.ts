// プロジェクトファイル（保存・インポート対象）のデータモデル

export type PropValue = string | number | boolean | string[];
export type Props = Record<string, PropValue>;

export interface Comment {
  id: string;
  text: string;
  createdAt: string; // ISO
}

/** 配置された要素のサイズ指定。"auto" | "fill" | "240" (px) | "50%" */
export interface NodeLayout {
  width?: string;
  height?: string;
  /** Grid 親のときの列スパン */
  colSpan?: number;
}

/** 遷移先の特別な値: モーダルを閉じて前の画面に戻る */
export const LINK_BACK = '@back';

/** クリック時の画面遷移。screenId は画面ID、または LINK_BACK */
export interface NodeLink {
  screenId: string;
}

export interface UINode {
  id: string;
  type: string;
  /** エージェント向けの識別名（任意）。例: agentListPanel */
  name?: string;
  props: Props;
  layout?: NodeLayout;
  link?: NodeLink;
  comments?: Comment[];
  children?: UINode[];
}

export type ScreenKind = 'page' | 'modal';

export interface Screen {
  id: string;
  name: string;
  kind: ScreenKind;
  /** 画面の目的・説明（エージェントに渡す） */
  description?: string;
  comments?: Comment[];
  root: UINode;
}

/** 共通パーツ: 複数の画面で共有するコンポーネントの定義 */
export interface SharedComponent {
  id: string;
  name: string;
  root: UINode;
}

/** 共通パーツを参照するノードの type。props.componentId で定義を指す */
export const COMPONENT_REF = 'componentRef';

/** 作るアプリのテーマ要件（エージェントに渡す。ワイヤーフレームの見た目には影響しない） */
export type Appearance = 'light' | 'dark' | 'system' | 'toggle';

export const APPEARANCE_LABEL: Record<Appearance, string> = {
  light: 'ライトのみ',
  dark: 'ダークのみ',
  system: 'ライト/ダーク両対応（OSの設定に追従）',
  toggle: 'ライト/ダーク両対応（OSの設定に追従＋画面内の切り替えボタン）',
};

export type Viewport = 'desktop' | 'tablet' | 'mobile';

export interface Project {
  format: 'webui-mock';
  version: 1;
  name: string;
  /** アプリ全体の説明（エージェントに渡す） */
  description?: string;
  viewport: Viewport;
  /** 作るアプリのテーマ要件（未指定可） */
  appearance?: Appearance;
  screens: Screen[];
  /** 共通パーツの定義（画面のツリーからは componentRef ノードで参照する） */
  components?: SharedComponent[];
}

export const VIEWPORT_WIDTH: Record<Viewport, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 390,
};
