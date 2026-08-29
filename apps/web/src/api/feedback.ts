import { api } from './client';

export interface FeedbackEntry {
  _id: string;
  whatHappened: string;
  whatUserExpected: string;
  whatUserDid: string;
  assumptionRef: string;
  createdAt: string;
}

export const feedbackApi = {
  list: (projectId: string) =>
    api<FeedbackEntry[]>({ method: 'GET', url: `/projects/${projectId}/feedback` }),
  create: (
    projectId: string,
    data: Omit<FeedbackEntry, '_id' | 'createdAt'>,
  ) =>
    api<FeedbackEntry>({
      method: 'POST',
      url: `/projects/${projectId}/feedback`,
      data,
    }),
};
