/**
 * Logger utility for development and production
 *
 * Usage:
 * - logger.debug() - Only shows in development
 * - logger.info() - Shows in all environments
 * - logger.warn() - Shows in all environments
 * - logger.error() - Shows in all environments
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Debug logs - Only visible in development
   * Use for temporary debugging, detailed traces, etc.
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Info logs - Visible in all environments
   * Use for important informational messages
   */
  info: (...args: any[]) => {
    console.info('[INFO]', ...args);
  },

  /**
   * Warning logs - Visible in all environments
   * Use for non-critical issues that should be addressed
   */
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },

  /**
   * Error logs - Visible in all environments
   * Use for errors and exceptions
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },
};
