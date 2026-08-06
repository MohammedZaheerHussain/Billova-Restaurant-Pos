import React, { ButtonHTMLAttributes } from 'react';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    disabled,
    className = '',
    ...props
}) => {
    return (
        <button
            className={`ui-button ui-button-${variant} ui-button-${size} ${loading ? 'is-loading' : ''} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <span className="ui-button-spinner" aria-hidden="true" />
            ) : icon ? (
                <span className="ui-button-icon">{icon}</span>
            ) : null}
            {children && <span className="ui-button-text">{children}</span>}
        </button>
    );
};
