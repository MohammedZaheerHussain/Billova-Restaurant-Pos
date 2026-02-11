/**
 * Billova POS - Production-safe Logger
 * 
 * In production: only warn/error output to console.
 * In development: all levels output.
 * 
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.debug('[Module] Detail');    // Dev only
 *   logger.info('[Module] Info');       // Dev only
 *   logger.warn('[Module] Warning');    // Always
 *   logger.error('[Module] Error', e); // Always
 */

const isProd = typeof window !== 'undefined'
    ? (import.meta as any).env?.PROD ?? false
    : process.env.NODE_ENV === 'production';

type LogFn = (...args: unknown[]) => void;

const noop: LogFn = () => { };

export const logger = {
    /** Debug-level: stripped in production */
    debug: isProd ? noop : console.log.bind(console),

    /** Info-level: stripped in production */
    info: isProd ? noop : console.info.bind(console),

    /** Warning-level: always outputs */
    warn: console.warn.bind(console),

    /** Error-level: always outputs */
    error: console.error.bind(console),
};

export default logger;
