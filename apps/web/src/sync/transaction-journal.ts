// Transaction Journal - Enterprise-grade Write-Ahead Log
// Logs ALL critical operations for forensics, audit, replay, and fraud detection
// This is Step 1 of Phase 1: Bulletproof Offline Engine

import Dexie, { Table } from 'dexie';
import { logger } from '../utils/logger';

// ==================== TYPES ====================

export type JournalOperation =
    | 'CREATE_ORDER'
    | 'UPDATE_ORDER'
    | 'CANCEL_ORDER'
    | 'ADD_PAYMENT'
    | 'REFUND_PAYMENT'
    | 'STOCK_UPDATE'
    | 'TABLE_CHANGE'
    | 'KOT_CREATE'
    | 'KOT_UPDATE'
    | 'CUSTOMER_CREATE'
    | 'CUSTOMER_UPDATE';

export type JournalStatus = 'PENDING' | 'SYNCED' | 'FAILED' | 'EXPIRED';

export interface JournalEntry {
    id?: number;                  // Auto-increment primary key
    journal_id: string;           // UUID for idempotency
    device_id: string;            // Machine identifier (fingerprint)
    branch_id: string;            // Tenant isolation
    user_id: string;              // Who performed the action

    // Timestamps
    timestamp_local: number;      // Local device time (ms since epoch)
    timestamp_server?: number;    // Server time (set on sync)

    // Operation details
    operation: JournalOperation;
    entity_type: string;          // 'order', 'payment', 'customer', etc.
    entity_id: string;            // The local ID of the entity
    payload: string;              // JSON stringified payload
    payload_hash: string;         // For deduplication

    // Sync state
    status: JournalStatus;
    attempts: number;
    last_error?: string;
    synced_at?: number;

    // Priority (lower = higher priority)
    priority: number;             // 1 = payment, 2 = order, 3 = stock, 4 = other

    // Metadata
    version: number;              // Schema version
    created_at: number;
}

// Device fingerprint storage
export interface DeviceInfo {
    id: string;
    device_id: string;
    device_name: string;
    user_agent: string;
    screen_resolution: string;
    registered_at: number;
    last_active: number;
}

// ==================== CONSTANTS ====================

const JOURNAL_CONFIG = {
    DB_NAME: 'BillovaJournal',
    SCHEMA_VERSION: 1,
    MAX_ENTRIES: 10000,           // Auto-purge after this many entries
    MAX_AGE_DAYS: 30,             // Auto-purge entries older than this
    PRIORITY: {
        PAYMENT: 1,
        ORDER: 2,
        STOCK: 3,
        OTHER: 4,
    },
};

// ==================== DATABASE ====================

class JournalDB extends Dexie {
    journal!: Table<JournalEntry, number>;
    devices!: Table<DeviceInfo, string>;

    constructor() {
        super(JOURNAL_CONFIG.DB_NAME);

        this.version(JOURNAL_CONFIG.SCHEMA_VERSION).stores({
            journal: '++id, journal_id, device_id, branch_id, operation, entity_id, status, priority, timestamp_local, created_at',
            devices: 'id, device_id, registered_at',
        });
    }
}

const journalDB = new JournalDB();

// ==================== DEVICE FINGERPRINT ====================

let cachedDeviceId: string | null = null;

/**
 * Generate or retrieve a consistent device fingerprint
 */
export async function getDeviceId(): Promise<string> {
    if (cachedDeviceId) return cachedDeviceId;

    // Try to get from localStorage first
    let deviceId = localStorage.getItem('billova_device_id');

    if (!deviceId) {
        // Generate new device ID
        deviceId = generateDeviceFingerprint();
        localStorage.setItem('billova_device_id', deviceId);

        // Register device
        await journalDB.devices.put({
            id: crypto.randomUUID(),
            device_id: deviceId,
            device_name: getDeviceName(),
            user_agent: navigator.userAgent,
            screen_resolution: `${window.screen.width}x${window.screen.height}`,
            registered_at: Date.now(),
            last_active: Date.now(),
        });
    }

    cachedDeviceId = deviceId;
    return deviceId;
}

/**
 * Generate a device fingerprint based on available browser info
 */
function generateDeviceFingerprint(): string {
    const components = [
        navigator.userAgent,
        navigator.language,
        new Date().getTimezoneOffset().toString(),
        screen.colorDepth?.toString() || '24',
        `${screen.width}x${screen.height}`,
        navigator.hardwareConcurrency?.toString() || '4',
    ];

    // Simple hash
    const fingerprint = components.join('|');
    const hash = simpleHash(fingerprint);
    return `DEV-${hash.substring(0, 12).toUpperCase()}`;
}

