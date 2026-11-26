import type { CSSProperties } from 'react';
import type { Props } from '../model/types';
import type { PropField } from './types';

export const containerFields: PropField[] = [
  {
    key: 'direction',
    label: '並べる方向',
    kind: 'select',
    options: [
      { value: 'column', label: '縦 (column)' },
      { value: 'row', label: '横 (row)' },
    ],
  },
  { key: 'gap', label: '間隔 (px)', kind: 'number', min: 0, max: 64 },
  { key: 'padding', label: '内側余白 (px)', kind: 'number', min: 0, max: 64 },
  {
    key: 'align',
    label: '交差軸の揃え',
    kind: 'select',
    options: [
      { value: 'stretch', label: '引き伸ばし' },
      { value: 'start', label: '先頭' },
      { value: 'center', label: '中央' },
      { value: 'end', label: '末尾' },
    ],
  },
  {
    key: 'justify',
    label: '主軸の揃え',
    kind: 'select',
    options: [
      { value: 'start', label: '先頭' },
      { value: 'center', label: '中央' },
      { value: 'end', label: '末尾' },
      { value: 'space-between', label: '両端揃え' },
    ],
  },
  { key: 'wrap', label: '折り返す', kind: 'boolean' },
  { key: 'scroll', label: 'はみ出たらスクロール', kind: 'boolean' },
];

export const containerDefaults: Props = {
  direction: 'column',
  gap: 8,
  padding: 8,
  align: 'stretch',
  justify: 'start',
  wrap: false,
  scroll: false,
};

const alignMap: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };

export function flexStyle(p: Props): CSSProperties {
  return {
    gap: Number(p.gap ?? 8),
    padding: Number(p.padding ?? 8),
    alignItems: alignMap[String(p.align ?? 'stretch')],
    justifyContent: p.justify === 'space-between' ? 'space-between' : alignMap[String(p.justify ?? 'start')],
    flexWrap: p.wrap ? 'wrap' : 'nowrap',
    overflow: p.scroll ? 'auto' : undefined,
  };
}

export function describeFlex(p: Props): string {
  const parts = [p.direction === 'row' ? '横並び' : '縦並び', `gap ${p.gap}px`, `padding ${p.padding}px`];
  if (p.align && p.align !== 'stretch') parts.push(`align ${p.align}`);
  if (p.justify && p.justify !== 'start') parts.push(`justify ${p.justify}`);
  if (p.wrap) parts.push('折り返し');
  if (p.scroll) parts.push('スクロール');
  return parts.join(', ');
}

export const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

/** 決定的な疑似乱数（サンプルデータ用） */
export function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export const opt = (...pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));
