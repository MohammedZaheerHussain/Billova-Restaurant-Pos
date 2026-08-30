import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    RotateCcw
} from 'lucide-react';
import './DatePicker.css';

interface DatePickerProps {
    value: string; // YYYY-MM-DD
    onChange: (date: string) => void;
    className?: string;
    maxDate?: string;
}

export function DatePicker({ value, onChange, className = '', maxDate }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse current value
    const parseDate = (dateStr: string) => {
        if (!dateStr) return new Date();
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const currentDate = parseDate(value);
    const [viewYear, setViewYear] = useState(currentDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(currentDate.getMonth()); // 0 - 11

    // Keep view synced when value changes
    useEffect(() => {
        const d = parseDate(value);
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
    }, [value]);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const todayStr = formatLocalDate(new Date());

    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = formatLocalDate(yesterdayDate);

    const isToday = value === todayStr;
    const isYesterday = value === yesterdayStr;

    // Display formatted label
    const getDisplayLabel = () => {
        const date = parseDate(value);
        const day = date.getDate();
        const monthShort = date.toLocaleDateString('en-IN', { month: 'short' });
        const year = date.getFullYear();

        if (isToday) {
            return `Today, ${day} ${monthShort}`;
        }
        if (isYesterday) {
            return `Yesterday, ${day} ${monthShort}`;
        }
        return `${day} ${monthShort} ${year}`;
    };

    // Day shifting
    const shiftDay = (delta: number) => {
        const d = parseDate(value);
        d.setDate(d.getDate() + delta);
        const newDateStr = formatLocalDate(d);
        if (maxDate && delta > 0 && newDateStr > maxDate) return;
        onChange(newDateStr);
    };

    // Month shifting
    const prevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear(v => v - 1);
        } else {
            setViewMonth(v => v - 1);
        }
    };

    const nextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear(v => v + 1);
        } else {
            setViewMonth(v => v + 1);
        }
    };

    // Select a date
    const handleSelectDay = (day: number, monthOffset = 0) => {
        const targetDate = new Date(viewYear, viewMonth + monthOffset, day);
        const targetStr = formatLocalDate(targetDate);
        if (maxDate && targetStr > maxDate) return;
        onChange(targetStr);
        setIsOpen(false);
    };

    // Quick presets
    const handlePreset = (preset: 'today' | 'yesterday' | '7days') => {
        const d = new Date();
        if (preset === 'yesterday') {
            d.setDate(d.getDate() - 1);
        } else if (preset === '7days') {
            d.setDate(d.getDate() - 7);
        }
        onChange(formatLocalDate(d));
        setIsOpen(false);
    };

    // Generate Calendar Grid
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return (
        <div className={`custom-date-picker-wrapper ${className}`} ref={containerRef}>
            {/* ── Main Pill Bar ── */}
            <div className="custom-date-nav">
                <button
                    type="button"
                    className="date-nav-btn prev"
                    onClick={() => shiftDay(-1)}
                    title="Previous day"
                >
                    <ChevronLeft size={15} />
                </button>

                <button
                    type="button"
                    className={`date-nav-trigger ${isOpen ? 'active' : ''}`}
                    onClick={() => setIsOpen(!isOpen)}
                    title="Choose date"
                >
                    <CalendarIcon size={14} className="date-icon" />
                    <span className="date-label">{getDisplayLabel()}</span>
                    <ChevronDown size={12} className={`chevron-arrow ${isOpen ? 'rotated' : ''}`} />
                </button>

                <button
                    type="button"
                    className="date-nav-btn next"
                    onClick={() => shiftDay(1)}
                    disabled={Boolean(maxDate && value >= maxDate)}
                    title="Next day"
                >
                    <ChevronRight size={15} />
                </button>

                {!isToday && (
                    <button
                        type="button"
                        className="date-today-shortcut"
                        onClick={() => onChange(todayStr)}
                        title="Jump to Today"
                    >
                        <RotateCcw size={11} />
                        <span>Today</span>
                    </button>
                )}
            </div>

            {/* ── Custom Dark Calendar Popover ── */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="custom-calendar-popover"
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ duration: 0.14, ease: 'easeOut' }}
                    >
                        {/* Quick Presets */}
                        <div className="cal-presets">
                            <button
                                type="button"
                                className={`cal-preset-btn ${isToday ? 'active' : ''}`}
                                onClick={() => handlePreset('today')}
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                className={`cal-preset-btn ${isYesterday ? 'active' : ''}`}
                                onClick={() => handlePreset('yesterday')}
                            >
                                Yesterday
                            </button>
                            <button
                                type="button"
                                className="cal-preset-btn"
                                onClick={() => handlePreset('7days')}
                            >
                                7 Days Ago
                            </button>
                        </div>

                        {/* Month/Year Header */}
                        <div className="cal-month-nav">
                            <button type="button" className="cal-arrow-btn" onClick={prevMonth}>
                                <ChevronLeft size={15} />
                            </button>
                            <span className="cal-month-title">
                                {monthNames[viewMonth]} {viewYear}
                            </span>
                            <button type="button" className="cal-arrow-btn" onClick={nextMonth}>
                                <ChevronRight size={15} />
                            </button>
                        </div>

                        {/* Weekday Row */}
                        <div className="cal-weekdays">
                            {weekDays.map(day => (
                                <span key={day} className="cal-weekday">{day}</span>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="cal-days-grid">
                            {/* Prev month padding days */}
                            {Array.from({ length: firstDayIndex }).map((_, idx) => {
                                const dayNum = daysInPrevMonth - firstDayIndex + idx + 1;
                                return (
                                    <button
                                        key={`prev-${idx}`}
                                        type="button"
                                        className="cal-day other-month"
                                        onClick={() => handleSelectDay(dayNum, -1)}
                                    >
                                        {dayNum}
                                    </button>
                                );
                            })}

                            {/* Current month days */}
                            {Array.from({ length: daysInCurrentMonth }).map((_, idx) => {
                                const dayNum = idx + 1;
                                const cellDateStr = formatLocalDate(new Date(viewYear, viewMonth, dayNum));
                                const isSelected = cellDateStr === value;
                                const isCellToday = cellDateStr === todayStr;
                                const isFuture = maxDate ? cellDateStr > maxDate : false;

                                return (
                                    <button
                                        key={`curr-${dayNum}`}
                                        type="button"
                                        disabled={isFuture}
                                        className={`cal-day ${isSelected ? 'selected' : ''} ${isCellToday ? 'today' : ''}`}
                                        onClick={() => handleSelectDay(dayNum, 0)}
                                    >
                                        {dayNum}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="cal-footer">
                            <span className="cal-selected-label">
                                {parseDate(value).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                })}
                            </span>
                            <button
                                type="button"
                                className="cal-close-btn"
                                onClick={() => setIsOpen(false)}
                            >
                                Done
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
