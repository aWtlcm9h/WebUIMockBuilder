// WebUI Mock Builder の MCP サーバー（stdio）。
// コーディングエージェントが、プロジェクトファイル（*.uimock.json）の画面を読み書きするための道具を提供する。
// ビルダー（npm run dev）で同じファイルを開いていれば、書き込みはすぐ画面に反映される。
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import '../src/parts';
import { partCatalog, SPEC_GUIDE } from '../src/export/catalog';
import { toCompactJson, toMarkdown } from '../src/export/agentSpec';
import { applySpec, removeItems, resolveScreen, screenRef, SpecError, type SpecInput } from '../src/export/importSpec';
import { normalizeProject } from '../src/model/validate';
import { walkNodes, uid } from '../src/model/tree';
import { allRoots } from '../src/model/components';
import { hasChanges, summarizeChanges } from '../src/model/diff';
import { APPEARANCE_LABEL, type Appearance, type Project, type UINode, type Viewport } from '../src/model/types';
import { readText, resolveFile, writeText } from './projectFile';

const FILE_DESC = 'プロジェクトファイルのパス（*.uimock.json）。省略時は環境変数 UIMOCK_FILE、なければ ./ui.uimock.json';

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: 'text' as const, text: t }], isError: true });

function load(file: string | undefined): { path: string; project: Project | null } {
  const path = resolveFile(file);
  const raw = readText(path);
  if (raw === null) return { path, project: null };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`${path} をJSONとして読み込めません`);
  }
  return { path, project: normalizeProject(data) };
}

/** このサーバーが最後に読み書きした時点の内容（ファイルごと）。人による編集を見分けるために使う */
const lastSeen = new Map<string, Project>();
const remember = (path: string, project: Project) => void lastSeen.set(path, structuredClone(project));

const save = (path: string, project: Project) => {
  writeText(path, JSON.stringify(project, null, 1));
  // 比較の基準を揃えるため、読み込み時と同じ整形を通した内容を覚える
  remember(path, normalizeProject(JSON.parse(JSON.stringify(project))));
};

/**
 * エージェントが最後に読み書きしたあとで、他（人のビルダー操作など）が変更した箇所を説明する。
 * 書き込みは止めない。overwritten は、今回の書き込みで置き換えた画面・共通パーツの表示名。
 */
function othersEdits(path: string, current: Project | null, overwritten: string[] = []): string {
  const seen = lastSeen.get(path);
  if (!seen || !current) return '';
  const c = summarizeChanges(seen, current);
  if (!hasChanges(c)) return '';
  const touched = [...c.updated, ...c.added];
  const lost = touched.filter((t) => overwritten.includes(t));
  const kept = touched.filter((t) => !overwritten.includes(t));
  const lines = ['\n\n前回あなたがこのファイルを読み書きしたあとで、人（ビルダー）が編集していました。'];
  if (lost.length) lines.push(`- 今回の書き込みで上書きしたもの（人の編集は失われました）: ${lost.join('、')}`);
  if (kept.length) lines.push(`- 人が編集し、そのまま残っているもの: ${kept.join('、')}`);
  if (c.removed.length) lines.push(`- 人が削除したもの: ${c.removed.join('、')}`);
  lines.push('人の意図を確かめるには get_project で読み直してください。');
  return lines.join('\n');
}

const viewHint = (path: string) =>
  `\n\n人が確認・修正するには、WebUI Mock Builder を起動してこのファイルを開きます（起動中なら自動で再読み込みされます）: http://localhost:5180/?file=${encodeURIComponent(path)}`;

/** 例外を、エージェントが直せる形のエラー結果に変える */
async function guard(fn: () => ReturnType<typeof text> | Promise<ReturnType<typeof text>>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof SpecError) return fail(`書き込めませんでした。次の点を直して、もう一度呼んでください（何も変更していません）:\n- ${e.messages.join('\n- ')}`);
    return fail(`エラー: ${(e as Error).message}`);
  }
}

const server = new McpServer({ name: 'webui-mock-builder', version: '0.1.0' });

