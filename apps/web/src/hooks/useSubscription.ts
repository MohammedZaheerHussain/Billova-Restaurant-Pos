// Subscription Hook - Check feature access based on plan
import { useAuthStore } from '../store';

export type SubscriptionPlan = 'BASIC' | 'PLUS' | 'PREMIUM';

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
            tables: true,
            aiExtraction: false,
            exportPdf: false,
            staffManagement: false, // Premium only
        },
    },
    PLUS: {
        name: 'Plus',
        menuItems: Infinity,
        orderHistoryDays: Infinity,
        maxUsers: 1,  // Owner only - upgrade to Premium for staff
        features: {
            pos: true,
            menuManagement: true,
            orderHistory: true,
            reports: true,
            inventory: true,
            tables: true,
            aiExtraction: false,
            exportPdf: false,
            staffManagement: false, // Premium only
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
        },
    },
};

export type FeatureKey = keyof typeof PLAN_LIMITS.BASIC.features;

export function useSubscription() {
    const user = useAuthStore((state) => state.user);

    // Get current plan from user's branch (default to BASIC)
    const rawPlan = user?.branch?.subscriptionPlan as SubscriptionPlan;
    // Validate plan exists in PLAN_LIMITS, fallback to BASIC if invalid
    const currentPlan: SubscriptionPlan = (rawPlan && PLAN_LIMITS[rawPlan]) ? rawPlan : 'BASIC';
    const planConfig = PLAN_LIMITS[currentPlan];

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
        };
        const premiumFeatures: FeatureKey[] = ['aiExtraction', 'exportPdf', 'staffManagement'];
        return `Upgrade to ${premiumFeatures.includes(feature) ? 'Premium' : 'Plus'} to access ${featureNames[feature]}`;
    };

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
    };
}

export default useSubscription;
