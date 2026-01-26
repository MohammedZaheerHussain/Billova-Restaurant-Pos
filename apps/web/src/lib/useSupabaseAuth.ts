import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { shouldUseSupabaseAuth } from './feature-flags';

interface SupabaseAuthState {
    user: User | null;
    session: Session | null;
    loading: boolean;
    error: string | null;
}

interface UseSupabaseAuthReturn extends SupabaseAuthState {
    signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUp: (email: string, password: string, metadata?: any) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    isEnabled: boolean;
}

/**
 * Hook for Supabase authentication
 * Works alongside or instead of Node JWT based on feature flags
 */
export const useSupabaseAuth = (): UseSupabaseAuthReturn => {
    const [state, setState] = useState<SupabaseAuthState>({
        user: null,
        session: null,
        loading: true,
        error: null,
    });

    const isEnabled = shouldUseSupabaseAuth();

    useEffect(() => {
        if (!isEnabled) {
            setState(s => ({ ...s, loading: false }));
            return;
        }

        // Get initial session
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            setState({
                user: session?.user ?? null,
                session,
                loading: false,
                error: error?.message ?? null,
            });
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setState({
                    user: session?.user ?? null,
                    session,
                    loading: false,
                    error: null,
                });
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [isEnabled]);

    const signIn = useCallback(async (email: string, password: string) => {
        if (!isEnabled) {
            return { success: false, error: 'Supabase auth not enabled' };
        }

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }, [isEnabled]);

    const signUp = useCallback(async (email: string, password: string, metadata?: any) => {
        if (!isEnabled) {
            return { success: false, error: 'Supabase auth not enabled' };
        }

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: metadata,
                },
            });

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }, [isEnabled]);

    const signOut = useCallback(async () => {
        if (!isEnabled) return;

        await supabase.auth.signOut();
    }, [isEnabled]);

    return {
        ...state,
        signIn,
        signUp,
        signOut,
        isEnabled,
    };
};

/**
 * Get the current Supabase access token for API calls
 * Returns null if not using Supabase auth
 */
export const getSupabaseAccessToken = async (): Promise<string | null> => {
    if (!shouldUseSupabaseAuth()) return null;

    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
};

export default useSupabaseAuth;
