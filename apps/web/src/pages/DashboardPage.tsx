import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, LogOut, Trash2, X } from 'lucide-react';
import { projectsApi } from '../api/projects';
import { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Project } from '../types';
import { STAGE_LABELS } from '../types';

const STAGE_BADGE_COLOR: Record<string, string> = {
  IDEA: 'bg-slate-100 text-slate-700',
  UNDERSTAND: 'bg-violet-100 text-violet-700',
  IDEATE: 'bg-violet-100 text-violet-700',
  DECIDE: 'bg-violet-100 text-violet-700',
  DESIGN: 'bg-indigo-100 text-indigo-700',
  BUILD: 'bg-sky-100 text-sky-700',
  TEST: 'bg-sky-100 text-sky-700',
  FIX: 'bg-amber-100 text-amber-700',
  SHIP: 'bg-emerald-100 text-emerald-700',
  REAL_USERS: 'bg-emerald-100 text-emerald-700',
  FEEDBACK: 'bg-violet-100 text-violet-700',
  ITERATE: 'bg-violet-100 text-violet-700',
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setProjects(await projectsApi.list());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles size={20} />
            <span className="font-semibold text-slate-900">Rapid Prototype Assistant</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{user?.name}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
            >
              <LogOut size={16} /> Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">My Projects</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
          >
            <Plus size={16} /> Create New Project
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-error">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-500">Loading projects…</p>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="mb-1 font-medium text-slate-700">No projects yet</p>
            <p className="mb-4 text-sm text-slate-500">
              Start with a rough idea — the lifecycle takes it from there.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div
                key={p._id}
                className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <button
                  type="button"
                  title="Delete project"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(p);
                  }}
                  className="absolute right-3 top-3 rounded-md p-1.5 text-slate-300 opacity-0 transition hover:bg-error/10 hover:text-error group-hover:opacity-100"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={() => navigate(`/projects/${p._id}`)}
                  className="flex flex-1 flex-col text-left"
                >
                  <div className="mb-3 flex h-28 items-center justify-center rounded-lg bg-slate-100 text-slate-300">
                    <Sparkles size={28} />
                  </div>
                  <div className="mb-2 flex items-center justify-between gap-2 pr-6">
                    <h3 className="truncate font-medium text-slate-900">{p.name}</h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_BADGE_COLOR[p.currentStage]}`}
                    >
                      {STAGE_LABELS[p.currentStage]}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-500">
                    {p.description || 'No description yet.'}
                  </p>
                  <p className="mt-3 text-xs text-slate-400">
                    Updated {new Date(p.updatedAt).toLocaleDateString()}
                  </p>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={load} />
      )}

      {deleteTarget && (
        <DeleteProjectModal
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={load}
        />
      )}
    </div>
  );
}

function DeleteProjectModal({
  project,
  onClose,
  onDeleted,
}: {
  project: Project;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onConfirm = async () => {
    setBusy(true);
    setError('');
    try {
      await projectsApi.remove(project._id);
      onDeleted();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Delete project</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <p className="mb-5 text-sm text-slate-600">
          Delete <span className="font-medium text-slate-900">{project.name}</span>? It will be
          removed from your dashboard and this can't be undone from here.
        </p>
        {error && <p className="mb-3 text-sm text-error">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const project = await projectsApi.create(name, description);
      onCreated();
      onClose();
      navigate(`/projects/${project._id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">New project</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Project name</label>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Habit tracker for shift workers"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create project'}
          </button>
        </form>
      </div>
    </div>
  );
}
