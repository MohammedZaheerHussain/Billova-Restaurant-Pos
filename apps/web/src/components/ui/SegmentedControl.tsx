import React from 'react';
import './SegmentedControl.css';

export interface SegmentOption<T extends string = string> {
    id: T;
    label: string;
    icon?: React.ReactNode;
    badge?: string | number;
}

export interface SegmentedControlProps<T extends string = string> {
    options: SegmentOption<T>[];
    value: T;
    onChange: (value: T) => void;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function SegmentedControl<T extends string = string>({
    options,
    value,
    onChange,
    size = 'md',
    className = '',
}: SegmentedControlProps<T>) {
    return (
        <div className={`ui-segmented-control ui-segmented-${size} ${className}`}>
            {options.map((opt) => {
                const isActive = opt.id === value;
                return (
                    <button
                        key={opt.id}
                        type="button"
                        className={`ui-segment-btn ${isActive ? 'is-active' : ''}`}
                        onClick={() => onChange(opt.id)}
                    >
                        {opt.icon && <span className="ui-segment-icon">{opt.icon}</span>}
                        <span className="ui-segment-label">{opt.label}</span>
                        {opt.badge !== undefined && (
                            <span className={`ui-segment-badge ${isActive ? 'badge-active' : ''}`}>
                                {opt.badge}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
