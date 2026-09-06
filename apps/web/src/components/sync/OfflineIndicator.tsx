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

    // Banner variant is disabled to prevent blocking POS screens
    if (variant === 'banner') {
        return null;
    }

    // Badge variant (default)
    return (
        <div
            className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all select-none
                ${isOnline
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }
            `}
            title={isOnline ? 'Online: Connected to cloud' : 'Offline mode: Orders will automatically sync when connected'}
        >
            <SignalIcon className={`w-3.5 h-3.5 ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className="font-semibold text-[11px] tracking-wide">{getSignalLabel()}</span>
            {!isOnline && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            )}
        </div>
    );
};

export default OfflineIndicator;
