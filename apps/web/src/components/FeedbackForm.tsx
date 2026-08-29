import { FormEvent, useState } from 'react';
import { feedbackApi } from '../api/feedback';
import { apiErrorMessage } from '../api/client';

export function FeedbackForm({ projectId }: { projectId: string }) {
  const [whatHappened, setWhatHappened] = useState('');
  const [whatUserExpected, setWhatUserExpected] = useState('');
  const [whatUserDid, setWhatUserDid] = useState('');
  const [assumptionRef, setAssumptionRef] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await feedbackApi.create(projectId, {
        whatHappened,
        whatUserExpected,
        whatUserDid,
        assumptionRef,
      });
      setWhatHappened('');
      setWhatUserExpected('');
      setWhatUserDid('');
      setAssumptionRef('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800">Log a real-user observation</h3>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">What happened</label>
        <textarea
          required
          rows={2}
          value={whatHappened}
          onChange={(e) => setWhatHappened(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            What the user expected
          </label>
          <textarea
            rows={2}
            value={whatUserExpected}
            onChange={(e) => setWhatUserExpected(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            What the user actually did
          </label>
          <textarea
            rows={2}
            value={whatUserDid}
            onChange={(e) => setWhatUserDid(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Related assumption (optional)
        </label>
        <input
          value={assumptionRef}
          onChange={(e) => setAssumptionRef(e.target.value)}
          placeholder={'e.g. "users check this daily"'}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
      >
        {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save observation'}
      </button>
    </form>
  );
}
