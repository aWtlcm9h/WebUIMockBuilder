import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../model/sample';
import { toCompactJson, toMarkdown } from '../export/agentSpec';
import { walkNodes } from '../model/tree';
import type { UINode } from '../model/types';

describe('toMarkdown', () => {
  it('lists screens, transitions and comments', () => {
    const md = toMarkdown(createSampleProject());
    expect(md).toContain('## 画面遷移');
    expect(md).toContain('S1 -->|"ボタン「新規エージェント」"| S3');
    expect(md).not.toMatch(/S1 -->\|[^|]*\| S1/); // 自画面への遷移は図に出さない
    expect(md).toContain('💬');
    expect(md).toContain('クリックで閉じる');
  });

  it('writes shared components once and keeps transitions that live inside them', () => {
    const md = toMarkdown(createSampleProject());
    expect(md).toContain('### C1: ヘッダー（2か所で使用）');
    expect(md.match(/ヘッダー（タイトル「Multi-Agent Console」/g)).toHaveLength(1);
    expect(md).toContain('共通パーツ C2「サイドバー」を配置');
    // サイドバー（共通パーツ）の中のメニューからの遷移
    expect(md).toContain('S1 -->|"メニュー項目「エージェント」"| S2');
    expect(md).toContain('S2 -->|"メニュー項目「ダッシュボード」"| S1');
  });

  it('states the app theme requirement only when it is set', () => {
    const p = createSampleProject();
    expect(toMarkdown(p)).not.toContain('テーマ要件');
    p.appearance = 'toggle';
    expect(toMarkdown(p)).toContain('テーマ要件: ライト/ダーク両対応（OSの設定に追従＋画面内の切り替えボタン）');
    expect(JSON.parse(toCompactJson(p)).app.appearance).toBe('toggle');
  });

  it('keeps one node per line even with multi-line or special text', () => {
    const p = createSampleProject();
    p.screens[0].name = 'A "quoted" | name';
    p.screens[0].description = 'line1\nline2 | pipe';
    const approval = p.screens[1].root.children![1].children![1].children!.find((n) => n.type === 'approval')!;
    approval.props.detail = '1行目\n2行目';
    const md = toMarkdown(p);
    expect(md).toContain('1行目 / 2行目');
    const tableRow = md.split('\n').find((l) => l.startsWith('| S1 |'))!;
    expect(tableRow.replace(/\\\|/g, '').split('|')).toHaveLength(6); // 4列のまま
    const mermaid = md.slice(md.indexOf('```mermaid'), md.indexOf('```', md.indexOf('```mermaid') + 3));
    expect(mermaid).not.toContain('"quoted"');
    // ツリー行はすべて「- 」で始まる
    const s2 = md.slice(md.indexOf('## S2:'), md.indexOf('## S3:'));
    for (const line of s2.split('\n').slice(2)) if (line.trim()) expect(line.trim().startsWith('- ')).toBe(true);
  });
});

describe('toCompactJson', () => {
  it('can be expanded back to the full props using partDefaults', () => {
    const p = createSampleProject();
    const spec = JSON.parse(toCompactJson(p));
    const flat = (n: UINode, out: UINode[] = []) => {
      walkNodes(n, (x) => void out.push(x));
      return out;
    };
    const flatCompact = (n: any, out: any[] = []): any[] => {
      out.push(n);
      (n.children ?? []).forEach((c: any) => flatCompact(c, out));
      return out;
    };
    p.screens.forEach((s, i) => {
      const full = flat(s.root);
      const compact = flatCompact(spec.screens[i].root);
      expect(compact).toHaveLength(full.length);
      full.forEach((node, j) => {
        if (node.type === 'componentRef') {
          expect(compact[j].component).toMatch(/^C\d+$/);
          return;
        }
        expect(spec.partDefaults[node.type]).toBeDefined();
        expect({ ...spec.partDefaults[node.type], ...(compact[j].props ?? {}) }).toEqual(node.props);
      });
    });
  });

  it('defines each shared component once and references it from screens', () => {
    const p = createSampleProject();
    const spec = JSON.parse(toCompactJson(p));
    expect(spec.components.map((c: any) => c.id)).toEqual(['C1', 'C2']);
    expect(spec.components[0].root.type).toBe('header');
    const json = JSON.stringify(spec.screens);
    expect(json).not.toContain('"type":"header"'); // 画面側には中身を繰り返さない
    expect(json.match(/"component":"C1"/g)).toHaveLength(2);
  });

  it('maps links to screen ids and the close action', () => {
    const json = toCompactJson(createSampleProject());
    expect(json).toContain('"navigate": "S3"');
    expect(json).toContain('"action": "close"');
  });
});
