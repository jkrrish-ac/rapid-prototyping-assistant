import { api } from './client';
import type { Decision } from '../types';

export const decisionsApi = {
  list: (projectId: string) =>
    api<Decision[]>({ method: 'GET', url: `/projects/${projectId}/decisions` }),
};