server.registerTool(
  'get_part_catalog',
  {
    title: '部品カタログを取得',
    description:
      '画面を組むのに使える部品（type）と、その props・既定値・入れ子のルール、ツリーの書き方を返す。write_screens を使う前に必ず1回読むこと。',
    inputSchema: {},
  },
  () => guard(() => text(`${SPEC_GUIDE}\n# 部品カタログ\n${JSON.stringify(partCatalog())}`)),
);

server.registerTool(
  'get_project',
  {
    title: 'プロジェクトを読む',
    description:
      '現在のUIモック（画面・共通パーツ・遷移・コメント）を読む。人がビルダーで編集した結果もここに反映されている。format: "markdown" は読みやすい仕様書、"json" は write_screens にそのまま書き戻せる構造データ。',
    inputSchema: {
      file: z.string().optional().describe(FILE_DESC),
      format: z.enum(['markdown', 'json']).optional().describe('既定は markdown'),
    },
  },
  ({ file, format }) =>
    guard(() => {
      const { path, project } = load(file);
      if (!project) return text(`${path} はまだありません。write_screens で画面を書き込むと作成されます。`);
      remember(path, project);
      return text(format === 'json' ? toCompactJson(project) : toMarkdown(project));
    }),
);

const nodeSchema = z.record(z.string(), z.any()).describe('ノードのツリー。書き方は get_part_catalog を参照');

server.registerTool(
  'write_screens',
  {
    title: '画面・共通パーツを書き込む',
    description:
      '画面や共通パーツを作成・置き換える。同じ name（または id）のものは丸ごと置き換え、なければ追加する。ファイルがなければ作成する。未知の部品や置けない入れ子があると、何も書き込まずにエラーと直し方を返す。人の編集を上書きしてよい。',
    inputSchema: {
      file: z.string().optional().describe(FILE_DESC),
      screens: z
        .array(
          z.object({
            id: z.string().optional().describe('置き換える既存画面のID（S1 など）。省略時は name で照合'),
            name: z.string(),
            kind: z.enum(['page', 'modal']).optional(),
            description: z.string().optional().describe('画面の目的'),
            comments: z.array(z.string()).optional().describe('画面全体への意図・要件メモ'),
            root: nodeSchema,
          }),
        )
        .optional(),
      components: z
        .array(z.object({ id: z.string().optional(), name: z.string(), root: nodeSchema }))
        .optional()
        .describe('複数の画面で共有する共通パーツの定義'),
      replace_all: z.boolean().optional().describe('true にすると、既存の画面と共通パーツをすべて捨ててから書き込む'),
    },
  },
  ({ file, screens, components, replace_all }) =>
    guard(() => {
      if (!screens?.length && !components?.length) return fail('screens か components を1つ以上指定してください');
      const { path, project } = load(file);
      const res = applySpec(project, { screens, components, replaceAll: replace_all } as SpecInput);
      const note = othersEdits(path, project, [
        ...res.screens.map((s) => `画面${s.replace(/^S\d+/, '')}`),
        ...res.components.map((c) => `共通パーツ${c.replace(/^C\d+/, '')}`),
      ]);
      save(path, res.project);
      const lines = [`${path} に書き込みました。`];
      if (res.screens.length) lines.push(`画面: ${res.screens.join(', ')}`);
      if (res.components.length) lines.push(`共通パーツ: ${res.components.join(', ')}`);
      if (res.warnings.length) lines.push(`\n注意（書き込みは行いましたが、次の指定は無視しました）:\n- ${res.warnings.join('\n- ')}`);
      return text(lines.join('\n') + note + viewHint(path));
    }),
);

