import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, GitBranch, Sparkles } from 'lucide-react';
import { projectsApi } from '../api/projects';
import { stagesApi } from '../api/stages';
import { LifecycleRail } from '../components/LifecycleRail';
import { StagePanel } from '../components/StagePanel';
import { DecisionLogDrawer } from '../components/DecisionLogDrawer';
import { PrototypePreview } from '../components/PrototypePreview';
import { STAGE_ORDER } from '../types';
import type { LifecycleStage, Project, StageDoc } from '../types';

const BUILD_INDEX = STAGE_ORDER.indexOf('BUILD');

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [stageDocs, setStageDocs] = useState<StageDoc[]>([]);
  const [selectedStage, setSelectedStage] = useState<LifecycleStage>('IDEA');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [decisionRefreshKey, setDecisionRefreshKey] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  const load = async () => {
    if (!id) return;
    const [p, stages] = await Promise.all([projectsApi.get(id), stagesApi.list(id)]);
    setProject(p);
    setStageDocs(stages);
    setSelectedStage((prev) => (stages.some((s) => s.stage === prev) ? prev : p.currentStage));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (project) setSelectedStage(project.currentStage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.currentStage]);

  if (!project || !id) {
    return <div className="flex h-screen items-center justify-center text-slate-500">Loading…</div>;
  }

  const currentIndex = STAGE_ORDER.indexOf(project.currentStage);
  const canSeePrototype = currentIndex >= BUILD_INDEX;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-700">
            <ArrowLeft size={18} />
          </button>
          <Link to="/" className="flex items-center gap-1.5 text-primary">
            <Sparkles size={16} />
          </Link>
          <h1 className="font-semibold text-slate-900">{project.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {canSeePrototype && (
            <button
              onClick={() => setShowPreview((s) => !s)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
          )}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <GitBranch size={15} /> Decision Log
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <LifecycleRail
          currentStage={project.currentStage}
          stageDocs={stageDocs}
          selectedStage={selectedStage}
          onSelect={setSelectedStage}
        />

        <div className={`flex flex-1 overflow-hidden ${showPreview ? 'lg:divide-x' : ''}`}>
          <div className={showPreview ? 'w-1/2' : 'w-full'}>
            <StagePanel
              project={project}
              stage={selectedStage}
              isActiveStage={selectedStage === project.currentStage}
              onAdvanced={async () => {
                await load();
                setDecisionRefreshKey((k) => k + 1);
              }}
              onDecisionLogged={() => setDecisionRefreshKey((k) => k + 1)}
            />
          </div>
          {showPreview && (
            <div className="w-1/2">
              <PrototypePreview projectId={id} />
            </div>
          )}
        </div>
      </div>

      <DecisionLogDrawer
        projectId={id}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        refreshKey={decisionRefreshKey}
      />
    </div>
  );
}
