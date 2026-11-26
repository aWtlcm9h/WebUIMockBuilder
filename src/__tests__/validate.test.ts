import { describe, expect, it } from 'vitest';
import { normalizeProject } from '../model/validate';
import { createSampleProject } from '../model/sample';
import { LINK_BACK } from '../model/types';

const base = (root: unknown) => ({ format: 'webui-mock', version: 1, name: 'p', viewport: 'desktop', screens: [{ id: 's1', name: 'A', kind: 'page', root }] });

describe('normalizeProject', () => {
  it('rejects data that is not a project', () => {
    expect(() => normalizeProject({ foo: 1 })).toThrow();
    expect(() => normalizeProject(null)).toThrow();
    expect(() => normalizeProject({ format: 'webui-mock', version: 2, screens: [] })).toThrow();
    expect(() => normalizeProject(base(null))).toThrow();
  });

  it('keeps a valid project unchanged', () => {
    const p = createSampleProject();
    expect(normalizeProject(JSON.parse(JSON.stringify(p)))).toEqual(JSON.parse(JSON.stringify(p)));
  });

  it('keeps a valid theme requirement and drops an unknown one', () => {
    const p = JSON.parse(JSON.stringify(createSampleProject()));
    expect(normalizeProject({ ...p, appearance: 'system' }).appearance).toBe('system');
    expect(normalizeProject({ ...p, appearance: 'neon' }).appearance).toBeUndefined();
  });

  it('repairs nodes that would crash rendering', () => {
    const p = normalizeProject(
      base({
        id: 'r',
        type: 'container',
        children: [
          { type: 'text' }, // props も id もない
          { id: 'r', type: 'button', props: { label: 'x', bad: { nested: 1 } }, link: { screenId: 'missing' } }, // ID重複・壊れたリンク
          { id: 'k', type: 'button', props: {}, link: { screenId: LINK_BACK } },
          'garbage',
        ],
      }),
    );
    const kids = p.screens[0].root.children!;
    expect(kids).toHaveLength(3);
    expect(kids[0].props).toEqual({});
    expect(kids[0].id).toBeTruthy();
    expect(kids[1].id).not.toBe('r');
    expect(kids[1].props).toEqual({ label: 'x' });
    expect(kids[1].link).toBeUndefined();
    expect(kids[2].link).toEqual({ screenId: LINK_BACK });
  });
});
