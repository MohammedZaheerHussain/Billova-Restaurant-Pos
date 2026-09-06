// Branch Settings & Cloud Synchronization API
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store';
import { useBranchSettingsStore, BranchSettings } from '../store/branch-settings-store';
import { usePrinterConfigStore, PrintSettings } from '../printing/printer-config-store';
import { logger } from '../utils/logger';

export interface BranchCloudData {
    id: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    gst_number?: string | null;
    settings?: Record<string, any> | null;
    subscription_plan?: string | null;
    subscription_expiry?: string | null;
}

/**
 * Fetch branch details and settings from Supabase
 * and synchronize with local stores (branch-settings-store, printer-config-store, auth-store)
 */
export async function loadBranchSettings(forcedBranchId?: string): Promise<BranchSettings | null> {
    try {
        let branchId = forcedBranchId || useAuthStore.getState().user?.branch?.id;
        const user = useAuthStore.getState().user;

        // If no branchId on user, attempt to find branch from profiles or active branch
        if (!branchId && user?.id) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('branch_id')
                .eq('id', user.id)
                .maybeSingle();

            if (profile?.branch_id) {
                branchId = profile.branch_id;
            } else {
                // Fallback to first available branch
                const { data: firstBranch } = await supabase
                    .from('branches')
                    .select('id, name')
                    .limit(1)
                    .maybeSingle();

                if (firstBranch) {
                    branchId = firstBranch.id;
                    // Link profile to branch
                    await supabase
                        .from('profiles')
                        .update({ branch_id: firstBranch.id })
                        .eq('id', user.id);
                }
            }
        }

        if (!branchId) {
            logger.warn('[BranchAPI] No branchId available to load settings');
            return null;
        }

        const { data: branch, error } = await supabase
            .from('branches')
            .select('*')
            .eq('id', branchId)
            .maybeSingle();

        if (error) {
            logger.error('[BranchAPI] Error fetching branch:', error);
            return null;
        }

        if (!branch) {
            logger.warn('[BranchAPI] Branch not found for ID:', branchId);
            return null;
        }

        const cloudSettings = (branch.settings as Record<string, any>) || {};

        const branchSettings: BranchSettings = {
            name: branch.name || '',
            address: branch.address || '',
            phone: branch.phone || '',
            gstNumber: branch.gst_number || '',
            gstEnabled: cloudSettings.gstEnabled ?? Boolean(branch.gst_number),
            fssaiNumber: cloudSettings.fssaiNumber || '',
        };

        // Update branch settings store
        useBranchSettingsStore.getState().updateSettings(branchSettings);

        // Update cloud-synced printer & order preferences
        const printStoreUpdates: Partial<PrintSettings> = {};
        if (typeof cloudSettings.autoPrintKOT === 'boolean') {
            printStoreUpdates.autoPrintKOT = cloudSettings.autoPrintKOT;
        }
        if (typeof cloudSettings.autoPrintBill === 'boolean') {
            printStoreUpdates.autoPrintBill = cloudSettings.autoPrintBill;
        }
        if (typeof cloudSettings.dailyOrderReset === 'boolean') {
            printStoreUpdates.dailyOrderReset = cloudSettings.dailyOrderReset;
        }
        if (typeof cloudSettings.playPrintSound === 'boolean') {
            printStoreUpdates.playPrintSound = cloudSettings.playPrintSound;
        }
        if (cloudSettings.footerText) {
            printStoreUpdates.footerText = cloudSettings.footerText;
        }
        if (typeof cloudSettings.showGSTBreakdown === 'boolean') {
            printStoreUpdates.showGSTBreakdown = cloudSettings.showGSTBreakdown;
        }
        if (typeof cloudSettings.showFSSAI === 'boolean') {
            printStoreUpdates.showFSSAI = cloudSettings.showFSSAI;
        }

        if (Object.keys(printStoreUpdates).length > 0) {
            usePrinterConfigStore.getState().updateSettings(printStoreUpdates);
        }

        // Ensure auth-store user has branch info
        if (user && (!user.branch || user.branch.id !== branch.id || user.branch.name !== branch.name)) {
            useAuthStore.setState({
                user: {
                    ...user,
                    branch: {
                        id: branch.id,
                        name: branch.name,
                        subscriptionPlan: (branch.subscription_plan as any) || 'BASIC',
                        subscriptionExpiry: branch.subscription_expiry || undefined,
                    },
                },
            });
        }

        logger.debug('[BranchAPI] Branch settings loaded successfully from Supabase:', branch.name);
        return branchSettings;
    } catch (err) {
        logger.error('[BranchAPI] Failed to load branch settings:', err);
        return null;
    }
}

