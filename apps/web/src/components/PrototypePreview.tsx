import { useEffect, useState } from 'react';
import { Download, RefreshCw, Wrench } from 'lucide-react';
import { prototypesApi } from '../api/prototypes';
import { apiErrorMessage } from '../api/client';
import type { PrototypeMetadata } from '../types';

export function PrototypePreview({ projectId }: { projectId: string }) {
  const [meta, setMeta] = useState<PrototypeMetadata | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [repairing, setRepairing] = useState(false);
  const [repairMessage, setRepairMessage] = useState('');

  useEffect(() => {
    prototypesApi
      .metadata(projectId)
      .then(setMeta)
      .catch(() => setMeta(null));
  }, [projectId, reloadKey]);

  const onRepair = async () => {
    setRepairing(true);
    setRepairMessage('');
    try {
      const result = await prototypesApi.repair(projectId);
      setRepairMessage(result.message);
      if (result.repaired || result.alreadyOk) {
        setReloadKey((k) => k + 1); // reload the preview iframe + metadata with the fixed code
      }
    } catch (err) {
      setRepairMessage(apiErrorMessage(err));
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <div className="text-sm text-slate-500">
          {meta ? (
            <>
              <span className="font-medium text-slate-700">{meta.framework === 'react' ? 'React' : 'Vue'}</span>{' '}
              · v{meta.version} · {meta.fileCount} file{meta.fileCount === 1 ? '' : 's'}
            </>
          ) : (
            'No prototype yet'
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRepair}
            disabled={repairing || !meta}
            title="If the preview shows a bundling/compile error, this asks the AI to fix it directly."
            className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            <Wrench size={13} /> {repairing ? 'Fixing…' : 'Fix broken code'}
          </button>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <a
            href={prototypesApi.downloadUrl(projectId)}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-dark"
          >
            <Download size={13} /> Download source
          </a>
        </div>
      </div>
      {repairMessage && (
        <p className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">{repairMessage}</p>
      )}
      <div className="flex-1 bg-slate-100">
        <iframe
          key={reloadKey}
          title="Prototype preview"
          src={prototypesApi.previewUrl(projectId)}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
        />
      </div>
    </div>
  );
}
