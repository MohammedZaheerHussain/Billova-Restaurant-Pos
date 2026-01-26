// Sync Status Badge Component - Shows sync status in header
import React from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { useSyncStatus } from '../../hooks/useSync';

interface SyncStatusBadgeProps {
    onClick?: () => void;
    showLabel?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
    onClick,
    showLabel = false,
}) => {
    const { status, isOnline, pendingCount, lastSyncTime, hasErrors } = useSyncStatus();

    const getStatusInfo = () => {
        if (!isOnline) {
            return {
                icon: CloudOff,
                color: 'text-red-500',
                bgColor: 'bg-red-500/10',
                label: 'Offline',
                pulse: false,
            };
        }

        if (status === 'SYNCING') {
            return {
                icon: RefreshCw,
                color: 'text-blue-500',
                bgColor: 'bg-blue-500/10',
                label: 'Syncing...',
                pulse: true,
                spin: true,
            };
        }

        if (hasErrors || pendingCount > 0) {
            return {
                icon: AlertCircle,
                color: 'text-yellow-500',
                bgColor: 'bg-yellow-500/10',
                label: `${pendingCount} pending`,
                pulse: true,
            };
        }

        if (status === 'SUCCESS') {
            return {
                icon: Check,
                color: 'text-green-500',
                bgColor: 'bg-green-500/10',
                label: 'Synced',
                pulse: false,
            };
        }

        return {
            icon: Cloud,
            color: 'text-gray-400',
            bgColor: 'bg-gray-500/10',
            label: 'Online',
            pulse: false,
        };
    };

    const statusInfo = getStatusInfo();
    const Icon = statusInfo.icon;

    const formatLastSync = () => {
        if (!lastSyncTime) return 'Never synced';
        const diff = Date.now() - lastSyncTime.getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return lastSyncTime.toLocaleDateString();
    };

    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full transition-all
                ${statusInfo.bgColor} hover:opacity-80
                ${statusInfo.pulse ? 'animate-pulse' : ''}
            `}
            title={`Last sync: ${formatLastSync()}`}
        >
            <Icon
                className={`
                    w-4 h-4 ${statusInfo.color}
                    ${statusInfo.spin ? 'animate-spin' : ''}
                `}
            />
            {showLabel && (
                <span className={`text-sm font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                </span>
            )}
            {pendingCount > 0 && !showLabel && (
                <span className="text-xs font-bold text-yellow-500 min-w-[1.25rem] text-center">
                    {pendingCount}
                </span>
            )}
        </button>
    );
};

export default SyncStatusBadge;
