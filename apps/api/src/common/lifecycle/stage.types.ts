export enum LifecycleStage {
  IDEA = 'IDEA',
  UNDERSTAND = 'UNDERSTAND',
  IDEATE = 'IDEATE',
  DECIDE = 'DECIDE',
  DESIGN = 'DESIGN',
  BUILD = 'BUILD',
  TEST = 'TEST',
  FIX = 'FIX',
  SHIP = 'SHIP',
  REAL_USERS = 'REAL_USERS',
  FEEDBACK = 'FEEDBACK',
  ITERATE = 'ITERATE',
}

export const STAGE_ORDER: LifecycleStage[] = [
  LifecycleStage.IDEA,
  LifecycleStage.UNDERSTAND,
  LifecycleStage.IDEATE,
  LifecycleStage.DECIDE,
  LifecycleStage.DESIGN,
  LifecycleStage.BUILD,
  LifecycleStage.TEST,
  LifecycleStage.FIX,
  LifecycleStage.SHIP,
  LifecycleStage.REAL_USERS,
  LifecycleStage.FEEDBACK,
  LifecycleStage.ITERATE,
];

export type AiModel = 'opus' | 'sonnet';

export interface StageDefinition {
  key: LifecycleStage;
  order: number;
  title: string;
  /** 'opus' | 'sonnet' | 'split' — DESIGN is 'split': opus until architecture
   *  decisions are locked, then sonnet for wireframe/component rendering. */
  model: AiModel | 'split';
  decisionPrefix: string;
  requiredOutputFields: string[];
  /** Minimum number of decisions that must be logged before this stage can advance. */
  minDecisions: number;
  systemPrompt: string;
}
