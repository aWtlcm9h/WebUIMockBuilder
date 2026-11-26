import '../parts';
import { createNode } from '../parts/registry';
import { COMPONENT_REF, LINK_BACK, type NodeLayout, type Project, type Props, type Screen, type SharedComponent, type UINode } from './types';
import { uid } from './tree';

interface Extra {
  layout?: NodeLayout;
  link?: string;
  name?: string;
  comment?: string;
}

function n(type: string, props: Props = {}, children?: UINode[], extra: Extra = {}): UINode {
  const node = createNode(type, props);
  if (children) node.children = children;
  if (extra.layout) node.layout = { ...node.layout, ...extra.layout };
  if (extra.link) node.link = { screenId: extra.link };
  if (extra.name) node.name = extra.name;
  if (extra.comment) node.comments = [{ id: uid('c'), text: extra.comment, createdAt: new Date().toISOString() }];
  return node;
}

/** 初回起動時に表示するサンプル（マルチLLMエージェント管理画面） */
export function createSampleProject(): Project {
  const S1 = uid('s');
  const S2 = uid('s');
  const S3 = uid('s');

  // ヘッダーとサイドバーは全ページ共通なので、共通パーツとして1回だけ定義する
  const fill = { width: 'fill', height: 'fill' };
  const headerComp: SharedComponent = {
    id: uid('k'),
    name: 'ヘッダー',
    root: n(
      'header',
      { title: 'Multi-Agent Console' },
      [
        n('input', { label: '', placeholder: 'タスク・エージェントを検索', inputType: 'search' }, undefined, { layout: { width: '260' } }),
        n('icon', { name: '通知' }),
        n('avatar', { name: 'Admin', showName: false }),
      ],
      { layout: fill },
    ),
  };
  const sidebarComp: SharedComponent = {
    id: uid('k'),
    name: 'サイドバー',
    root: n(
      'sidebar',
      { padding: 8 },
      [
        n(
          'navMenu',
          {},
          [
            // 選択中の見た目は、遷移先が表示中の画面かどうかで自動的に切り替わる
            n('navItem', { label: 'ダッシュボード' }, undefined, { link: S1 }),
            n('navItem', { label: 'エージェント', badge: '3' }, undefined, { link: S2 }),
            n('navItem', { label: 'ワークフロー' }),
            n('navItem', { label: '設定' }),
          ],
          { name: 'mainNav' },
        ),
      ],
      { layout: fill },
    ),
  };
  const header = () => n(COMPONENT_REF, { componentId: headerComp.id }, undefined, { layout: { width: 'fill' } });
  const sidebar = () => n(COMPONENT_REF, { componentId: sidebarComp.id }, undefined, { layout: { width: '240', height: 'fill' } });

  const dashboard: Screen = {
    id: S1,
    name: 'ダッシュボード',
    kind: 'page',
    description: '全エージェントの稼働状況とコストを俯瞰するトップ画面',
    root: n('container', { direction: 'column', gap: 0, padding: 0 }, [
      header(),
      n('container', { direction: 'row', gap: 0, padding: 0 }, [
        sidebar(),
        n(
          'container',
          { direction: 'column', gap: 12, padding: 16 },
          [
            n('container', { direction: 'row', padding: 0, align: 'center' }, [
              n('heading', { text: 'ダッシュボード', level: '1' }),
              n('spacer'),
              n('button', { label: '新規エージェント', icon: true }, undefined, { link: S3 }),
            ]),
            n(
              'grid',
              { columns: 4, padding: 0 },
              [
                n('kpi', { label: '稼働中エージェント', value: '5', delta: '+2' }),
                n('kpi', { label: '完了タスク (24h)', value: '128', delta: '+18%' }),
                n('kpi', { label: 'トークン (24h)', value: '1.2M', delta: '-4%', sparkline: true }),
                n('kpi', { label: 'コスト (24h)', value: '$14.20', delta: '+3%', sparkline: true }),
              ],
              { name: 'kpiRow' },
            ),
            n(
              'tabs',
              {},
              [
                n('tabPanel', { label: '概要', direction: 'row' }, [
                  n('chart', { title: 'エージェント別トークン推移', series: ['Planner', 'Coder', 'Reviewer'], yLabel: 'トークン数' }, undefined, {
                    layout: { width: 'fill' },
                  }),
                  n('chart', { title: 'モデル別コスト比率', chartType: 'donut', series: ['コスト'] }, undefined, { layout: { width: '320' } }),
                ]),
                n('tabPanel', { label: '実行ログ', direction: 'row' }, [
                  n('timeline', {}, undefined, { layout: { width: 'fill' } }),
                  n('logViewer', {}, undefined, { layout: { width: 'fill', height: '220' } }),
                ]),
                n('tabPanel', { label: 'ワークフロー' }, [n('workflowGraph')]),
              ],
              { name: 'overviewTabs', comment: 'タブの選択状態はURLのクエリ(?tab=)に保持して、リロードしても維持したい', layout: { width: 'fill' } },
            ),
          ],
          { layout: { width: 'fill' } },
        ),
      ], { layout: { height: 'fill' } }),
    ]),
  };

  const agents: Screen = {
    id: S2,
    name: 'エージェント',
    kind: 'page',
    description: 'エージェントとの対話と、各エージェントの状態確認',
    root: n('container', { direction: 'column', gap: 0, padding: 0 }, [
      header(),
      n('container', { direction: 'row', gap: 0, padding: 0 }, [
        sidebar(),
        n(
          'container',
          { direction: 'column', gap: 8, padding: 16 },
          [
            n('chatView', {}, undefined, {
              layout: { height: 'fill' },
              name: 'conversation',
              comment: '新しいメッセージが来たら最下部へ自動スクロール。ユーザーが上にスクロール中は追従しない',
            }),
            n('approval'),
            n('chatInput'),
          ],
          { layout: { width: 'fill' } },
        ),
        n(
          'sidebar',
          { title: 'エージェント', gap: 8 },
          [
            n('agentCard', { name: 'Planner', role: 'タスク分解', status: 'done' }),
            n('agentCard', { name: 'Coder', role: '実装', status: 'running' }),
            n('agentCard', { name: 'Reviewer', role: 'レビュー', status: 'waiting' }),
            n('usageMeter'),
          ],
          { layout: { width: '300' } },
        ),
      ], { layout: { height: 'fill' } }),
    ]),
  };

  const createModal: Screen = {
    id: S3,
    name: 'エージェント作成',
    kind: 'modal',
    description: '新しいエージェントを登録するモーダル',
    root: n(
      'container',
      { direction: 'column', gap: 12, padding: 16 },
      [
        n('heading', { text: '新規エージェント', level: '2' }),
        n('input', { label: '名前', placeholder: '例: Researcher', required: true }),
        n('select', { label: 'モデル', options: ['LLM-A', 'LLM-B', 'LLM-C'] }),
        n('textarea', { label: 'システムプロンプト', placeholder: '役割や制約を記述' }),
        n('toggle', { label: 'ツール実行に承認を必須にする', checked: true }),
        n('container', { direction: 'row', padding: 0, justify: 'end' }, [
          n('button', { label: 'キャンセル', variant: 'secondary' }, undefined, { link: LINK_BACK }),
          n('button', { label: '作成' }, undefined, { link: S2 }),
        ]),
      ],
      { layout: { width: '520', height: 'auto' } },
    ),
  };

  // 画面ルートは画面いっぱいに広げる
  dashboard.root.layout = { width: 'fill', height: 'fill' };
  agents.root.layout = { width: 'fill', height: 'fill' };

  return {
    format: 'webui-mock',
    version: 1,
    name: 'マルチエージェント管理UI（サンプル）',
    description: '複数のLLMエージェントを協調させて自律的にタスクを処理するアプリの管理画面',
    viewport: 'desktop',
    screens: [dashboard, agents, createModal],
    components: [headerComp, sidebarComp],
  };
}
