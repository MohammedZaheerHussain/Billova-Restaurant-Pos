import React, { HTMLAttributes } from 'react';
import './Card.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'solid' | 'glass' | 'outline' | 'flat';
    hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    variant = 'solid',
    hoverable = false,
    className = '',
    ...props
}) => {
    return (
        <div
            className={`ui-card ui-card-${variant} ${hoverable ? 'ui-card-hoverable' : ''} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};

export const CardHeader: React.FC<HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
    <div className={`ui-card-header ${className}`} {...props}>
        {children}
    </div>
);

export const CardBody: React.FC<HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
    <div className={`ui-card-body ${className}`} {...props}>
        {children}
    </div>
);

export const CardFooter: React.FC<HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
    <div className={`ui-card-footer ${className}`} {...props}>
        {children}
    </div>
);
