import type { StoreMiddleware, StoreActionHandler, StoreActionContext, StoreActionResult } from './types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('StoreMiddleware');

/**
 * Middleware for logging store actions
 */
export function createLoggingMiddleware(): StoreMiddleware {
  return (action: StoreActionHandler, context: StoreActionContext): StoreActionHandler => {
    return async (data, actionContext) => {
      const startTime = Date.now();

      logger.debug(`Store action started`, {
        store: context.storeName,
        action: context.actionName,
        data,
      });

      try {
        const result = await action(data, actionContext);
        const duration = Date.now() - startTime;

        logger.debug(`Store action completed`, {
          store: context.storeName,
          action: context.actionName,
          success: result.success,
          duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        logger.error(`Store action failed`, {
          store: context.storeName,
          action: context.actionName,
          error,
          duration,
        });

        throw error;
      }
    };
  };
}

/**
 * Middleware for validating store actions
 */
export function createValidationMiddleware<T>(
  validator: (data: T) => { valid: boolean; errors: string[] },
): StoreMiddleware<T> {
  return (action: StoreActionHandler<T>, context: StoreActionContext): StoreActionHandler<T> => {
    return async (data, actionContext) => {
      const validation = validator(data);

      if (!validation.valid) {
        logger.warn(`Store action validation failed`, {
          store: context.storeName,
          action: context.actionName,
          errors: validation.errors,
        });

        return {
          success: false,
          error: new Error(`Validation failed: ${validation.errors.join(', ')}`),
          context: actionContext,
        };
      }

      return action(data, actionContext);
    };
  };
}

/**
 * Middleware for performance monitoring
 */
export function createPerformanceMiddleware(): StoreMiddleware {
  return (action: StoreActionHandler, context: StoreActionContext): StoreActionHandler => {
    return async (data, actionContext) => {
      const startTime = performance.now();

      const result = await action(data, actionContext);

      const duration = performance.now() - startTime;

      // Log slow actions
      if (duration > 100) {
        logger.warn(`Slow store action detected`, {
          store: context.storeName,
          action: context.actionName,
          duration: `${duration.toFixed(2)}ms`,
        });
      }

      return result;
    };
  };
}

/**
 * Middleware for error handling
 */
export function createErrorHandlingMiddleware(): StoreMiddleware {
  return (action: StoreActionHandler, context: StoreActionContext): StoreActionHandler => {
    return async (data, actionContext) => {
      try {
        return await action(data, actionContext);
      } catch (error) {
        logger.error(`Store action error`, {
          store: context.storeName,
          action: context.actionName,
          error,
        });

        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          context: actionContext,
        };
      }
    };
  };
}

/**
 * Middleware for retrying failed actions
 */
export function createRetryMiddleware(maxRetries: number = 3, delay: number = 1000): StoreMiddleware {
  return (action: StoreActionHandler, context: StoreActionContext): StoreActionHandler => {
    return async (data, actionContext) => {
      let lastError: Error | undefined;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await action(data, actionContext);

          if (result.success) {
            return result;
          }

          lastError = result.error;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }

        if (attempt < maxRetries) {
          logger.debug(`Retrying store action`, {
            store: context.storeName,
            action: context.actionName,
            attempt,
            maxRetries,
          });

          await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        }
      }

      logger.error(`Store action failed after ${maxRetries} attempts`, {
        store: context.storeName,
        action: context.actionName,
        error: lastError,
      });

      return {
        success: false,
        error: lastError!,
        context: actionContext,
      };
    };
  };
}

/**
 * Middleware for caching store actions
 */
export function createCachingMiddleware<T>(
  cacheKey: (data: T) => string,
  ttl: number = 5 * 60 * 1000, // 5 minutes
): StoreMiddleware<T> {
  const cache = new Map<string, { data: any; timestamp: number }>();

  return (action: StoreActionHandler<T>, context: StoreActionContext): StoreActionHandler<T> => {
    return async (data, actionContext) => {
      const key = cacheKey(data);
      const cached = cache.get(key);

      if (cached && Date.now() - cached.timestamp < ttl) {
        logger.debug(`Store action cache hit`, {
          store: context.storeName,
          action: context.actionName,
          key,
        });

        return {
          success: true,
          data: cached.data,
          context: actionContext,
        };
      }

      const result = await action(data, actionContext);

      if (result.success && result.data) {
        cache.set(key, {
          data: result.data,
          timestamp: Date.now(),
        });
      }

      return result;
    };
  };
}

/**
 * Middleware for debouncing store actions
 */
export function createDebounceMiddleware(delay: number = 300): StoreMiddleware {
  const pendingActions = new Map<string, any>();

  return (action: StoreActionHandler, context: StoreActionContext): StoreActionHandler => {
    return async (data, actionContext) => {
      const actionKey = `${context.storeName}:${context.actionName}`;

      // Clear existing timeout
      const existingTimeout = pendingActions.get(actionKey);

      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      return new Promise<StoreActionResult>((resolve) => {
        const timeout = setTimeout(async () => {
          pendingActions.delete(actionKey);

          const result = await action(data, actionContext);
          resolve(result);
        }, delay);

        pendingActions.set(actionKey, timeout);
      });
    };
  };
}

/**
 * Compose multiple middleware functions
 */
export function composeMiddleware<T>(...middlewares: StoreMiddleware<T>[]): StoreMiddleware<T> {
  return (action: StoreActionHandler<T>, context: StoreActionContext): StoreActionHandler<T> => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc, context), action);
  };
}

/**
 * Create a default middleware stack
 */
export function createDefaultMiddleware<T>(): StoreMiddleware<T> {
  return composeMiddleware<T>(
    createErrorHandlingMiddleware(),
    createLoggingMiddleware(),
    createPerformanceMiddleware(),
  );
}
