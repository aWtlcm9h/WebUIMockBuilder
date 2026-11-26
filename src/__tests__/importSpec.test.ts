import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../model/sample';
import { toCompactJson, toMarkdown } from '../export/agentSpec';
import { applySpec, removeItems, SpecError, type SpecInput } from '../export/importSpec';
import { partCatalog } from '../export/catalog';
import { normalizeProject } from '../model/validate';
import { LINK_BACK } from '../model/types';

const box = (children: unknown[]) => ({ type: 'container', children });

describe('applySpec', () => {
  it('rebuilds the same project from its own compact JSON', () => {
    const p = createSampleProject();
    const spec = JSON.parse(toCompactJson(p)) as SpecInput;
    const res = applySpec(null, { screens: spec.screens, components: spec.components });
    expect(res.warnings).toEqual([]);
    res.project.name = p.name;
    res.project.description = p.description;
    expect(toMarkdown(res.project)).toBe(toMarkdown(p));
    // 保存形式としても正しい
    expect(normalizeProject(JSON.parse(JSON.stringify(res.project)))).toEqual(JSON.parse(JSON.stringify(res.project)));
  });

  it('rejects unknown parts and invalid nesting without writing anything', () => {
    const base = createSampleProject();
    const before = JSON.stringify(base);
    const bad = { screens: [{ name: 'X', root: box([{ type: 'nope' }, { type: 'tabs', children: [{ type: 'button' }] }, { type: 'tabPanel' }]) }] } as SpecInput;
    expect(() => applySpec(base, bad)).toThrow(SpecError);
    try {
      applySpec(base, bad);
    } catch (e) {
      expect((e as SpecError).messages).toHaveLength(3);
    }
    expect(JSON.stringify(base)).toBe(before);
  });

  it('ignores bad props with warnings and keeps defaults', () => {
    const res = applySpec(null, {
      screens: [{ name: 'A', root: box([{ type: 'button', props: { label: 'OK', variant: 'huge', nope: 1, disabled: 'yes' }, size: { w: 'wide', h: 40 } }]) }],
    } as SpecInput);
    const btn = res.project.screens[0].root.children![0];
    expect(btn.props).toMatchObject({ label: 'OK', variant: 'primary', disabled: false });
    expect(btn.layout).toEqual({ height: '40' });
    expect(res.warnings).toHaveLength(4);
  });

  it('replaces a screen by name, keeps its id, and resolves links in one call', () => {
    const base = createSampleProject();
    const id = base.screens[1].id;
    const res = applySpec(base, {
      screens: [
        { name: 'エージェント', root: box([{ type: 'button', props: { label: '新規' }, onClick: { navigate: '新しい画面' } }, { type: 'button', onClick: { action: 'close' } }]) },
        { name: '新しい画面', kind: 'modal', root: box([{ type: 'text' }]) },
      ],
    } as SpecInput);
    expect(res.project.screens).toHaveLength(4);
    const replaced = res.project.screens[1];
    expect(replaced.id).toBe(id); // 他の画面からの遷移が切れない
    expect(replaced.root.children![0].link).toEqual({ screenId: res.project.screens[3].id });
    expect(replaced.root.children![1].link).toEqual({ screenId: LINK_BACK });
    expect(res.project.screens[3].root.layout).toEqual({ width: '520', height: 'auto' });
  });

  it('defines and places shared components, and forbids nesting them', () => {
    const res = applySpec(null, {
      components: [{ name: 'ヘッダー', root: { type: 'header', props: { title: 'T' } } }],
      screens: [{ name: 'A', root: box([{ type: 'componentRef', component: 'ヘッダー', size: { w: 'fill' } }]) }],
    } as SpecInput);
    const comp = res.project.components![0];
    expect(res.project.screens[0].root.children![0].props.componentId).toBe(comp.id);
    expect(() =>
      applySpec(res.project, { components: [{ name: '入れ子', root: box([{ type: 'componentRef', component: 'C1' }]) }] } as SpecInput),
    ).toThrow(SpecError);
  });

  it('gives tabs default panels when none are given, and wraps non-container roots', () => {
    const res = applySpec(null, { screens: [{ name: 'A', root: { type: 'tabs' } }] } as SpecInput);
    const root = res.project.screens[0].root;
    expect(root.type).toBe('container');
    expect(root.children![0].children).toHaveLength(2);
  });
});

describe('removeItems', () => {
  it('removes screens, unlinks transitions, and keeps at least one screen', () => {
    const p = createSampleProject();
    const res = removeItems(p, { screens: ['エージェント作成'] });
    expect(res.project.screens).toHaveLength(2);
    expect(JSON.stringify(res.project)).not.toContain(p.screens[2].id);
    expect(() => removeItems(p, { screens: ['S1', 'S2', 'S3'] })).toThrow(SpecError);
    expect(() => removeItems(p, { screens: ['ない画面'] })).toThrow(SpecError);
  });
});

describe('partCatalog', () => {
  it('lists every placeable part with its props and nesting rules', () => {
    const cat = partCatalog();
    expect(cat.find((c) => c.type === 'componentRef')).toBeUndefined();
    expect(cat.find((c) => c.type === 'tabPanel')!.onlyInside).toEqual(['tabs']);
    const chart = cat.find((c) => c.type === 'chart')!;
    expect(chart.props.find((f) => f.key === 'chartType')!.options).toContain('donut');
    expect(chart.defaultSize).toEqual({ height: '260' });
  });
});

describe('summarizeChanges', () => {
  it('reports which screens and components changed', async () => {
    const { summarizeChanges, describeChanges, hasChanges } = await import('../model/diff');
    const a = createSampleProject();
    expect(hasChanges(summarizeChanges(a, structuredClone(a)))).toBe(false);
    const b = structuredClone(a);
    b.screens[0].name = 'トップ';
    b.screens.pop();
    b.components![0].root.props.title = 'X';
    b.screens.push({ ...structuredClone(a.screens[1]), id: 's_new', name: '追加' });
    const c = summarizeChanges(a, b);
    expect(c.updated).toEqual(['画面「トップ」', '共通パーツ「ヘッダー」']);
    expect(c.added).toEqual(['画面「追加」']);
    expect(c.removed).toEqual(['画面「エージェント作成」']);
    expect(describeChanges(c)).toContain('画面「追加」を追加');
  });
});