/**
 * Save branch profile and settings to Supabase
 * Persists changes across all devices/sessions
 */
export async function saveBranchSettingsToCloud(
    branchSettings: BranchSettings,
    printerSettings?: Partial<PrintSettings>
): Promise<{ success: boolean; error?: string }> {
    try {
        let branchId = useAuthStore.getState().user?.branch?.id;
        const user = useAuthStore.getState().user;

        // If branchId not found on state, attempt to find or create one
        if (!branchId && user?.id) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('branch_id')
                .eq('id', user.id)
                .maybeSingle();

            if (profile?.branch_id) {
                branchId = profile.branch_id;
            } else {
                const { data: firstBranch } = await supabase
                    .from('branches')
                    .select('id')
                    .limit(1)
                    .maybeSingle();

                if (firstBranch) {
                    branchId = firstBranch.id;
                    await supabase
                        .from('profiles')
                        .update({ branch_id: firstBranch.id })
                        .eq('id', user.id);
                }
            }
        }

        if (!branchId) {
            return { success: false, error: 'No active branch found. Please log in again.' };
        }

        // Fetch existing branch settings JSON to merge cleanly
        const { data: currentBranch } = await supabase
            .from('branches')
            .select('settings')
            .eq('id', branchId)
            .maybeSingle();

        const existingSettings = (currentBranch?.settings as Record<string, any>) || {};

        const mergedSettings = {
            ...existingSettings,
            gstEnabled: branchSettings.gstEnabled,
            fssaiNumber: branchSettings.fssaiNumber,
            ...(printerSettings ? {
                autoPrintBill: printerSettings.autoPrintBill,
                autoPrintKOT: printerSettings.autoPrintKOT,
                dailyOrderReset: printerSettings.dailyOrderReset,
                playPrintSound: printerSettings.playPrintSound,
                footerText: printerSettings.footerText,
                showGSTBreakdown: printerSettings.showGSTBreakdown,
                showFSSAI: printerSettings.showFSSAI,
            } : {}),
        };

        const { error } = await supabase
            .from('branches')
            .update({
                name: branchSettings.name.trim() || 'Billova Bistro',
                address: branchSettings.address.trim(),
                phone: branchSettings.phone.trim(),
                gst_number: branchSettings.gstNumber.trim(),
                settings: mergedSettings,
                updated_at: new Date().toISOString(),
            })
            .eq('id', branchId);

        if (error) {
            logger.error('[BranchAPI] Supabase update error:', error);
            return { success: false, error: error.message };
        }

        // Also update local stores
        useBranchSettingsStore.getState().updateSettings(branchSettings);
        if (printerSettings) {
            usePrinterConfigStore.getState().updateSettings(printerSettings);
        }

        // Update auth user branch name
        if (user && user.branch) {
            useAuthStore.setState({
                user: {
                    ...user,
                    branch: {
                        ...user.branch,
                        name: branchSettings.name.trim() || user.branch.name,
                    },
                },
            });
        }

        logger.debug('[BranchAPI] Branch settings successfully saved to Supabase!');
        return { success: true };
    } catch (err: any) {
        logger.error('[BranchAPI] Unexpected save error:', err);
        return { success: false, error: err.message || 'Unknown save error' };
    }
}
