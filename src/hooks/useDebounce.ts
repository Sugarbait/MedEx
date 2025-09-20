import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Enhanced debounce hook with cancellation and immediate execution options
 */
export function useDebounce<T>(
  value: T,
  delay: number,
  options: {
    leading?: boolean // Execute immediately on first call
    trailing?: boolean // Execute after delay (default: true)
    maxWait?: number // Maximum time to wait before forcing execution
  } = {}
): {
  debouncedValue: T
  cancel: () => void
  flush: () => void
  isPending: boolean
} {
  const { leading = false, trailing = true, maxWait } = options

  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const [isPending, setIsPending] = useState(false)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maxTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastCallTimeRef = useRef<number>(0)
  const lastValueRef = useRef<T>(value)
  const hasExecutedRef = useRef<boolean>(false)

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current)
      maxTimeoutRef.current = null
    }
    setIsPending(false)
    hasExecutedRef.current = false
  }, [])

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current)
      maxTimeoutRef.current = null
    }
    setDebouncedValue(lastValueRef.current)
    setIsPending(false)
    hasExecutedRef.current = true
  }, [])

  useEffect(() => {
    lastValueRef.current = value
    const now = Date.now()
    lastCallTimeRef.current = now

    // Leading edge execution
    if (leading && !hasExecutedRef.current) {
      setDebouncedValue(value)
      hasExecutedRef.current = true
      if (!trailing) return // If only leading, don't set up trailing timer
    }

    if (trailing) {
      setIsPending(true)

      // Clear existing timer
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Set up new timer
      timeoutRef.current = setTimeout(() => {
        setDebouncedValue(lastValueRef.current)
        setIsPending(false)
        hasExecutedRef.current = true
        timeoutRef.current = null
      }, delay)

      // Set up max wait timer if specified
      if (maxWait && !maxTimeoutRef.current) {
        maxTimeoutRef.current = setTimeout(() => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
          setDebouncedValue(lastValueRef.current)
          setIsPending(false)
          hasExecutedRef.current = true
          maxTimeoutRef.current = null
        }, maxWait)
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current)
      }
    }
  }, [value, delay, leading, trailing, maxWait])

  // Reset hasExecuted when value actually changes
  useEffect(() => {
    if (lastValueRef.current !== value) {
      hasExecutedRef.current = false
    }
  }, [value])

  return {
    debouncedValue,
    cancel,
    flush,
    isPending
  }
}

/**
 * Debounced callback hook
 */
export function useDebouncedCallback<Args extends any[]>(
  callback: (...args: Args) => void,
  delay: number,
  options: {
    leading?: boolean
    trailing?: boolean
    maxWait?: number
  } = {}
) {
  const { leading = false, trailing = true, maxWait } = options

  const callbackRef = useRef(callback)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maxTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const argsRef = useRef<Args | null>(null)
  const hasExecutedRef = useRef<boolean>(false)

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current)
      maxTimeoutRef.current = null
    }
    hasExecutedRef.current = false
  }, [])

  const flush = useCallback(() => {
    if (argsRef.current && timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current)
        maxTimeoutRef.current = null
      }
      callbackRef.current(...argsRef.current)
      hasExecutedRef.current = true
    }
  }, [])

  const debouncedCallback = useCallback((...args: Args) => {
    argsRef.current = args

    // Leading edge execution
    if (leading && !hasExecutedRef.current) {
      callbackRef.current(...args)
      hasExecutedRef.current = true
      if (!trailing) return // If only leading, don't set up trailing timer
    }

    if (trailing) {
      // Clear existing timer
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Set up new timer
      timeoutRef.current = setTimeout(() => {
        if (argsRef.current) {
          callbackRef.current(...argsRef.current)
          hasExecutedRef.current = true
        }
        timeoutRef.current = null
      }, delay)

      // Set up max wait timer if specified
      if (maxWait && !maxTimeoutRef.current) {
        maxTimeoutRef.current = setTimeout(() => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
          if (argsRef.current) {
            callbackRef.current(...argsRef.current)
            hasExecutedRef.current = true
          }
          maxTimeoutRef.current = null
        }, maxWait)
      }
    }
  }, [delay, leading, trailing, maxWait])

  // Reset hasExecuted when callback or options change
  useEffect(() => {
    hasExecutedRef.current = false
  }, [callback, delay, leading, trailing, maxWait])

  return {
    debouncedCallback,
    cancel,
    flush
  }
}

/**
 * Debounced async callback hook with proper cleanup
 */
export function useDebouncedAsyncCallback<Args extends any[], Return>(
  callback: (...args: Args) => Promise<Return>,
  delay: number,
  options: {
    leading?: boolean
    trailing?: boolean
    maxWait?: number
  } = {}
) {
  const { leading = false, trailing = true, maxWait } = options

  const callbackRef = useRef(callback)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maxTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const argsRef = useRef<Args | null>(null)
  const hasExecutedRef = useRef<boolean>(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current)
      maxTimeoutRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    hasExecutedRef.current = false
  }, [])

  const flush = useCallback(async () => {
    if (argsRef.current && timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current)
        maxTimeoutRef.current = null
      }

      abortControllerRef.current = new AbortController()
      try {
        const result = await callbackRef.current(...argsRef.current)
        hasExecutedRef.current = true
        return result
      } finally {
        abortControllerRef.current = null
      }
    }
  }, [])

  const debouncedCallback = useCallback((...args: Args): Promise<Return | void> => {
    argsRef.current = args

    return new Promise((resolve, reject) => {
      const executeCallback = async () => {
        if (!argsRef.current) return

        abortControllerRef.current = new AbortController()
        try {
          const result = await callbackRef.current(...argsRef.current)
          hasExecutedRef.current = true
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          abortControllerRef.current = null
        }
      }

      // Leading edge execution
      if (leading && !hasExecutedRef.current) {
        executeCallback()
        if (!trailing) return // If only leading, don't set up trailing timer
      }

      if (trailing) {
        // Clear existing timer
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        // Set up new timer
        timeoutRef.current = setTimeout(executeCallback, delay)

        // Set up max wait timer if specified
        if (maxWait && !maxTimeoutRef.current) {
          maxTimeoutRef.current = setTimeout(() => {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current)
              timeoutRef.current = null
            }
            executeCallback()
            maxTimeoutRef.current = null
          }, maxWait)
        }
      }
    })
  }, [delay, leading, trailing, maxWait])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel()
    }
  }, [cancel])

  return {
    debouncedCallback,
    cancel,
    flush
  }
}