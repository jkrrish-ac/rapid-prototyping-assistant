export type LifecycleStage =
  | 'IDEA'
  | 'UNDERSTAND'
  | 'IDEATE'
  | 'DECIDE'
  | 'DESIGN'
  | 'BUILD'
  | 'TEST'
  | 'FIX'
  | 'SHIP'
  | 'REAL_USERS'
  | 'FEEDBACK'
  | 'ITERATE';

export const STAGE_ORDER: LifecycleStage[] = [
  'IDEA',
  'UNDERSTAND',
  'IDEATE',
  'DECIDE',
  'DESIGN',
  'BUILD',
  'TEST',
  'FIX',
  'SHIP',
  'REAL_USERS',
  'FEEDBACK',
  'ITERATE',
];

export const STAGE_LABELS: Record<LifecycleStage, string> = {
  IDEA: 'Idea',
  UNDERSTAND: 'Understand',
  IDEATE: 'Ideate',
  DECIDE: 'Decide',
  DESIGN: 'Design',
  BUILD: 'Build',
  TEST: 'Test',
  FIX: 'Fix',
  SHIP: 'Ship',
  REAL_USERS: 'Real Users',
  FEEDBACK: 'Feedback',
  ITERATE: 'Iterate',
};

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Project {
  _id: string;
  owner: string;
  name: string;
  description: string;
  currentStage: LifecycleStage;
  status: 'active' | 'archived';
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface StageChoice {
  id: string;
  label: string;
  detail: string | null;
}

export interface StageDoc {
  _id: string;
  project: string;
  stage: LifecycleStage;
  status: 'pending' | 'active' | 'complete';
  conversation: ConversationEntry[];
  output: Record<string, unknown>;
  readyToAdvance: boolean;
  lastModelUsed: 'opus' | 'sonnet' | null;
  pendingChoices: StageChoice[];
  startedAt: string | null;
  completedAt: string | null;
}

export interface Decision {
  _id: string;
  project: string;
  decisionId: string;
  stage: LifecycleStage;
  model: 'opus' | 'sonnet';
  decision: string;
  context: string;
  options: string;
  rationale: string;
  impact: string;
  status: 'ACTIVE' | 'SUPERSEDED';
  supersededBy: string | null;
  timestamp: string;
}

export interface PrototypeMetadata {
  framework: 'react' | 'vue';
  version: number;
  fileCount: number;
  files: string[];
  mocked: string[];
  dependencies: string[];
  updatedAt: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface ApiErrorEnvelope {
  success: false;
  error: { code: string; message: string; details: unknown[] };
}
