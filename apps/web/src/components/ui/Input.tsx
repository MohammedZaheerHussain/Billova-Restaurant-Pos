import React, { InputHTMLAttributes, ReactNode } from 'react';
import './Input.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    leftIcon,
    rightIcon,
    className = '',
    id,
    ...props
}) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
        <div className={`ui-input-wrapper ${error ? 'has-error' : ''}`}>
            {label && (
                <label htmlFor={inputId} className="ui-input-label">
                    {label}
                </label>
            )}
            <div className="ui-input-container">
                {leftIcon && <span className="ui-input-icon left">{leftIcon}</span>}
                <input
                    id={inputId}
                    className={`ui-input ${leftIcon ? 'has-left-icon' : ''} ${rightIcon ? 'has-right-icon' : ''} ${className}`}
                    {...props}
                />
                {rightIcon && <span className="ui-input-icon right">{rightIcon}</span>}
            </div>
            {error && <span className="ui-input-error">{error}</span>}
        </div>
    );
};
