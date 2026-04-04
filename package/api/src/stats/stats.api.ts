import type {AdminStatsResponse} from '@rezics/contract';
import {apiFetch} from '../react-query/http';

export const adminStatsApi = {
  getStats: async (): Promise<AdminStatsResponse> => {
    return apiFetch<AdminStatsResponse>('/admin/stats');
  },
};
