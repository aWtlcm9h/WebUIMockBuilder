import type { PropValue } from '../model/types';
import type { PropField } from '../parts/types';

export function FieldInput({ field, value, onChange }: { field: PropField; value: PropValue | undefined; onChange: (v: PropValue) => void }) {
  switch (field.kind) {
    case 'text':
      return <input className="f-input" value={String(value ?? '')} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case 'textarea':
      return <textarea className="f-input" rows={field.rows ?? 3} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return (
        <input
          className="f-input"
          type="number"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={Number(value ?? 0)}
          onChange={(e) => {
            // 入力途中の値を壊さないよう、上限だけ即時に、下限はフォーカスが外れたときに適用する
            const n = e.target.value === '' ? 0 : Number(e.target.value);
            onChange(field.max !== undefined ? Math.min(field.max, n) : n);
          }}
          onBlur={(e) => {
            const n = Number(e.target.value) || 0;
            if (field.min !== undefined && n < field.min) onChange(field.min);
          }}
        />
      );
    case 'boolean':
      return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
    case 'select':
      return (
        <select className="f-input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'list':
      return (
        <textarea
          className="f-input"
          rows={Math.min(8, Math.max(2, (Array.isArray(value) ? value.length : 0) + 1))}
          value={Array.isArray(value) ? value.join('\n') : ''}
          placeholder={field.hint}
          onChange={(e) => onChange(e.target.value.split('\n'))}
          onBlur={(e) => onChange(e.target.value.split('\n').filter((l) => l.trim() !== ''))}
        />
      );
  }
}

export function Row({ label, children, inline }: { label: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <label className={`f-row ${inline ? 'inline' : ''}`}>
      <span className="f-label">{label}</span>
      {children}
    </label>
  );
}

const SIZE_MODES = [
  { value: 'auto', label: '内容に合わせる' },
  { value: 'fill', label: '残りを埋める' },
  { value: 'px', label: '固定 (px)' },
  { value: 'pct', label: '割合 (%)' },
];

export function SizeInput({ value, onChange }: { value: string | undefined; onChange: (v: string) => void }) {
  const v = value ?? 'auto';
  const mode = v === 'auto' || v === 'fill' ? v : v.endsWith('%') ? 'pct' : 'px';
  const num = mode === 'px' ? Number(v) : mode === 'pct' ? Number(v.slice(0, -1)) : 0;
  return (
    <div className="f-size">
      <select
        className="f-input"
        value={mode}
        onChange={(e) => {
          const m = e.target.value;
          onChange(m === 'auto' || m === 'fill' ? m : m === 'px' ? '200' : '50%');
        }}
      >
        {SIZE_MODES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {(mode === 'px' || mode === 'pct') && (
        <input
          className="f-input num"
          type="number"
          min={0}
          value={num}
          onChange={(e) => onChange(mode === 'px' ? String(Number(e.target.value)) : `${Number(e.target.value)}%`)}
        />
      )}
    </div>
  );
}
