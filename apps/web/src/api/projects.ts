import { api } from './client';
import type { Project } from '../types';

export const projectsApi = {
  list: () => api<Project[]>({ method: 'GET', url: '/projects' }),
  create: (name: string, description?: string) =>
    api<Project>({ method: 'POST', url: '/projects', data: { name, description } }),
  get: (id: string) => api<Project>({ method: 'GET', url: `/projects/${id}` }),
  update: (id: string, data: Partial<Pick<Project, 'name' | 'description' | 'status'>>) =>
    api<Project>({ method: 'PATCH', url: `/projects/${id}`, data }),
  remove: (id: string) => api<Project>({ method: 'DELETE', url: `/projects/${id}` }),
};
