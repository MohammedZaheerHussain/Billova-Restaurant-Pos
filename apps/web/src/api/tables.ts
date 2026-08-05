import api from './client';
import { CreateTableDTO, TableStatus } from '@billova/types';

export const tablesAPI = {
    getAll: () => api.get('/tables'),
    create: (data: CreateTableDTO) => api.post('/tables', data),
    updateStatus: (id: string, status: TableStatus | string) =>
        api.patch(`/tables/${id}/status`, { status }),
    delete: (id: string) => api.delete(`/tables/${id}`),
    generateQRToken: (id: string) => api.post(`/tables/${id}/qr-token`),
    removeQRToken: (id: string) => api.delete(`/tables/${id}/qr-token`),
};
