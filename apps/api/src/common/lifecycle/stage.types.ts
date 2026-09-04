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
  /**
   * Max output tokens for this stage's AI calls. Stages that emit source
   * code or long structured detail (BUILD, FIX, DESIGN's render phase) need
   * far more headroom than pure-reasoning stages — the default (8000) is
   * comfortably enough for a paragraph-sized brief but truncates mid-JSON on
   * a multi-file prototype, which surfaces as a 503 "could not be parsed as
   * JSON" error. Overridable globally via ANTHROPIC_MAX_TOKENS in .env.
   */
  maxOutputTokens?: number;
  systemPrompt: string;
}
