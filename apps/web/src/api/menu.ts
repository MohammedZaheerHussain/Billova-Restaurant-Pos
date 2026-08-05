import api from './client';
import { CreateMenuItemDTO, CreateCategoryDTO } from '@billova/types';

export const menuAPI = {
    getAll: (branchId?: string, categoryId?: string) =>
        api.get('/menu', { params: { branchId, categoryId } }),
    getOne: (id: string) => api.get(`/menu/${id}`),
    create: (data: CreateMenuItemDTO) => api.post('/menu', data),
    update: (id: string, data: Partial<CreateMenuItemDTO>) => api.put(`/menu/${id}`, data),
    toggleAvailability: (id: string) => api.patch(`/menu/${id}/toggle-availability`),
    delete: (id: string) => api.delete(`/menu/${id}`),
    extractMenuCard: (imageData: string) => api.post('/menu/extract-menu-card', { imageData }),
};

export const categoriesAPI = {
    getAll: (branchId?: string) => api.get('/categories', { params: { branchId } }),
    create: (data: CreateCategoryDTO) => api.post('/categories', data),
    update: (id: string, data: Partial<CreateCategoryDTO>) => api.put(`/categories/${id}`, data),
    delete: (id: string) => api.delete(`/categories/${id}`),
};

export const combosAPI = {
    getAll: (branchId?: string) => api.get('/combos', { params: { branchId } }),
    create: (data: Record<string, unknown>) => api.post('/combos', data),
    update: (id: string, data: Record<string, unknown>) => api.put(`/combos/${id}`, data),
    delete: (id: string) => api.delete(`/combos/${id}`),
};

export const addonsAPI = {
    getAll: () => api.get('/addons'),
    create: (data: { name: string; price: number; category?: string }) =>
        api.post('/addons', data),
    update: (id: string, data: Record<string, unknown>) => api.put(`/addons/${id}`, data),
    delete: (id: string) => api.delete(`/addons/${id}`),
    getForMenuItem: (menuItemId: string) => api.get(`/addons/menu-item/${menuItemId}`),
    linkToMenuItem: (menuItemId: string, addonIds: string[]) =>
        api.post(`/addons/menu-item/${menuItemId}`, { addonIds }),
};
