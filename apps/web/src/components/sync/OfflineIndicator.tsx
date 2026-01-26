// Offline Indicator Component - Shows network status
import React from 'react';
import { Wifi, WifiOff, SignalLow, SignalMedium, SignalHigh } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

interface OfflineIndicatorProps {
    variant?: 'badge' | 'banner' | 'minimal';
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
    variant = 'badge',
}) => {
    const { isOnline, effectiveType } = useNetworkStatus();

    const getSignalIcon = () => {
        if (!isOnline) return WifiOff;
        switch (effectiveType) {
            case '4g':
                return SignalHigh;
            case '3g':
                return SignalMedium;
            case '2g':
            case 'slow-2g':
                return SignalLow;
            default:
                return Wifi;
        }
    };

    const getSignalLabel = () => {
        if (!isOnline) return 'No Connection';
        switch (effectiveType) {
            case '4g':
                return 'Excellent';
            case '3g':
                return 'Good';
            case '2g':
                return 'Poor';
            case 'slow-2g':
                return 'Very Slow';
            default:
                return 'Connected';
        }
    };

    const SignalIcon = getSignalIcon();

    // Minimal variant - just an icon
    if (variant === 'minimal') {
        return (
            <div className={`${isOnline ? 'text-green-500' : 'text-red-500'}`}>
                <SignalIcon className="w-4 h-4" />
            </div>
        );
    }

    // Banner variant - full-width warning when offline
    if (variant === 'banner' && !isOnline) {
        return (
            <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-2 shadow-lg">
                <WifiOff className="w-5 h-5" />
                <span className="font-medium">You're offline - Orders will sync when connected</span>
            </div>
        );
    }

    // Don't show banner when online
    if (variant === 'banner' && isOnline) {
        return null;
    }

    // Badge variant (default)
    return (
        <div
            className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
                ${isOnline
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-red-500/10 text-red-500'
                }
            `}
        >
            <SignalIcon className="w-4 h-4" />
            <span>{getSignalLabel()}</span>
        </div>
    );
};

export default OfflineIndicator;
