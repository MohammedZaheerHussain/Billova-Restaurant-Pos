// Base Axios HTTP Client with Supabase Auth Interceptors
import axios from 'axios';
import { useAuthStore } from '../store';
import { supabase } from '../lib/supabase';

export const api = axios.create({
    baseURL: '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add Supabase auth token to requests
api.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
        config.headers['X-Auth-Provider'] = 'supabase';
    }

    return config;
});

// Handle auth errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            await supabase.auth.signOut();
            useAuthStore.getState().logout();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
