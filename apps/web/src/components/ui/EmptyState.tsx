import React, { ReactNode } from 'react';
import './EmptyState.css';

export interface EmptyStateProps {
    title: string;
    description?: string;
    icon?: ReactNode;
    action?: ReactNode;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon,
    action,
    className = '',
}) => {
    return (
        <div className={`ui-empty-state ${className}`}>
            {icon && <div className="ui-empty-icon">{icon}</div>}
            <h3 className="ui-empty-title">{title}</h3>
            {description && <p className="ui-empty-description">{description}</p>}
            {action && <div className="ui-empty-action">{action}</div>}
        </div>
    );
};
