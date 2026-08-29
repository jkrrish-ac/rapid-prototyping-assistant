import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Bot, Cpu, Send, User as UserIcon } from 'lucide-react';
import { stagesApi } from '../api/stages';
import { apiErrorMessage } from '../api/client';
import { STAGE_LABELS } from '../types';
import type { LifecycleStage, Project, StageDoc } from '../types';
import { FeedbackForm } from './FeedbackForm';

const MODEL_BADGE: Record<string, string> = {
  opus: 'bg-indigo-100 text-indigo-700',
  sonnet: 'bg-sky-100 text-sky-700',
};

export function StagePanel({
  project,
  stage,
  isActiveStage,
  onAdvanced,
  onDecisionLogged,
}: {
  project: Project;
  stage: LifecycleStage;
  isActiveStage: boolean;
  onAdvanced: () => void;
  onDecisionLogged: () => void;
}) {
  const [doc, setDoc] = useState<StageDoc | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const d = await stagesApi.get(project._id, stage);
    setDoc(d);
  };

  useEffect(() => {
    setError('');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project._id, stage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [doc?.conversation?.length]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await stagesApi.postMessage(project._id, stage, message);
      setMessage('');
      setDoc(result.stage);
      if (result.decisionsCreated.length) onDecisionLogged();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onAdvance = async () => {
    setAdvancing(true);
    setError('');
    try {
      await stagesApi.advance(project._id, stage);
      onAdvanced();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setAdvancing(false);
    }
  };

  if (!doc) {
    return <div className="p-6 text-sm text-slate-500">Loading stage…</div>;
  }

  // Defensive: older/partial stage docs (or a stage that errored mid-turn on
  // the backend before `output`/`conversation` were persisted) can come back
  // without these fields. Never let a missing field crash the panel.
  const conversation = doc.conversation ?? [];
  const output = doc.output ?? {};

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div>
          <h2 className="font-semibold text-slate-900">{STAGE_LABELS[stage]}</h2>
          <p className="text-xs text-slate-400">
            {doc.status === 'complete'
              ? 'Completed — read-only'
              : isActiveStage
                ? 'Active stage'
                : 'Not started yet'}
          </p>
        </div>
        {doc.lastModelUsed && (
          <span
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${MODEL_BADGE[doc.lastModelUsed]}`}
          >
            <Cpu size={12} /> {doc.lastModelUsed}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {conversation.length === 0 && (
          <p className="text-sm text-slate-400">
            {stage === 'IDEA'
              ? 'Describe your idea in any form — a sentence, a ramble, whatever you have.'
              : 'Send a message to get started on this stage.'}
          </p>
        )}
        <ul className="space-y-4">
          {conversation.map((c, i) => (
            <li key={i} className={`flex gap-2 ${c.role === 'user' ? 'justify-end' : ''}`}>
              {c.role === 'assistant' && (
                <Bot size={18} className="mt-1 shrink-0 text-primary" />
              )}
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-3.5 py-2 text-sm ${
                  c.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {c.content}
              </div>
              {c.role === 'user' && <UserIcon size={18} className="mt-1 shrink-0 text-slate-400" />}
            </li>
          ))}
        </ul>
        <div ref={bottomRef} />

        {stage === 'REAL_USERS' && isActiveStage && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <FeedbackForm projectId={project._id} />
          </div>
        )}

        {Object.keys(output).length > 0 && (
          <details className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <summary className="cursor-pointer font-medium text-slate-600">
              Structured output so far
            </summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-slate-500">
              {JSON.stringify(output, null, 2)}
            </pre>
          </details>
        )}
      </div>

      {error && <p className="px-5 pb-2 text-sm text-error">{error}</p>}

      {isActiveStage && doc.status !== 'complete' && (
        <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-slate-200 p-3">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={busy || !message.trim()}
            className="flex items-center gap-1 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
          >
            <Send size={14} /> {busy ? 'Thinking…' : 'Send'}
          </button>
          {doc.readyToAdvance && (
            <button
              type="button"
              onClick={onAdvance}
              disabled={advancing}
              className="flex items-center gap-1 rounded-lg bg-success px-3.5 py-2 text-sm font-medium text-success-foreground hover:opacity-90 disabled:opacity-50"
            >
              {advancing ? 'Advancing…' : 'Advance'} <ArrowRight size={14} />
            </button>
          )}
        </form>
      )}
    </div>
  );
}
