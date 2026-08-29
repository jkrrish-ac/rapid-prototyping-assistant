import { Check } from 'lucide-react';
import { STAGE_LABELS, STAGE_ORDER } from '../types';
import type { LifecycleStage, StageDoc } from '../types';

export function LifecycleRail({
  currentStage,
  stageDocs,
  selectedStage,
  onSelect,
}: {
  currentStage: LifecycleStage;
  stageDocs: StageDoc[];
  selectedStage: LifecycleStage;
  onSelect: (stage: LifecycleStage) => void;
}) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  const statusOf = (stage: LifecycleStage) =>
    stageDocs.find((d) => d.stage === stage)?.status ?? 'pending';

  return (
    <nav className="w-full overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 lg:w-56 lg:shrink-0 lg:overflow-visible lg:border-b-0 lg:border-r lg:px-3 lg:py-4">
      <ol className="flex gap-1 lg:flex-col lg:gap-0.5">
        {STAGE_ORDER.map((stage, idx) => {
          const status = statusOf(stage);
          const isCurrent = stage === currentStage;
          const isSelected = stage === selectedStage;
          const isClickable = idx <= currentIndex;
          return (
            <li key={stage} className="shrink-0">
              <button
                disabled={!isClickable}
                onClick={() => isClickable && onSelect(stage)}
                className={[
                  'flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition',
                  isSelected ? 'bg-primary/10 text-primary font-medium' : 'text-slate-600',
                  isClickable && !isSelected ? 'hover:bg-slate-100' : '',
                  !isClickable ? 'cursor-not-allowed text-slate-300' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium',
                    status === 'complete'
                      ? 'bg-success text-success-foreground'
                      : isCurrent
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-slate-200 text-slate-500',
                  ].join(' ')}
                >
                  {status === 'complete' ? <Check size={12} /> : idx + 1}
                </span>
                {STAGE_LABELS[stage]}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
