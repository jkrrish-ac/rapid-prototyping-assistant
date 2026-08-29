import { useEffect, useState } from 'react';
import { X, GitBranch } from 'lucide-react';
import { decisionsApi } from '../api/decisions';
import type { Decision } from '../types';
import { STAGE_LABELS } from '../types';

export function DecisionLogDrawer({
  projectId,
  open,
  onClose,
  refreshKey,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  refreshKey: number;
}) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    decisionsApi
      .list(projectId)
      .then(setDecisions)
      .finally(() => setLoading(false));
  }, [projectId, open, refreshKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <GitBranch size={18} className="text-primary" />
            <h2 className="font-semibold text-slate-900">Decision Log</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : decisions.length === 0 ? (
            <p className="text-sm text-slate-500">
              No decisions logged yet. They'll appear here as each stage progresses.
            </p>
          ) : (
            <ul className="space-y-4">
              {decisions.map((d) => (
                <li
                  key={d._id}
                  className={`rounded-lg border p-3 text-sm ${
                    d.status === 'SUPERSEDED'
                      ? 'border-slate-200 bg-slate-50 opacity-70'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">
                      {d.decisionId}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        {d.model}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {STAGE_LABELS[d.stage]}
                      </span>
                    </div>
                  </div>
                  <p className="mb-1 font-medium text-slate-800">{d.decision}</p>
                  {d.rationale && (
                    <p className="text-xs text-slate-500">
                      <span className="font-medium">Why: </span>
                      {d.rationale}
                    </p>
                  )}
                  {d.status === 'SUPERSEDED' && (
                    <p className="mt-1 text-xs italic text-slate-400">
                      Superseded by {d.supersededBy}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
