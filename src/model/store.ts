import { create } from 'zustand';
import { LINK_BACK, type Comment, type Project, type Props, type PropValue, type Screen, type ScreenKind, type UINode } from './types';
import { normalizeProject } from './validate';
import { cloneWithNewIds, findNode, findParent, insertNode, isDescendant, removeNode, uid } from './tree';
import { canAccept, createNode, getPart } from '../parts/registry';
import { createSampleProject } from './sample';
import {
  allRoots,
  componentContaining,
  containsRef,
  deleteComponent as removeComponent,
  detachInstance as detach,
  findNodeAnywhere,
  findTreeRoot,
  makeComponent as toComponent,
} from './components';
import { COMPONENT_REF } from './types';

const STORAGE_KEY = 'webui-mock-builder:autosave';
const THEME_KEY = 'webui-mock-builder:theme';
const HISTORY_LIMIT = 100;

export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Notice {
  text: string;
  /** true のとき「元に戻す」ボタンを出す */
  undoable?: boolean;
  kind?: 'info' | 'warn';
}

export interface FileSyncStatus {
  file: string;
  state: 'synced' | 'saving' | 'error';
  message?: string;
}

function loadTheme(): ThemeSetting {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

export type CommentTarget = { screenId: string; nodeId?: string };

interface State {
  project: Project;
  past: Project[];
  future: Project[];
  currentScreenId: string;
  selectedId: string | null;
  mode: 'edit' | 'preview';
  /** プレビュー時の画面スタック（モーダルは積む） */
  previewStack: string[];
  /** ノード単位の一時UI状態（アクティブタブなど） */
  ui: Record<string, Record<string, PropValue>>;
  dropTarget: { parentId: string; index: number } | null;
  /** プロジェクトファイルとの同期状態（ファイル連携が無効なら null） */
  fileSync: FileSyncStatus | null;
  setFileSync: (s: FileSyncStatus | null) => void;
  /** 画面下に出す通知（外部の変更を読み込んだときなど） */
  notice: Notice | null;
  setNotice: (n: Notice | null) => void;
  /** 外部で変更されたファイルの内容に置き換える（元に戻すで直前の状態に戻せる） */
  replaceFromFile: (p: Project) => void;
  /** ビルダーの配色。system は OS の設定に従う（保存ファイルには含めない） */
  theme: ThemeSetting;
  setTheme: (t: ThemeSetting) => void;
  /** キャンバスの表示倍率（'fit' は幅に合わせる） */
  zoom: number | 'fit';
  setZoom: (z: number | 'fit') => void;

  mutate: (fn: (p: Project) => void, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;

  select: (id: string | null) => void;
  setScreen: (id: string) => void;
  setMode: (m: 'edit' | 'preview') => void;
  navigate: (screenId: string) => void;
  closeModal: () => void;
  setUi: (nodeId: string, key: string, value: PropValue) => void;
  setDropTarget: (t: { parentId: string; index: number } | null) => void;

  addScreen: (kind?: ScreenKind) => void;
  updateScreen: (id: string, patch: Partial<Pick<Screen, 'name' | 'kind' | 'description'>>) => void;
  removeScreen: (id: string) => void;
  duplicateScreen: (id: string) => void;
  moveScreen: (id: string, delta: number) => void;

  addNode: (parentId: string, index: number, type: string, props?: Props) => void;
  makeComponent: (nodeId: string) => void;
  detachInstance: (refNodeId: string) => void;
  renameComponent: (componentId: string, name: string) => void;
  deleteComponent: (componentId: string) => void;
  moveNode: (id: string, parentId: string, index: number) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  moveSibling: (id: string, delta: number) => void;
  updateProps: (id: string, patch: Props, coalesce?: boolean) => void;
  updateNode: (id: string, patch: Partial<Pick<UINode, 'name' | 'layout' | 'link'>>, coalesce?: boolean) => void;
  addChild: (parentId: string, type: string, props?: Props) => string | undefined;

  addComment: (target: CommentTarget, text: string) => void;
  removeComment: (target: CommentTarget, commentId: string) => void;

  setProjectMeta: (patch: Partial<Pick<Project, 'name' | 'description' | 'viewport' | 'appearance'>>) => void;
  loadProject: (p: Project) => void;
  newProject: () => void;
  loadSample: () => void;
}

let lastCoalesce: { key: string; at: number } | null = null;

function currentScreen(s: { project: Project; currentScreenId: string }): Screen {
  return s.project.screens.find((x) => x.id === s.currentScreenId) ?? s.project.screens[0];
}

const rootOf = findTreeRoot;

/** 画面ルートの既定サイズ: ページは画面いっぱい、モーダルは固定幅 */
function rootLayout(kind: ScreenKind) {
  return kind === 'modal' ? { width: '520', height: 'auto' } : { width: 'fill', height: 'fill' };
}

function newScreen(name: string, kind: ScreenKind = 'page'): Screen {
  const root = createNode('container', { direction: 'column', gap: 12, padding: 16 });
  root.layout = rootLayout(kind);
  return { id: uid('s'), name, kind, root };
}

export function emptyProject(): Project {
  return {
    format: 'webui-mock',
    version: 1,
    name: '新規プロジェクト',
    viewport: 'desktop',
    screens: [newScreen('ホーム')],
  };
}

function loadInitial(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeProject(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return createSampleProject();
}

const initialProject = loadInitial();

export const useStore = create<State>((set, get) => ({
  project: initialProject,
  past: [],
  future: [],
  currentScreenId: initialProject.screens[0].id,
  selectedId: null,
  mode: 'edit',
  previewStack: [],
  ui: {},
  dropTarget: null,
  fileSync: null,
  setFileSync: (s) => set({ fileSync: s }),
  notice: null,
  setNotice: (n) => set({ notice: n }),
  replaceFromFile: (p) => {
    const { project, past, currentScreenId } = get();
    if (JSON.stringify(p) === JSON.stringify(project)) return;
    lastCoalesce = null;
    // 画面IDが変わらなければ同じ画面を表示し続ける。名前が同じ画面があればそれを選ぶ
    const curName = project.screens.find((s) => s.id === currentScreenId)?.name;
    const next = p.screens.find((s) => s.id === currentScreenId) ?? p.screens.find((s) => s.name === curName) ?? p.screens[0];
    set({
      project: p,
      past: [...past, project].slice(-HISTORY_LIMIT),
      future: [],
      currentScreenId: next.id,
      // 選択中の部品が残っていれば、選択を保つ
      selectedId: get().selectedId && findNodeAnywhere(p, get().selectedId!) ? get().selectedId : null,
      previewStack: get().mode === 'preview' ? [next.id] : [],
    });
  },
  theme: loadTheme(),
  setTheme: (t) => {
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* ignore */
    }
    set({ theme: t });
  },
  zoom: 'fit',
  setZoom: (z) => set({ zoom: z }),

  mutate: (fn, coalesceKey) => {
    const { project, past } = get();
    const next = structuredClone(project);
    fn(next);
    // 何も変わらなかった操作は履歴に積まない
    if (JSON.stringify(next) === JSON.stringify(project)) return;
    const now = Date.now();
    const coalesce =
      coalesceKey && lastCoalesce && lastCoalesce.key === coalesceKey && now - lastCoalesce.at < 800;
    lastCoalesce = coalesceKey ? { key: coalesceKey, at: now } : null;
    set({
      project: next,
      past: coalesce ? past : [...past, project].slice(-HISTORY_LIMIT),
      future: [],
    });
  },
  undo: () => {
    const { past, project, future } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    lastCoalesce = null;
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future] });
    get().setScreen(get().currentScreenId);
  },
  redo: () => {
    const { past, project, future } = get();
    if (!future.length) return;
    lastCoalesce = null;
    set({ project: future[0], past: [...past, project], future: future.slice(1) });
    get().setScreen(get().currentScreenId);
  },

  select: (id) => set({ selectedId: id }),
  setScreen: (id) => {
    const p = get().project;
    const exists = p.screens.some((s) => s.id === id);
    set({ currentScreenId: exists ? id : p.screens[0].id, selectedId: exists ? get().selectedId : null });
  },
  setMode: (m) =>
    set({ mode: m, selectedId: null, previewStack: m === 'preview' ? [get().currentScreenId] : [] }),
  navigate: (screenId) => {
    if (screenId === LINK_BACK) {
      if (get().mode === 'preview') get().closeModal();
      return;
    }
    const sc = get().project.screens.find((s) => s.id === screenId);
    if (!sc) return;
    if (get().mode === 'edit') {
      set({ currentScreenId: screenId, selectedId: null });
      return;
    }
    const stack = get().previewStack;
    if (sc.kind === 'modal') set({ previewStack: [...stack, screenId] });
    else set({ previewStack: [screenId], currentScreenId: screenId });
  },
  closeModal: () => {
    const stack = get().previewStack;
    if (stack.length > 1) set({ previewStack: stack.slice(0, -1) });
  },
  setUi: (nodeId, key, value) =>
    set((s) => ({ ui: { ...s.ui, [nodeId]: { ...(s.ui[nodeId] ?? {}), [key]: value } } })),
  setDropTarget: (t) => {
    const cur = get().dropTarget;
    if (cur?.parentId === t?.parentId && cur?.index === t?.index) return;
    set({ dropTarget: t });
  },

  addScreen: (kind = 'page') => {
    const sc = newScreen(kind === 'modal' ? 'モーダル' : `画面${get().project.screens.length + 1}`, kind);
    get().mutate((p) => void p.screens.push(sc));
    set({ currentScreenId: sc.id, selectedId: null });
  },
  updateScreen: (id, patch) =>
    get().mutate((p) => {
      const sc = p.screens.find((s) => s.id === id);
      if (!sc) return;
      if (patch.kind && patch.kind !== sc.kind) sc.root.layout = rootLayout(patch.kind);
      Object.assign(sc, patch);
    }, `screen:${id}:${Object.keys(patch).join()}`),
  removeScreen: (id) => {
    if (get().project.screens.length <= 1) return;
    get().mutate((p) => {
      p.screens = p.screens.filter((s) => s.id !== id);
      // 削除された画面への遷移リンクを外す（共通パーツの中も含む）
      const walk = (n: UINode) => {
        if (n.link?.screenId === id) delete n.link;
        n.children?.forEach(walk);
      };
      allRoots(p).forEach(walk);
    });
    get().setScreen(get().currentScreenId);
  },
  duplicateScreen: (id) => {
    const src = get().project.screens.find((s) => s.id === id);
    if (!src) return;
    const copy: Screen = {
      ...structuredClone(src),
      id: uid('s'),
      name: `${src.name} のコピー`,
      root: cloneWithNewIds(src.root),
    };
    get().mutate((p) => {
      const i = p.screens.findIndex((s) => s.id === id);
      p.screens.splice(i + 1, 0, copy);
    });
    set({ currentScreenId: copy.id, selectedId: null });
  },
  moveScreen: (id, delta) =>
    get().mutate((p) => {
      const i = p.screens.findIndex((s) => s.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= p.screens.length) return;
      const [s] = p.screens.splice(i, 1);
      p.screens.splice(j, 0, s);
    }),

  addNode: (parentId, index, type, props) => {
    // 共通パーツの中に共通パーツは置けない
    if (type === COMPONENT_REF && componentContaining(get().project, parentId)) return;
    const node = createNode(type, props);
    get().mutate((p) => {
      const root = rootOf(p, parentId);
      if (root) insertNode(root, parentId, index, node);
    });
    set({ selectedId: node.id });
  },
  moveNode: (id, parentId, index) =>
    get().mutate((p) => {
      // 移動元と移動先は別のツリー（画面 ⇔ 共通パーツ）でもよい
      const srcRoot = rootOf(p, id);
      const dstRoot = rootOf(p, parentId);
      if (!srcRoot || !dstRoot || srcRoot.id === id || id === parentId || isDescendant(srcRoot, id, parentId)) return;
      const node = findNode(srcRoot, id)!;
      if (componentContaining(p, parentId) && containsRef(node)) return;
      const oldParent = findParent(srcRoot, id);
      let i = index;
      if (oldParent?.id === parentId) {
        const oldIdx = oldParent.children!.findIndex((c) => c.id === id);
        if (oldIdx < index) i -= 1;
      }
      const n = removeNode(srcRoot, id);
      if (n) insertNode(dstRoot, parentId, i, n);
    }),
  makeComponent: (nodeId) => {
    const node = findNodeAnywhere(get().project, nodeId);
    if (!node) return;
    const name = node.name || String(node.props.title || '') || getPart(node.type)?.label || '共通パーツ';
    let refId: string | null = null;
    get().mutate((p) => void (refId = toComponent(p, nodeId, name)));
    if (refId) set({ selectedId: refId });
  },
  detachInstance: (refNodeId) => {
    let copyId: string | null = null;
    get().mutate((p) => void (copyId = detach(p, refNodeId)));
    if (copyId) set({ selectedId: copyId });
  },
  renameComponent: (componentId, name) =>
    get().mutate((p) => {
      const c = p.components?.find((x) => x.id === componentId);
      if (c) c.name = name;
    }, `component:${componentId}:name`),
  deleteComponent: (componentId) => {
    get().mutate((p) => removeComponent(p, componentId));
    set({ selectedId: null });
  },
  deleteNode: (id) => {
    const p0 = get().project;
    const root = rootOf(p0, id);
    if (!root || root.id === id) return;
    const parent = findParent(root, id);
    const min = (parent && getPart(parent.type)?.minChildren) ?? 0;
    if (parent && (parent.children?.length ?? 0) <= min) return;
    get().mutate((p) => {
      const r = rootOf(p, id);
      if (r) removeNode(r, id);
    });
    set({ selectedId: parent?.id ?? null });
  },
  duplicateNode: (id) => {
    const root = rootOf(get().project, id);
    if (!root || root.id === id) return;
    const node = findNode(root, id)!;
    const copy = cloneWithNewIds(node);
    get().mutate((p) => {
      const r = rootOf(p, id)!;
      const parent = findParent(r, id)!;
      const idx = parent.children!.findIndex((c) => c.id === id);
      parent.children!.splice(idx + 1, 0, copy);
    });
    set({ selectedId: copy.id });
  },
  moveSibling: (id, delta) =>
    get().mutate((p) => {
      const r = rootOf(p, id);
      const parent = r && findParent(r, id);
      if (!parent?.children) return;
      const i = parent.children.findIndex((c) => c.id === id);
      const j = i + delta;
      if (j < 0 || j >= parent.children.length) return;
      const [n] = parent.children.splice(i, 1);
      parent.children.splice(j, 0, n);
    }),
  updateProps: (id, patch, coalesce = true) =>
    get().mutate(
      (p) => {
        const r = rootOf(p, id);
        const n = r && findNode(r, id);
        if (n) n.props = { ...n.props, ...patch };
      },
      coalesce ? `props:${id}:${Object.keys(patch).join()}` : undefined,
    ),
  updateNode: (id, patch, coalesce = true) =>
    get().mutate(
      (p) => {
        const r = rootOf(p, id);
        const n = r && findNode(r, id);
        if (!n) return;
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined || v === '') delete (n as unknown as Record<string, unknown>)[k];
          else (n as unknown as Record<string, unknown>)[k] = v;
        }
      },
      coalesce ? `node:${id}:${Object.keys(patch).join()}` : undefined,
    ),
  addChild: (parentId, type, props) => {
    const root = rootOf(get().project, parentId);
    const parent = root && findNode(root, parentId);
    if (!parent || !canAccept(parent.type, type)) return undefined;
    const node = createNode(type, props);
    get().mutate((p) => {
      const r = rootOf(p, parentId)!;
      insertNode(r, parentId, parent.children?.length ?? 0, node);
    });
    return node.id;
  },

  addComment: (target, text) => {
    const c: Comment = { id: uid('c'), text, createdAt: new Date().toISOString() };
    get().mutate((p) => {
      const sc = p.screens.find((s) => s.id === target.screenId);
      if (!sc) return;
      const holder = target.nodeId ? findNodeAnywhere(p, target.nodeId) : sc;
      if (!holder) return;
      holder.comments = [...(holder.comments ?? []), c];
    });
  },
  removeComment: (target, commentId) =>
    get().mutate((p) => {
      const sc = p.screens.find((s) => s.id === target.screenId);
      if (!sc) return;
      const holder = target.nodeId ? findNodeAnywhere(p, target.nodeId) : sc;
      if (!holder?.comments) return;
      holder.comments = holder.comments.filter((c) => c.id !== commentId);
      if (!holder.comments.length) delete holder.comments;
    }),

  setProjectMeta: (patch) =>
    get().mutate((p) => {
      Object.assign(p, patch);
      if (!p.appearance) delete p.appearance;
    }, `meta:${Object.keys(patch).join()}`),
  loadProject: (p) => {
    lastCoalesce = null;
    set({
      project: p,
      past: [],
      future: [],
      currentScreenId: p.screens[0].id,
      selectedId: null,
      mode: 'edit',
      previewStack: [],
      ui: {},
    });
  },
  newProject: () => get().loadProject(emptyProject()),
  loadSample: () => get().loadProject(createSampleProject()),
}));

export function useCurrentScreen(): Screen {
  return useStore((s) => currentScreen(s));
}

export function screenOfNode(p: Project, nodeId: string): Screen | undefined {
  return p.screens.find((s) => findNode(s.root, nodeId));
}

// 自動保存（ブラウザの localStorage。正式な保存はプロジェクトファイルで行う）
let saveTimer: number | undefined;
useStore.subscribe((s, prev) => {
  if (s.project === prev.project) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s.project));
    } catch {
      /* ignore */
    }
  }, 400);
});

/** ドラッグ中のペイロード（dragover 中は dataTransfer を読めないためモジュール変数で保持） */
export const dragState: { payload: { kind: 'new'; type: string; props?: Props } | { kind: 'move'; id: string; type: string } | null } = {
  payload: null,
};
