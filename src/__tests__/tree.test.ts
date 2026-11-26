import { describe, expect, it } from 'vitest';
import { cloneWithNewIds, findParent, insertNode, isDescendant, pathTo, removeNode } from '../model/tree';
import type { UINode } from '../model/types';

const tree = (): UINode => ({
  id: 'root',
  type: 'container',
  props: {},
  children: [
    { id: 'a', type: 'text', props: {} },
    { id: 'b', type: 'container', props: {}, children: [{ id: 'b1', type: 'text', props: {}, comments: [{ id: 'c1', text: 'x', createdAt: '' }] }] },
  ],
});

describe('tree', () => {
  it('finds parents and paths', () => {
    const t = tree();
    expect(findParent(t, 'b1')?.id).toBe('b');
    expect(pathTo(t, 'b1').map((n) => n.id)).toEqual(['root', 'b', 'b1']);
    expect(isDescendant(t, 'b', 'b1')).toBe(true);
    expect(isDescendant(t, 'a', 'b1')).toBe(false);
  });

  it('removes and inserts with clamped index', () => {
    const t = tree();
    const removed = removeNode(t, 'a')!;
    expect(t.children!.map((n) => n.id)).toEqual(['b']);
    insertNode(t, 'b', 99, removed);
    expect(t.children![0].children!.map((n) => n.id)).toEqual(['b1', 'a']);
  });

  it('clones with fresh ids and leaves the source untouched', () => {
    const t = tree();
    const copy = cloneWithNewIds(t.children![1]);
    expect(copy.id).not.toBe('b');
    expect(copy.children![0].id).not.toBe('b1');
    expect(copy.children![0].comments![0].id).not.toBe('c1');
    expect(t.children![1].children![0].id).toBe('b1');
  });
});
