import { api, API_BASE_URL, tokenStorage } from './client';
import type { PrototypeMetadata } from '../types';

export const prototypesApi = {
  metadata: (projectId: string) =>
    api<PrototypeMetadata>({ method: 'GET', url: `/projects/${projectId}/prototype` }),
  previewUrl: (projectId: string) =>
    `${API_BASE_URL}/projects/${projectId}/prototype/preview?token=${encodeURIComponent(
      tokenStorage.getAccess() ?? '',
    )}`,
  downloadUrl: (projectId: string) =>
    `${API_BASE_URL}/projects/${projectId}/prototype/download?token=${encodeURIComponent(
      tokenStorage.getAccess() ?? '',
    )}`,
};
