/**
 * Super Admin Supabase Direct Operations
 * 
 * When running on Vercel (no Express backend), these functions
 * provide direct Supabase equivalents for all SuperAdmin API calls.
 */
import { supabase } from './supabase';

/**
 * Detect if an Express backend is available.
 * Returns false on Vercel static hosting, localhost without API, etc.
 */
export function hasExpressBackend(): boolean {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const supabaseOnly = import.meta.env.VITE_SUPABASE_AUTH_ONLY === 'true';
    if (supabaseOnly) return false;
    if (!apiUrl || apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) return false;
    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) return false;
    return true;
}

/**
 * Fetch a single restaurant (branch) by ID with owner profile
 */
export async function getRestaurantDirect(id: string) {
    const { data: branch, error: branchErr } = await supabase
        .from('branches')
        .select('*')
        .eq('id', id)
        .single();

    if (branchErr) throw new Error(branchErr.message);

    const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('branch_id', id);

    const owner = profiles?.find((p: any) => p.role === 'owner') || profiles?.[0];

    return {
        id: branch.id,
        name: branch.name,
        address: branch.address || '',
        phone: branch.phone || '',
        gstNumber: branch.gst_number || '',
        isActive: branch.is_active ?? true,
        subscriptionPlan: branch.subscription_plan || 'BASIC',
        createdAt: branch.created_at,
        license: {
            id: branch.id,
            plan: branch.subscription_plan || 'BASIC',
            status: branch.is_active ? 'ACTIVE' : 'EXPIRED',
            expires_at: branch.subscription_expiry || new Date(Date.now() + 365 * 86400000).toISOString(),
            is_lifetime: branch.subscription_plan?.includes('LIFETIME') || false,
        },
        daysLeft: branch.subscription_expiry
            ? Math.ceil((new Date(branch.subscription_expiry).getTime() - Date.now()) / 86400000)
            : null,
        owner: owner ? {
            id: owner.id,
            name: owner.name,
            email: owner.email,
            phone: owner.phone || '',
        } : undefined,
        _count: { orders: 0, users: (profiles || []).length },
    };
}

/**
 * Create a new restaurant (branch + owner profile + auth user)
 */
export async function createRestaurantDirect(data: {
    restaurantName: string;
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
    phone?: string;
    address?: string;
    gstNumber?: string;
    plan?: string;
    licenseDuration?: number;
    isDemo?: boolean;
}) {
    // 1. Create the branch
    const { data: branch, error: branchErr } = await supabase
        .from('branches')
        .insert({
            name: data.restaurantName,
            address: data.address || '',
            phone: data.phone || '',
            gst_number: data.gstNumber || '',
            subscription_plan: data.plan || 'BASIC',
            is_active: true,
            subscription_expiry: data.isDemo
                ? new Date(Date.now() + 3 * 86400000).toISOString()
                : new Date(Date.now() + (data.licenseDuration || 12) * 30 * 86400000).toISOString(),
        })
        .select()
        .single();

    if (branchErr) throw new Error(`Failed to create branch: ${branchErr.message}`);

    // 2. Create auth user for the owner
    const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: data.ownerEmail,
        password: data.ownerPassword,
        options: {
            data: {
                name: data.ownerName || data.ownerEmail.split('@')[0],
                role: 'owner',
                branch_id: branch.id,
            },
        },
    });

    if (authErr) {
        // Rollback: delete the branch if auth fails
        await supabase.from('branches').delete().eq('id', branch.id);
        throw new Error(`Failed to create user: ${authErr.message}`);
    }

    // 3. Update profile with branch_id (trigger should have created it)
    if (authData.user) {
        await supabase
            .from('profiles')
            .update({
                branch_id: branch.id,
                role: 'owner',
                name: data.ownerName || data.ownerEmail.split('@')[0],
            })
            .eq('id', authData.user.id);
    }

    return { branch, user: authData.user };
}

/**
 * Deactivate a branch
 */
export async function deactivateBranchDirect(id: string) {
    const { error } = await supabase
        .from('branches')
        .update({ is_active: false })
        .eq('id', id);
    if (error) throw new Error(error.message);
}

/**
 * Reactivate a branch
 */
export async function reactivateBranchDirect(id: string) {
    const { error } = await supabase
        .from('branches')
        .update({ is_active: true })
        .eq('id', id);
    if (error) throw new Error(error.message);
}

/**
 * Upgrade a branch plan
 */
export async function upgradePlanDirect(id: string, data: {
    plan: string;
    durationMonths?: number;
    isLifetime?: boolean;
}) {
    const expiry = data.isLifetime
        ? new Date(Date.now() + 100 * 365 * 86400000).toISOString()
        : new Date(Date.now() + (data.durationMonths || 12) * 30 * 86400000).toISOString();

    const { error } = await supabase
        .from('branches')
        .update({
            subscription_plan: data.plan,
            subscription_expiry: expiry,
            is_active: true,
        })
        .eq('id', id);
    if (error) throw new Error(error.message);
}
