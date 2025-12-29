// Subscription Hook - Check feature access based on plan
import { useAuthStore } from '../store';

export type SubscriptionPlan = 'BASIC' | 'PLUS' | 'PREMIUM';

// Feature limits per plan - All have unlimited items, but limited users
export const PLAN_LIMITS = {
    BASIC: {
        name: 'Basic',
        menuItems: Infinity,
        orderHistoryDays: Infinity,
        maxUsers: 2,  // 2 employees max
        features: {
            pos: true,
            menuManagement: true,
            orderHistory: true,
            reports: true,
            inventory: false,
            tables: true,
            aiExtraction: false,
            exportPdf: false,
        },
    },
    PLUS: {
        name: 'Plus',
        menuItems: Infinity,
        orderHistoryDays: Infinity,
        maxUsers: 5,  // 5 employees max
        features: {
            pos: true,
            menuManagement: true,
            orderHistory: true,
            reports: true,
            inventory: true,
            tables: true,
            aiExtraction: false,
            exportPdf: false,
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
        },
    },
};

export type FeatureKey = keyof typeof PLAN_LIMITS.BASIC.features;

export function useSubscription() {
    const user = useAuthStore((state) => state.user);

    // Get current plan from user's branch (default to BASIC)
    const currentPlan: SubscriptionPlan = (user?.branch?.subscriptionPlan as SubscriptionPlan) || 'BASIC';
    const planConfig = PLAN_LIMITS[currentPlan];

    // Check if a feature is available
    const hasFeature = (feature: FeatureKey): boolean => {
        return planConfig.features[feature] === true;
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
        };
        return `Upgrade to ${feature === 'aiExtraction' || feature === 'exportPdf' ? 'Premium' : 'Plus'} to access ${featureNames[feature]}`;
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