/**
 * Get a human-readable device name
 */
function getDeviceName(): string {
    const ua = navigator.userAgent;
    if (/iPad/.test(ua)) return 'iPad';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/Android/.test(ua) && /Mobile/.test(ua)) return 'Android Phone';
    if (/Android/.test(ua)) return 'Android Tablet';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Win/.test(ua)) return 'Windows PC';
    if (/Linux/.test(ua)) return 'Linux PC';
    return 'Unknown Device';
}

/**
 * Simple hash function for fingerprinting
 */
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

// ==================== JOURNAL OPERATIONS ====================

/**
 * Write an entry to the journal (write-ahead log)
 * This should be called BEFORE any critical operation
 */
export async function writeJournal(
    operation: JournalOperation,
    entityType: string,
    entityId: string,
    payload: object,
    branchId: string,
    userId: string
): Promise<string> {
    const deviceId = await getDeviceId();
    const journalId = crypto.randomUUID();
    const payloadStr = JSON.stringify(payload);
    const payloadHash = simpleHash(payloadStr);

    const entry: JournalEntry = {
        journal_id: journalId,
        device_id: deviceId,
        branch_id: branchId,
        user_id: userId,
        timestamp_local: Date.now(),
        operation,
        entity_type: entityType,
        entity_id: entityId,
        payload: payloadStr,
        payload_hash: payloadHash,
        status: 'PENDING',
        attempts: 0,
        priority: getPriority(operation),
        version: JOURNAL_CONFIG.SCHEMA_VERSION,
        created_at: Date.now(),
    };

    await journalDB.journal.add(entry);

    logger.debug(`[Journal] Logged: ${operation} ${entityType}:${entityId}`);
    return journalId;
}

/**
 * Get priority for an operation (lower = higher priority)
 */
function getPriority(operation: JournalOperation): number {
    if (operation.includes('PAYMENT') || operation.includes('REFUND')) {
        return JOURNAL_CONFIG.PRIORITY.PAYMENT;
    }
    if (operation.includes('ORDER')) {
        return JOURNAL_CONFIG.PRIORITY.ORDER;
    }
    if (operation.includes('STOCK')) {
        return JOURNAL_CONFIG.PRIORITY.STOCK;
    }
    return JOURNAL_CONFIG.PRIORITY.OTHER;
}

/**
 * Mark a journal entry as synced
 */
export async function markSynced(journalId: string, serverTimestamp?: number): Promise<void> {
    await journalDB.journal
        .where('journal_id')
        .equals(journalId)
        .modify({
            status: 'SYNCED',
            timestamp_server: serverTimestamp || Date.now(),
            synced_at: Date.now(),
        });
}

/**
 * Mark a journal entry as failed
 */
export async function markFailed(journalId: string, error: string): Promise<void> {
    await journalDB.journal
        .where('journal_id')
        .equals(journalId)
        .modify((entry: JournalEntry) => {
            entry.status = 'FAILED';
            entry.attempts = (entry.attempts || 0) + 1;
            entry.last_error = error;
        });
}

/**
 * Get pending journal entries for sync (ordered by priority)
 */
export async function getPendingEntries(limit: number = 50): Promise<JournalEntry[]> {
    return journalDB.journal
        .where('status')
        .equals('PENDING')
        .sortBy('priority')
        .then(entries => entries.slice(0, limit));
}

/**
 * Get journal entries by entity for audit trail
 */
export async function getEntityHistory(
    entityType: string,
    entityId: string
): Promise<JournalEntry[]> {
    return journalDB.journal
        .where('entity_id')
        .equals(entityId)
        .filter(e => e.entity_type === entityType)
        .sortBy('timestamp_local');
}

/**
 * Get journal statistics
 */
export async function getJournalStats(): Promise<{
    total: number;
    pending: number;
    synced: number;
    failed: number;
    oldestPending: number | null;
}> {
    const [total, pending, synced, failed] = await Promise.all([
        journalDB.journal.count(),
        journalDB.journal.where('status').equals('PENDING').count(),
        journalDB.journal.where('status').equals('SYNCED').count(),
        journalDB.journal.where('status').equals('FAILED').count(),
    ]);

    const oldestPending = await journalDB.journal
        .where('status')
        .equals('PENDING')
        .sortBy('timestamp_local')
        .then(entries => entries[0]?.timestamp_local || null);

    return { total, pending, synced, failed, oldestPending };
}

