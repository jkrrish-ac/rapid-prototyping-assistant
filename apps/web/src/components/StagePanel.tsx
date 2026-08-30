import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Bot, Check, Cpu, Send, Sparkles, User as UserIcon } from 'lucide-react';
import { stagesApi } from '../api/stages';
import { apiErrorMessage } from '../api/client';
import { STAGE_LABELS } from '../types';
import type { LifecycleStage, Project, StageDoc } from '../types';
import { FeedbackForm } from './FeedbackForm';
import { StageOutputEditor } from './StageOutputEditor';

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
  const [kickingOff, setKickingOff] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState('');
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const kickoffKeyRef = useRef<string>('');

  const load = async () => {
    const d = await stagesApi.get(project._id, stage);
    setDoc(d);
    return d;
  };

  useEffect(() => {
    setError('');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project._id, stage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [doc?.conversation?.length]);

  // A fresh set of choices arriving from the server (new turn) always
  // replaces whatever was selected from the previous set.
  useEffect(() => {
    setSelectedChoiceIds(new Set());
  }, [doc?.pendingChoices]);

  // Auto-grow the message textarea, Claude-chat style, instead of scrolling
  // inside a fixed-height single-line input.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [message]);

  // Auto-kickoff: as soon as a stage becomes the active stage with no
  // conversation yet, ask the AI to propose its own first analysis / choices
  // instead of leaving the user staring at a blank "type a message" box.
  // IDEA stays pure free-text capture — nothing to suggest before the user
  // has described anything. Keyed per project+stage so it never re-fires for
  // the same stage after it has run once.
  useEffect(() => {
    if (!doc) return;
    const key = `${project._id}:${stage}`;
    if (
      stage !== 'IDEA' &&
      isActiveStage &&
      doc.status !== 'complete' &&
      (doc.conversation?.length ?? 0) === 0 &&
      kickoffKeyRef.current !== key
    ) {
      kickoffKeyRef.current = key;
      setKickingOff(true);
      setError('');
      stagesApi
        .kickoff(project._id, stage)
        .then((result) => {
          setDoc(result.stage);
          if (result.decisionsCreated.length) onDecisionLogged();
        })
        .catch((err) => setError(apiErrorMessage(err)))
        .finally(() => setKickingOff(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, isActiveStage, stage, project._id]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await stagesApi.postMessage(project._id, stage, text);
      setMessage('');
      setDoc(result.stage);
      if (result.decisionsCreated.length) onDecisionLogged();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await sendMessage(message);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter inserts a newline — same convention as
    // Claude's own chat input.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(message);
    }
  };

  const toggleChoice = (id: string) => {
    setSelectedChoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onConfirmChoices = async () => {
    if (!doc) return;
    const labels = (doc.pendingChoices ?? [])
      .filter((c) => selectedChoiceIds.has(c.id))
      .map((c) => c.label);
    if (labels.length === 0) return;
    setSelectedChoiceIds(new Set());
    await sendMessage(labels.length === 1 ? labels[0] : `Selected: ${labels.join(', ')}`);
  };

  const onSaveOutput = async (output: Record<string, unknown>) => {
    const updated = await stagesApi.updateOutput(project._id, stage, output);
    setDoc(updated);
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
  const pendingChoices = doc.pendingChoices ?? [];

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
          <p className="flex items-center gap-2 text-sm text-slate-400">
            {stage === 'IDEA' ? (
              'Describe your idea in any form — a sentence, a ramble, whatever you have.'
            ) : kickingOff ? (
              <>
                <Sparkles size={14} className="animate-pulse text-primary" />
                Thinking through this stage…
              </>
            ) : (
              'Send a message to get started on this stage.'
            )}
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

        {isActiveStage && doc.status !== 'complete' && pendingChoices.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              <Sparkles size={12} /> Pick any that apply, or type your own message below
            </p>
            <div className="flex flex-wrap gap-2">
              {pendingChoices.map((choice) => {
                const selected = selectedChoiceIds.has(choice.id);
                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={busy}
                    onClick={() => toggleChoice(choice.id)}
                    aria-pressed={selected}
                    className={`flex max-w-full items-start gap-2 rounded-xl border px-3.5 py-2 text-left text-sm font-medium transition disabled:opacity-50 ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-primary/30 bg-primary/5 text-primary hover:border-primary hover:bg-primary/10'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        selected ? 'border-primary-foreground bg-primary-foreground/20' : 'border-primary/40'
                      }`}
                    >
                      {selected && <Check size={11} />}
                    </span>
                    <span>
                      <span className="block">{choice.label}</span>
                      {choice.detail && (
                        <span
                          className={`mt-0.5 block text-xs font-normal ${
                            selected ? 'text-primary-foreground/80' : 'text-slate-500'
                          }`}
                        >
                          {choice.detail}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedChoiceIds.size > 0 && (
              <button
                type="button"
                onClick={onConfirmChoices}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg bg-success px-3.5 py-2 text-sm font-medium text-success-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Check size={14} /> Confirm {selectedChoiceIds.size > 1 ? `${selectedChoiceIds.size} selections` : 'selection'}
              </button>
            )}
          </div>
        )}

        {stage === 'REAL_USERS' && isActiveStage && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <FeedbackForm projectId={project._id} />
          </div>
        )}

        <StageOutputEditor
          output={output}
          editable={isActiveStage && doc.status !== 'complete'}
          onSave={onSaveOutput}
        />
      </div>

      {error && <p className="px-5 pb-2 text-sm text-error">{error}</p>}

      {isActiveStage && doc.status !== 'complete' && (
        <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-slate-200 p-3">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              pendingChoices.length > 0
                ? 'Or type your own reply… (Enter to send, Shift+Enter for a new line)'
                : 'Type your message… (Enter to send, Shift+Enter for a new line)'
            }
            disabled={kickingOff}
            rows={1}
            className="max-h-[200px] flex-1 resize-none overflow-y-auto rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={busy || kickingOff || !message.trim()}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
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
