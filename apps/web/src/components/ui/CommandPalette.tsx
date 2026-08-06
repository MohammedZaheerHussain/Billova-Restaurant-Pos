import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, LayoutGrid, ShoppingBag, Grid3X3, UtensilsCrossed,
    BarChart3, Users, Settings, Package, Warehouse, Puzzle,
    LayoutDashboard, Shield
} from 'lucide-react';
import { useAuthStore } from '../../store';
import './CommandPalette.css';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const navigate = useNavigate();
    const { user } = useAuthStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (isOpen) onClose();
                else setQuery('');
            }
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const commands = [
        { id: 'pos', label: 'Go to POS Billing Terminal', icon: LayoutGrid, action: () => navigate('/') },
        { id: 'orders', label: 'View Orders & History', icon: ShoppingBag, action: () => navigate('/orders') },
        { id: 'tables', label: 'Manage Tables & Floor Plan', icon: Grid3X3, action: () => navigate('/tables') },
        { id: 'menu', label: 'Manage Menu Items & Prices', icon: UtensilsCrossed, action: () => navigate('/menu') },
        { id: 'reports', label: 'View Analytics & Financial Reports', icon: BarChart3, action: () => navigate('/reports') },
        { id: 'inventory', label: 'Check Inventory Stocks', icon: Package, action: () => navigate('/inventory') },
        { id: 'warehouse', label: 'Manage Warehouse Supplies', icon: Warehouse, action: () => navigate('/warehouse') },
        { id: 'addons', label: 'Manage Addons & Variants', icon: Puzzle, action: () => navigate('/addons') },
        { id: 'users', label: 'Manage Staff & Roles', icon: Users, action: () => navigate('/users') },
        { id: 'dashboard', label: 'Owner Business Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard') },
        { id: 'settings', label: 'Restaurant & POS Settings', icon: Settings, action: () => navigate('/settings') },
    ];

    if (user?.role === 'SUPER_ADMIN') {
        commands.unshift({
            id: 'super-admin',
            label: 'Super Admin Customer Management',
            icon: Shield,
            action: () => navigate('/super-admin')
        });
    }

    const filtered = commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase())
    );

    const handleSelect = (action: () => void) => {
        action();
        onClose();
    };

    return (
        <div className="command-palette-backdrop" onClick={onClose}>
            <div className="command-palette-modal" onClick={e => e.stopPropagation()}>
                <div className="command-palette-header">
                    <Search size={18} className="command-palette-icon" />
                    <input
                        type="text"
                        className="command-palette-input"
                        placeholder="Search commands, pages, orders... (Press Esc to close)"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        autoFocus
                    />
                    <kbd className="command-palette-kbd">Esc</kbd>
                </div>
                <div className="command-palette-body">
                    {filtered.length === 0 ? (
                        <div className="command-palette-empty">No commands found</div>
                    ) : (
                        <div className="command-palette-list">
                            {filtered.map(cmd => {
                                const Icon = cmd.icon;
                                return (
                                    <button
                                        key={cmd.id}
                                        className="command-palette-item"
                                        onClick={() => handleSelect(cmd.action)}
                                    >
                                        <Icon size={16} />
                                        <span>{cmd.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="command-palette-footer">
                    <span>Use ↑ ↓ to navigate</span>
                    <span>↵ to select</span>
                </div>
            </div>
        </div>
    );
};
