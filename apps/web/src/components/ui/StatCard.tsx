import React, { ReactNode } from 'react';
import './StatCard.css';

export interface StatCardProps {
    title: string;
    value: string | number;
    icon?: ReactNode;
    subtitle?: string;
    trend?: {
        value: string;
        positive?: boolean;
    };
    accentColor?: string;
    onClick?: () => void;
    className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    icon,
    subtitle,
    trend,
    accentColor,
    onClick,
    className = '',
}) => {
    return (
        <div
            className={`ui-stat-card ${onClick ? 'is-clickable' : ''} ${className}`}
            onClick={onClick}
            style={accentColor ? ({ '--stat-accent': accentColor } as React.CSSProperties) : undefined}
        >
            <div className="ui-stat-header">
                <span className="ui-stat-title">{title}</span>
                {icon && <div className="ui-stat-icon-wrapper">{icon}</div>}
            </div>
            <div className="ui-stat-body">
                <span className="ui-stat-value">{value}</span>
                {trend && (
                    <span className={`ui-stat-trend ${trend.positive ? 'is-positive' : 'is-negative'}`}>
                        {trend.positive ? '↑' : '↓'} {trend.value}
                    </span>
                )}
            </div>
            {subtitle && <span className="ui-stat-subtitle">{subtitle}</span>}
        </div>
    );
};