// ==================== STORAGE PRESSURE PROTECTION ====================

/**
 * Auto-purge old synced entries to prevent storage overflow
 * Should be called periodically (e.g., on app start, after sync)
 */
export async function purgeOldEntries(): Promise<number> {
    const now = Date.now();
    const maxAgeMsFromConfig = JOURNAL_CONFIG.MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const cutoffTime = now - maxAgeMsFromConfig;

    // Delete old SYNCED entries (keep PENDING and FAILED for retry/audit)
    const deleted = await journalDB.journal
        .where('status')
        .equals('SYNCED')
        .filter(e => e.timestamp_local < cutoffTime)
        .delete();

    if (deleted > 0) {
        logger.debug(`[Journal] Purged ${deleted} old synced entries`);
    }

    // If still above max, delete oldest synced entries
    const totalCount = await journalDB.journal.count();
    if (totalCount > JOURNAL_CONFIG.MAX_ENTRIES) {
        const excess = totalCount - JOURNAL_CONFIG.MAX_ENTRIES;
        const oldestSynced = await journalDB.journal
            .where('status')
            .equals('SYNCED')
            .sortBy('timestamp_local');

        const toDelete = oldestSynced.slice(0, excess);
        for (const entry of toDelete) {
            if (entry.id) await journalDB.journal.delete(entry.id);
        }
        logger.debug(`[Journal] Purged ${toDelete.length} entries due to storage pressure`);
        return deleted + toDelete.length;
    }

    return deleted;
}

/**
 * Compress failed entries by removing payload data
 * (keeps metadata for audit, removes large payload)
 */
export async function compressFailedEntries(): Promise<number> {
    const failedOld = await journalDB.journal
        .where('status')
        .equals('FAILED')
        .filter(e => e.attempts > 5 && e.timestamp_local < Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toArray();

    for (const entry of failedOld) {
        await journalDB.journal.update(entry.id!, {
            payload: '{"compressed": true}',
            status: 'EXPIRED' as JournalStatus,
        });
    }

    if (failedOld.length > 0) {
        logger.debug(`[Journal] Compressed ${failedOld.length} old failed entries`);
    }
    return failedOld.length;
}

// ==================== RECOVERY ====================

/**
 * Get entries that need retry after crash/restart
 */
export async function getRecoverableEntries(): Promise<JournalEntry[]> {
    // Get PENDING entries that are older than 5 seconds
    // (they were created but might not have completed)
    const cutoff = Date.now() - 5000;

    return journalDB.journal
        .where('status')
        .anyOf(['PENDING', 'FAILED'])
        .filter(e => e.timestamp_local < cutoff && e.attempts < 10)
        .sortBy('priority');
}

/**
 * Export journal for debugging/support
 */
export async function exportJournal(
    branchId?: string,
    fromDate?: number,
    toDate?: number
): Promise<JournalEntry[]> {
    let query = journalDB.journal.toCollection();

    if (branchId) {
        query = journalDB.journal.where('branch_id').equals(branchId);
    }

    return query.filter(e => {
        if (fromDate && e.timestamp_local < fromDate) return false;
        if (toDate && e.timestamp_local > toDate) return false;
        return true;
    }).toArray();
}

// ==================== INITIALIZATION ====================

/**
 * Initialize the journal on app start
 */
export async function initializeJournal(): Promise<void> {
    logger.debug('[Journal] Initializing transaction journal...');

    // Get device ID (registers device if new)
    const deviceId = await getDeviceId();
    logger.debug(`[Journal] Device ID: ${deviceId}`);

    // Update device last active
    const device = await journalDB.devices.where('device_id').equals(deviceId).first();
    if (device) {
        await journalDB.devices.update(device.id, { last_active: Date.now() });
    }

    // Clean up old entries
    await purgeOldEntries();
    await compressFailedEntries();

    // Get stats
    const stats = await getJournalStats();
    logger.debug(`[Journal] Stats: ${stats.pending} pending, ${stats.synced} synced, ${stats.failed} failed`);

    if (stats.pending > 0) {
        logger.debug(`[Journal] ⚠️ ${stats.pending} entries pending sync`);
    }
}

// Export database for advanced usage
export { journalDB };
