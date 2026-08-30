import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { apiErrorMessage } from '../api/client';

type FieldKind = 'string' | 'number' | 'boolean' | 'list' | 'json';

interface DraftField {
  kind: FieldKind;
  text: string;
  bool: boolean;
}

function humanizeKey(key: string): string {
  const spaced = key.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function kindOf(value: unknown): FieldKind {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number')) {
    return 'list';
  }
  return 'json';
}

function PreJson({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-slate-100 p-2 text-xs text-slate-500">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

/** Read-only, human-readable rendering of one output value, recursing (bounded) into arrays/objects. */
function ReadValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined || value === '') {
    return <p className="text-sm italic text-slate-400">—</p>;
  }
  if (typeof value === 'boolean') {
    return (
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
          value ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
        }`}
      >
        {value ? 'Yes' : 'No'}
      </span>
    );
  }
  if (typeof value === 'number') {
    return <p className="text-sm text-slate-700">{value}</p>;
  }
  if (typeof value === 'string') {
    return <p className="whitespace-pre-wrap text-sm text-slate-700">{value}</p>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="text-sm italic text-slate-400">—</p>;
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
          {value.map((v, i) => (
            <li key={i}>{String(v)}</li>
          ))}
        </ul>
      );
    }
    if (depth >= 2) return <PreJson value={value} />;
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-2.5">
            <ReadValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <p className="text-sm italic text-slate-400">—</p>;
    if (depth >= 2) return <PreJson value={value} />;
    return (
      <div className="space-y-1.5 border-l-2 border-slate-200 pl-3">
        {entries.map(([k, v]) => (
          <div key={k}>
            <p className="text-xs font-semibold text-slate-500">{humanizeKey(k)}</p>
            <ReadValue value={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  return <PreJson value={value} />;
}

/**
 * Shows a stage's structured output in a readable form (not a raw JSON dump)
 * and, when the stage is active, lets the user edit it directly rather than
 * only through conversation. Output shapes vary wildly across the 12 stages
 * (a flat brief vs. nested screens/components/data-model arrays), so simple
 * fields (text, number, boolean, a list of strings) get a real editor
 * control, while nested arrays/objects fall back to an editable JSON blob —
 * still far more legible than the previous collapsed raw dump, and still
 * fully editable.
 */
export function StageOutputEditor({
  output,
  editable,
  onSave,
}: {
  output: Record<string, unknown>;
  editable: boolean;
  onSave: (output: Record<string, unknown>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, DraftField>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const keys = Object.keys(output);
  if (keys.length === 0) return null;

  const startEdit = () => {
    const next: Record<string, DraftField> = {};
    for (const [k, v] of Object.entries(output)) {
      const kind = kindOf(v);
      if (kind === 'boolean') next[k] = { kind, text: '', bool: v as boolean };
      else if (kind === 'list') next[k] = { kind, text: (v as unknown[]).map(String).join('\n'), bool: false };
      else if (kind === 'json') next[k] = { kind, text: JSON.stringify(v, null, 2), bool: false };
      else next[k] = { kind, text: String(v), bool: false };
    }
    setDraft(next);
    setFieldErrors({});
    setEditing(true);
  };

  const updateText = (key: string, text: string) =>
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], text } }));
  const updateBool = (key: string, bool: boolean) =>
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], bool } }));
  const removeField = (key: string) =>
    setDraft((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const handleSave = async () => {
    const result: Record<string, unknown> = {};
    const errors: Record<string, string> = {};
    for (const [k, f] of Object.entries(draft)) {
      if (f.kind === 'boolean') {
        result[k] = f.bool;
      } else if (f.kind === 'number') {
        const n = Number(f.text);
        if (f.text.trim() === '' || Number.isNaN(n)) errors[k] = 'Not a valid number.';
        else result[k] = n;
      } else if (f.kind === 'string') {
        result[k] = f.text;
      } else if (f.kind === 'list') {
        result[k] = f.text
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
      } else {
        try {
          result[k] = f.text.trim() === '' ? null : JSON.parse(f.text);
        } catch {
          errors[k] = 'Not valid JSON.';
        }
      }
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    try {
      await onSave(result);
      setEditing(false);
    } catch (err) {
      setFieldErrors({ __global: apiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-medium text-slate-600">Structured output so far</p>
        {editable && !editing && (
          <button
            type="button"
            onClick={startEdit}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-3">
          {keys.map((k) => (
            <div key={k}>
              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {humanizeKey(k)}
              </p>
              <ReadValue value={output[k]} />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(draft).map(([k, f]) => (
            <div key={k}>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {humanizeKey(k)}
                </label>
                <button
                  type="button"
                  onClick={() => removeField(k)}
                  title="Remove field"
                  className="text-slate-300 hover:text-error"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {f.kind === 'boolean' ? (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={f.bool}
                    onChange={(e) => updateBool(k, e.target.checked)}
                  />
                  {f.bool ? 'Yes' : 'No'}
                </label>
              ) : f.kind === 'number' ? (
                <input
                  value={f.text}
                  onChange={(e) => updateText(k, e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              ) : f.kind === 'string' ? (
                <textarea
                  value={f.text}
                  onChange={(e) => updateText(k, e.target.value)}
                  rows={Math.min(6, Math.max(2, f.text.split('\n').length))}
                  className="w-full resize-y rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              ) : f.kind === 'list' ? (
                <>
                  <textarea
                    value={f.text}
                    onChange={(e) => updateText(k, e.target.value)}
                    rows={Math.min(8, Math.max(2, f.text.split('\n').length))}
                    className="w-full resize-y rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <p className="mt-0.5 text-[11px] text-slate-400">One item per line.</p>
                </>
              ) : (
                <>
                  <textarea
                    value={f.text}
                    onChange={(e) => updateText(k, e.target.value)}
                    rows={Math.min(14, Math.max(3, f.text.split('\n').length))}
                    className="w-full resize-y rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    This field holds nested data — edit it as JSON.
                  </p>
                </>
              )}
              {fieldErrors[k] && <p className="mt-0.5 text-xs text-error">{fieldErrors[k]}</p>}
            </div>
          ))}
          {Object.keys(draft).length === 0 && (
            <p className="text-xs text-slate-400">
              No fields left. Cancel to restore them, or save to clear this stage's output.
            </p>
          )}
          {fieldErrors.__global && <p className="text-xs text-error">{fieldErrors.__global}</p>}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
