// Subscription Hook - Check feature access based on plan
import { useAuthStore } from '../store';

export type SubscriptionPlan = 'BASIC' | 'PLUS' | 'PREMIUM' | 'DEMO_PREMIUM';

// Feature limits per plan - Staff creation is Premium only
export const PLAN_LIMITS = {
    BASIC: {
        name: 'Basic',
        menuItems: Infinity,
        orderHistoryDays: Infinity,
        maxUsers: 1,  // Owner only - upgrade to Premium for staff
        features: {
            pos: true,
            menuManagement: true,
            orderHistory: true,
            reports: true,
            inventory: false,
            tables: false, // PRO & PREMIUM only
            aiExtraction: false,
            exportPdf: false,
            staffManagement: false, // Premium only
            contactlessMenu: false, // PRO & PREMIUM only
        },
    },
    PLUS: {
        name: 'Pro',
        menuItems: Infinity,
        orderHistoryDays: Infinity,
        maxUsers: 3,  // 1 Owner + 2 Staff members
        features: {
            pos: true,
            menuManagement: true,
            orderHistory: true,
            reports: true,
            inventory: true,
            tables: true,
            aiExtraction: false,
            exportPdf: false,
            staffManagement: true, // Up to 2 staff members (3 users total)
            contactlessMenu: true,
        },
    },
    PREMIUM: {
        name: 'Premium',
        menuItems: Infinity,
        orderHistoryDays: Infinity,
        maxUsers: Infinity,  // Unlimited employees
        features: {
            pos: true,
            menuManagement: true,
            orderHistory: true,
            reports: true,
            inventory: true,
            tables: true,
            aiExtraction: true,
            exportPdf: true,
            staffManagement: true, // Can add staff
            contactlessMenu: true,
        },
    },
    DEMO_PREMIUM: {
        name: 'Demo Premium',
        menuItems: Infinity,
        orderHistoryDays: Infinity,
        maxUsers: Infinity,
        features: {
            pos: true,
            menuManagement: true,
            orderHistory: true,
            reports: true,
            inventory: true,
            tables: true,
            aiExtraction: true,
            exportPdf: true,
            staffManagement: true,
            contactlessMenu: true,
        },
    },
};

export type FeatureKey = keyof typeof PLAN_LIMITS.BASIC.features;

export function normalizePlan(raw?: string | null): SubscriptionPlan {
    if (!raw) return 'BASIC';
    const upper = raw.trim().toUpperCase();
    if (upper === 'DEMO_PREMIUM') return 'DEMO_PREMIUM';
    if (upper.includes('PREMIUM') || upper === 'DEMO') return 'PREMIUM';
    if (upper.includes('PRO') || upper.includes('PLUS')) return 'PLUS';
    if (upper.includes('BASIC')) return 'BASIC';
    return 'BASIC';
}

export function useSubscription() {
    const user = useAuthStore((state) => state.user);

    // Get current plan from user's branch (default to BASIC)
    const rawPlan = user?.branch?.subscriptionPlan;
    const currentPlan: SubscriptionPlan = normalizePlan(rawPlan);
    const planConfig = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.BASIC;

    // Check if a feature is available
    const hasFeature = (feature: FeatureKey): boolean => {
        return planConfig?.features?.[feature] === true;
    };

    // Check if user can add more items (for menu limits)
    const canAddMenuItem = (currentCount: number): boolean => {
        return currentCount < planConfig.menuItems;
    };

    // Check if user can add more users
    const canAddUser = (currentCount: number): boolean => {
        return currentCount < planConfig.maxUsers;
    };

    // Get plan badge color
    const getPlanColor = () => {
        switch (currentPlan) {
            case 'BASIC': return '#22c55e'; // green
            case 'PLUS': return '#3b82f6';  // blue
            case 'PREMIUM': return '#a855f7'; // purple
            case 'DEMO_PREMIUM': return '#f97316'; // orange for demo premium
            default: return '#22c55e';
        }
    };

    // Get upgrade message
    const getUpgradeMessage = (feature: FeatureKey): string => {
        const featureNames: Record<FeatureKey, string> = {
            pos: 'POS',
            menuManagement: 'Menu Management',
            orderHistory: 'Order History',
            reports: 'Reports Dashboard',
            inventory: 'Inventory Tracking',
            tables: 'Table Management',
            aiExtraction: 'AI Menu Extraction',
            exportPdf: 'PDF Export',
            staffManagement: 'Staff Management',
            contactlessMenu: 'Contactless Online Menu',
        };
        const premiumFeatures: FeatureKey[] = ['aiExtraction', 'exportPdf'];
        return `Upgrade to ${premiumFeatures.includes(feature) ? 'Premium' : 'Pro'} to access ${featureNames[feature]}`;
    };

    // Calculate expiry & demo lock status
    const branch = user?.branch as any;
    const expiryDateStr = branch?.subscriptionExpiry || branch?.license?.expiresAt || branch?.license?.expires_at;
    let isExpired = false;
    let daysLeft: number | null = null;

    if (expiryDateStr) {
        const expiryTime = new Date(expiryDateStr).getTime();
        const now = Date.now();
        daysLeft = Math.ceil((expiryTime - now) / 86400000);
        if (expiryTime < now || branch?.isActive === false) {
            isExpired = true;
        }
    }

    return {
        currentPlan,
        planName: planConfig.name,
        planConfig,
        hasFeature,
        canAddMenuItem,
        canAddUser,
        getPlanColor,
        getUpgradeMessage,
        isSuperAdmin: user?.role === 'SUPER_ADMIN',
        isExpired,
        daysLeft,
    };
}

export default useSubscription;