server.registerTool(
  'delete_items',
  {
    title: '画面・共通パーツを削除',
    description: '画面や共通パーツを削除する。削除した画面への遷移は外れる。共通パーツを削除すると、使われていた場所は独立したコピーとして残る。',
    inputSchema: {
      file: z.string().optional().describe(FILE_DESC),
      screens: z.array(z.string()).optional().describe('削除する画面のID（S1 など）または名前'),
      components: z.array(z.string()).optional().describe('削除する共通パーツのID（C1 など）または名前'),
    },
  },
  ({ file, screens, components }) =>
    guard(() => {
      const { path, project } = load(file);
      if (!project) return fail(`${path} はまだありません`);
      const res = removeItems(project, { screens, components });
      if (!res.removed.length) return fail('screens か components を1つ以上指定してください');
      const note = othersEdits(path, project);
      save(path, res.project);
      return text(`削除しました: ${res.removed.join(', ')}${note}`);
    }),
);

server.registerTool(
  'update_project',
  {
    title: 'プロジェクト情報を更新',
    description: 'プロジェクト名、アプリの概要、想定画面幅、作るアプリのテーマ要件を更新する。指定した項目だけ変わる。',
    inputSchema: {
      file: z.string().optional().describe(FILE_DESC),
      name: z.string().optional(),
      description: z.string().optional().describe('アプリ全体の概要'),
      viewport: z.enum(['desktop', 'tablet', 'mobile']).optional(),
      appearance: z
        .enum(['light', 'dark', 'system', 'toggle', 'unspecified'])
        .optional()
        .describe(`作るアプリのテーマ要件。${Object.entries(APPEARANCE_LABEL).map(([k, v]) => `${k}=${v}`).join(' / ')} / unspecified=指定なし`),
    },
  },
  ({ file, name, description, viewport, appearance }) =>
    guard(() => {
      const { path, project } = load(file);
      if (!project) return fail(`${path} はまだありません。先に write_screens で画面を書き込んでください`);
      if (name !== undefined && name.trim()) project.name = name;
      if (description !== undefined) {
        if (description) project.description = description;
        else delete project.description;
      }
      if (viewport) project.viewport = viewport as Viewport;
      if (appearance === 'unspecified') delete project.appearance;
      else if (appearance) project.appearance = appearance as Appearance;
      const note = othersEdits(path, load(file).project);
      save(path, project);
      return text(`更新しました: ${project.name}（画面幅 ${project.viewport}、テーマ要件 ${project.appearance ? APPEARANCE_LABEL[project.appearance] : '指定なし'}）${note}`);
    }),
);

server.registerTool(
  'add_comment',
  {
    title: 'コメントを追加',
    description:
      '画面、または識別名（name）の付いた部品にコメントを追加する。人への質問や、設計意図の説明に使う。部品を指定するには、その部品に name を付けておく必要がある。',
    inputSchema: {
      file: z.string().optional().describe(FILE_DESC),
      screen: z.string().describe('画面のID（S1 など）または名前'),
      node: z.string().optional().describe('部品の識別名（name）。省略すると画面全体へのコメント'),
      text: z.string(),
    },
  },
  ({ file, screen, node, text: body }) =>
    guard(() => {
      const { path, project } = load(file);
      if (!project) return fail(`${path} はまだありません`);
      const sc = resolveScreen(project, screen);
      if (!sc) return fail(`画面 "${screen}" が見つかりません。あるのは: ${project.screens.map((s) => `${screenRef(project, s)}「${s.name}」`).join(', ')}`);
      const comment = { id: uid('c'), text: body, createdAt: new Date().toISOString() };
      if (!node) {
        sc.comments = [...(sc.comments ?? []), comment];
      } else {
        // 画面のツリーを先に探し、なければ共通パーツの中を探す
        let hit: UINode | null = null;
        for (const root of [sc.root, ...allRoots(project)]) {
          walkNodes(root, (n) => void (!hit && n.name === node && (hit = n)));
          if (hit) break;
        }
        const target = hit as UINode | null;
        if (!target) return fail(`識別名 "${node}" の部品が見つかりません`);
        target.comments = [...(target.comments ?? []), comment];
      }
      const note = othersEdits(path, load(file).project);
      save(path, project);
      return text(`コメントを追加しました（${node ? `部品 #${node}` : `画面「${sc.name}」`}）${note}`);
    }),
);

await server.connect(new StdioServerTransport());
