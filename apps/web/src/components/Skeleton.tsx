// Skeleton loading components for POS, Orders, and Reports
import './Skeleton.css';

/** POS Menu Grid — 8 ghost card placeholders */
export function POSSkeleton() {
    return (
        <div className="pos-skeleton-grid">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton-menu-card">
                    <div className="skeleton skeleton-icon" />
                    <div className="skeleton skeleton-name" />
                    <div className="skeleton skeleton-price" />
                </div>
            ))}
        </div>
    );
}

/** Orders Table — header + 6 ghost rows */
export function OrdersSkeleton() {
    return (
        <div className="orders-skeleton">
            <div className="skeleton-table-header">
                {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="skeleton" />
                ))}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-table-row">
                    <div className="skeleton skeleton-checkbox" />
                    <div className="skeleton" />
                    <div className="skeleton" style={{ width: '70%' }} />
                    <div className="skeleton" />
                    <div className="skeleton" style={{ width: '60%' }} />
                    <div className="skeleton" style={{ width: '50%' }} />
                    <div className="skeleton" />
                </div>
            ))}
        </div>
    );
}

/** Reports Dashboard — 4 summary cards + 2 chart placeholders */
export function ReportsSkeleton() {
    return (
        <div className="reports-skeleton">
            <div className="skeleton-summary-row">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skeleton-summary-card">
                        <div className="skeleton skeleton-card-icon" />
                        <div style={{ flex: 1 }}>
                            <div className="skeleton skeleton-card-value" />
                            <div className="skeleton skeleton-card-label" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="skeleton-charts-row">
                <div className="skeleton-chart-card">
                    <div className="skeleton skeleton-chart-title" />
                    <div className="skeleton-bar-group">
                        {[65, 40, 80, 55, 90, 35, 70].map((h, i) => (
                            <div key={i} className="skeleton skeleton-bar" style={{ height: `${h}%` }} />
                        ))}
                    </div>
                </div>
                <div className="skeleton-chart-card">
                    <div className="skeleton skeleton-chart-title" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i}>
                                <div className="skeleton skeleton-text medium" />
                                <div className="skeleton" style={{ height: 8, borderRadius: 4 }} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
