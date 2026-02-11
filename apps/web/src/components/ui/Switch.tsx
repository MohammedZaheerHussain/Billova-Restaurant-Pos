import React from 'react';
import './Switch.css';

interface SwitchProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    disabled?: boolean;
}

/**
 * Reusable iOS-style toggle switch component.
 * Uses flex-based centering for perfect knob alignment.
 */
export const Switch: React.FC<SwitchProps> = ({ enabled, onChange, disabled = false }) => {
    return (
        <button
            type="button"
            onClick={() => !disabled && onChange(!enabled)}
            className={`switch-track ${enabled ? 'on' : ''} ${disabled ? 'disabled' : ''}`}
            disabled={disabled}
            aria-checked={enabled}
            role="switch"
        >
            <span className="switch-knob" />
        </button>
    );
};

export default Switch;
