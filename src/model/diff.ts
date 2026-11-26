// 2つのプロジェクトの違いを、画面・共通パーツの単位でまとめる（通知用）
import type { Project } from './types';

export interface ChangeSummary {
  added: string[];
  updated: string[];
  removed: string[];
}

export function summarizeChanges(before: Project, after: Project): ChangeSummary {
  const out: ChangeSummary = { added: [], updated: [], removed: [] };
  const compare = <T extends { id: string; name: string }>(a: T[], b: T[], label: (x: T) => string) => {
    const prev = new Map(a.map((x) => [x.id, x]));
    for (const x of b) {
      const old = prev.get(x.id);
      if (!old) out.added.push(label(x));
      else if (JSON.stringify(old) !== JSON.stringify(x)) out.updated.push(label(x));
      prev.delete(x.id);
    }
    for (const x of prev.values()) out.removed.push(label(x));
  };
  compare(before.screens, after.screens, (s) => `画面「${s.name}」`);
  compare(before.components ?? [], after.components ?? [], (c) => `共通パーツ「${c.name}」`);
  const meta = (p: Project) => JSON.stringify([p.name, p.description, p.viewport, p.appearance]);
  if (meta(before) !== meta(after)) out.updated.push('プロジェクト情報');
  return out;
}

export const hasChanges = (c: ChangeSummary) => c.added.length + c.updated.length + c.removed.length > 0;

export function describeChanges(c: ChangeSummary): string {
  const parts: string[] = [];
  if (c.updated.length) parts.push(`${c.updated.join('、')}を更新`);
  if (c.added.length) parts.push(`${c.added.join('、')}を追加`);
  if (c.removed.length) parts.push(`${c.removed.join('、')}を削除`);
  return parts.join(' / ');
}
