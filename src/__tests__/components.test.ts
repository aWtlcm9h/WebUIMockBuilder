import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../model/sample';
import { countInstances, deleteComponent, detachInstance, findTreeRoot, makeComponent, whyNotComponent } from '../model/components';
import { normalizeProject } from '../model/validate';
import { findNode, walkNodes } from '../model/tree';
import type { Project, UINode } from '../model/types';

const find = (p: Project, pred: (n: UINode) => boolean): UINode => {
  let hit: UINode | null = null;
  for (const s of p.screens) walkNodes(s.root, (n) => void (!hit && pred(n) && (hit = n)));
  return hit!;
};

describe('shared components', () => {
  it('turns a node into a component and leaves an instance in its place', () => {
    const p = createSampleProject();
    const grid = find(p, (n) => n.type === 'grid');
    grid.layout = { width: '600' };
    const refId = makeComponent(p, grid.id, 'KPI')!;
    const comp = p.components!.find((c) => c.name === 'KPI')!;
    expect(comp.root.id).toBe(grid.id);
    expect(comp.root.layout).toEqual({ width: 'fill', height: 'fill' });
    const ref = find(p, (n) => n.id === refId);
    expect(ref.type).toBe('componentRef');
    expect(ref.layout).toEqual({ width: '600' }); // サイズはインスタンス側に残る
    expect(findTreeRoot(p, comp.root.children![0].id)).toBe(comp.root);
    expect(countInstances(p, comp.id)).toBe(1);
  });

  it('refuses roots, component contents and nodes that contain instances', () => {
    const p = createSampleProject();
    expect(whyNotComponent(p, p.screens[0].root.id)).toBeTruthy();
    expect(whyNotComponent(p, p.components![0].root.children![0].id)).toBeTruthy();
    const row = p.screens[0].root.children![1]; // サイドバー（共通パーツ）を含む行
    expect(whyNotComponent(p, row.id)).toBeTruthy();
    expect(makeComponent(p, row.id, 'x')).toBeNull();
  });

  it('detaches one instance into an independent copy', () => {
    const p = createSampleProject();
    const header = p.components![0];
    const ref = p.screens[0].root.children![0];
    const copyId = detachInstance(p, ref.id)!;
    const copy = p.screens[0].root.children![0];
    expect(copy.id).toBe(copyId);
    expect(copy.type).toBe('header');
    expect(copy.id).not.toBe(header.root.id);
    expect(copy.layout).toEqual({ width: 'fill' });
    expect(countInstances(p, header.id)).toBe(1); // もう一方の画面は連動したまま
  });

  it('deletes a component by replacing every instance with a copy', () => {
    const p = createSampleProject();
    const id = p.components![1].id;
    deleteComponent(p, id);
    expect(p.components!.map((c) => c.name)).toEqual(['ヘッダー']);
    expect(countInstances(p, id)).toBe(0);
    expect(p.screens.filter((s) => findNode(s.root, s.root.id) && find({ ...p, screens: [s] }, (n) => n.type === 'sidebar'))).toHaveLength(2);
  });

  it('survives a save/load round trip and drops nested instances', () => {
    const p = createSampleProject();
    const loaded = normalizeProject(JSON.parse(JSON.stringify(p)));
    expect(loaded).toEqual(JSON.parse(JSON.stringify(p)));
    const raw = JSON.parse(JSON.stringify(p));
    raw.components[0].root.children.push({ id: 'x', type: 'componentRef', props: { componentId: raw.components[1].id } });
    const fixed = normalizeProject(raw);
    expect(fixed.components![0].root.children!.some((c) => c.type === 'componentRef')).toBe(false);
  });
});
