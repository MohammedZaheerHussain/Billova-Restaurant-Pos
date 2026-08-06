import React, { HTMLAttributes } from 'react';
import './Badge.css';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: 'success' | 'warning' | 'danger' | 'info' | 'orange' | 'neutral';
    dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'neutral',
    dot = false,
    className = '',
    ...props
}) => {
    return (
        <span className={`ui-badge ui-badge-${variant} ${className}`} {...props}>
            {dot && <span className="ui-badge-dot" aria-hidden="true" />}
            <span>{children}</span>
        </span>
    );
};
