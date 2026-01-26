/**
 * Feature Flags for Supabase Integration
 * Controls gradual rollout of Supabase features
 */

export const FeatureFlags = {
    // Use Supabase Auth alongside Node JWT (dual-mode)
    DUAL_AUTH_ENABLED: import.meta.env.VITE_DUAL_AUTH_ENABLED === 'true',

    // Use Supabase Auth as the ONLY auth provider (after 2 weeks)
    SUPABASE_AUTH_ONLY: import.meta.env.VITE_SUPABASE_AUTH_ONLY === 'true',

    // Enable Supabase Realtime subscriptions
    SUPABASE_REALTIME: import.meta.env.VITE_SUPABASE_REALTIME === 'true',

    // Check if Supabase is configured
    SUPABASE_CONFIGURED: !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
};

/**
 * Check if we should use Supabase for auth
 */
export const shouldUseSupabaseAuth = (): boolean => {
    return FeatureFlags.SUPABASE_CONFIGURED &&
        (FeatureFlags.DUAL_AUTH_ENABLED || FeatureFlags.SUPABASE_AUTH_ONLY);
};

/**
 * Check if we should use dual auth (both Node JWT and Supabase)
 */
export const isDualAuthMode = (): boolean => {
    return FeatureFlags.DUAL_AUTH_ENABLED && !FeatureFlags.SUPABASE_AUTH_ONLY;
};

/**
 * Check if Supabase is the only auth provider
 */
export const isSupabaseAuthOnly = (): boolean => {
    return FeatureFlags.SUPABASE_AUTH_ONLY;
};

export default FeatureFlags;
