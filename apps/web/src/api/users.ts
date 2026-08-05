import api from './client';
import { CreateUserDTO } from '@billova/types';

export const usersAPI = {
    getAll: () => api.get('/users'),
    create: (data: CreateUserDTO) => api.post('/users', data),
    update: (id: string, data: Partial<CreateUserDTO>) => api.put(`/users/${id}`, data),
    resetPassword: (id: string, newPassword: string) =>
        api.post(`/users/${id}/reset-password`, { newPassword }),
    delete: (id: string) => api.delete(`/users/${id}`),
};
