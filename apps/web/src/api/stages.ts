import { api } from './client';
import type { Decision, LifecycleStage, Project, StageDoc } from '../types';

export const stagesApi = {
  list: (projectId: string) =>
    api<StageDoc[]>({ method: 'GET', url: `/projects/${projectId}/stages` }),
  get: (projectId: string, stage: LifecycleStage) =>
    api<StageDoc>({ method: 'GET', url: `/projects/${projectId}/stages/${stage}` }),
  postMessage: (projectId: string, stage: LifecycleStage, message: string) =>
    api<{
      stage: StageDoc;
      assistantMessage: string;
      decisionsCreated: Decision[];
      modelUsed: 'opus' | 'sonnet';
    }>({
      method: 'POST',
      url: `/projects/${projectId}/stages/${stage}/messages`,
      data: { message },
    }),
  advance: (projectId: string, stage: LifecycleStage) =>
    api<{ project: Project; nextStage: LifecycleStage }>({
      method: 'POST',
      url: `/projects/${projectId}/stages/${stage}/advance`,
    }),
};
