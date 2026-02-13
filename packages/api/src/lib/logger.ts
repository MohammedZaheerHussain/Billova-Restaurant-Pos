/**
 * Billova POS API - Production-safe Logger
 *
 * In production: only warn/error output to console.
 * In development: all levels output with timestamps.
 *
 * Usage:
 *   import { logger } from '../lib/logger';
 *   logger.debug('[Module] Detail');    // Dev only
 *   logger.info('[Module] Info');       // Dev only
 *   logger.warn('[Module] Warning');    // Always
 *   logger.error('[Module] Error', e); // Always
 */

const isProd = process.env.NODE_ENV === 'production';

type LogFn = (...args: unknown[]) => void;

const noop: LogFn = () => { };

const timestamp = (): string => new Date().toISOString();

export const logger = {
    /** Debug-level: stripped in production */
    debug: isProd ? noop : (...args: unknown[]) => console.log(`[${timestamp()}]`, ...args),

    /** Info-level: stripped in production */
    info: isProd ? noop : (...args: unknown[]) => console.info(`[${timestamp()}]`, ...args),

    /** Warning-level: always outputs */
    warn: (...args: unknown[]) => console.warn(`[${timestamp()}] WARN`, ...args),

    /** Error-level: always outputs */
    error: (...args: unknown[]) => console.error(`[${timestamp()}] ERROR`, ...args),
};

export default logger;
