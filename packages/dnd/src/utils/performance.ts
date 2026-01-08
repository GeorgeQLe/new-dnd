"use client";

// ============================================================
// RequestAnimationFrame Batching Utilities
// ============================================================

/**
 * Batches multiple DOM updates into a single animation frame
 * to improve performance and prevent layout thrashing
 */
class RAFBatcher {
  private callbacks: Set<() => void> = new Set();
  private isScheduled = false;

  /**
   * Schedule a callback to run on the next animation frame
   * Multiple calls in the same frame will be batched together
   */
  schedule(callback: () => void): void {
    this.callbacks.add(callback);
    
    if (!this.isScheduled) {
      this.isScheduled = true;
      requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  /**
   * Remove a scheduled callback
   */
  cancel(callback: () => void): void {
    this.callbacks.delete(callback);
  }

  /**
   * Execute all scheduled callbacks and reset the batch
   */
  private flush(): void {
    const callbacks = Array.from(this.callbacks);
    this.callbacks.clear();
    this.isScheduled = false;

    callbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in RAF batched callback:', error);
      }
    });
  }
}

// Global RAF batcher instance
const rafBatcher = new RAFBatcher();

/**
 * Schedule a callback to run on the next animation frame
 * All calls in the same frame will be batched together for optimal performance
 */
export function scheduleUpdate(callback: () => void): void {
  rafBatcher.schedule(callback);
}

/**
 * Cancel a previously scheduled update
 */
export function cancelUpdate(callback: () => void): void {
  rafBatcher.cancel(callback);
}

// ============================================================
// Debounced Event Handling
// ============================================================

/**
 * Debounces a function to prevent excessive calls
 * Useful for mouse move events and other high-frequency events
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Throttles a function to limit the rate of calls
 * Useful for scroll events and other high-frequency events
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): T & { cancel: () => void } {
  let isThrottled = false;
  let savedArgs: Parameters<T> | null = null;

  const throttled = ((...args: Parameters<T>) => {
    if (!isThrottled) {
      func(...args);
      isThrottled = true;
      
      setTimeout(() => {
        isThrottled = false;
        if (savedArgs) {
          throttled(...savedArgs);
          savedArgs = null;
        }
      }, delay);
    } else {
      savedArgs = args;
    }
  }) as T & { cancel: () => void };

  throttled.cancel = () => {
    isThrottled = false;
    savedArgs = null;
  };

  return throttled;
}

// ============================================================
// DOM Measurement Utilities
// ============================================================

/**
 * Efficiently measure element dimensions and position
 * Uses ResizeObserver for better performance when available
 */
export class ElementMeasurer {
  private observer: ResizeObserver | null = null;
  private callbacks = new Map<Element, (rect: DOMRect) => void>();

  constructor() {
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          const callback = this.callbacks.get(entry.target);
          if (callback) {
            // Use more precise contentRect from ResizeObserver
            const rect = entry.target.getBoundingClientRect();
            scheduleUpdate(() => callback(rect));
          }
        });
      });
    }
  }

  /**
   * Start observing an element for size changes
   */
  observe(element: Element, callback: (rect: DOMRect) => void): void {
    this.callbacks.set(element, callback);
    
    if (this.observer) {
      this.observer.observe(element);
    }
    
    // Initial measurement
    const rect = element.getBoundingClientRect();
    scheduleUpdate(() => callback(rect));
  }

  /**
   * Stop observing an element
   */
  unobserve(element: Element): void {
    this.callbacks.delete(element);
    
    if (this.observer) {
      this.observer.unobserve(element);
    }
  }

  /**
   * Clean up all observations
   */
  disconnect(): void {
    this.callbacks.clear();
    
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// ============================================================
// Animation Performance Utilities
// ============================================================

/**
 * Optimized CSS transform builder that minimizes string allocations
 */
export class TransformBuilder {
  private transforms: string[] = [];

  translate3d(x: number, y: number, z: number = 0): this {
    this.transforms.push(`translate3d(${x}px, ${y}px, ${z}px)`);
    return this;
  }

  scale(scale: number): this {
    this.transforms.push(`scale(${scale})`);
    return this;
  }

  rotate(degrees: number): this {
    this.transforms.push(`rotate(${degrees}deg)`);
    return this;
  }

  build(): string {
    const result = this.transforms.join(' ');
    this.transforms.length = 0; // Clear for reuse
    return result;
  }

  static create(): TransformBuilder {
    return new TransformBuilder();
  }
}

/**
 * Hardware acceleration utility to force GPU compositing
 */
export function enableHardwareAcceleration(element: HTMLElement): void {
  element.style.willChange = 'transform';
  element.style.transform = 'translateZ(0)';
}

/**
 * Disable hardware acceleration to free up GPU resources
 */
export function disableHardwareAcceleration(element: HTMLElement): void {
  element.style.willChange = 'auto';
  element.style.transform = '';
}

// ============================================================
// Memory Management
// ============================================================

/**
 * Weak reference utility for preventing memory leaks
 * Automatically cleans up references when objects are garbage collected
 */
export class WeakCache<T extends object, V> {
  private cache = new WeakMap<T, V>();

  set(key: T, value: V): void {
    this.cache.set(key, value);
  }

  get(key: T): V | undefined {
    return this.cache.get(key);
  }

  has(key: T): boolean {
    return this.cache.has(key);
  }

  delete(key: T): boolean {
    return this.cache.delete(key);
  }
}

/**
 * Object pool for frequently created/destroyed objects
 * Reduces garbage collection pressure
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn?: (obj: T) => void;

  constructor(createFn: () => T, resetFn?: (obj: T) => void) {
    this.createFn = createFn;
    this.resetFn = resetFn;
  }

  acquire(): T {
    const obj = this.pool.pop() ?? this.createFn();
    return obj;
  }

  release(obj: T): void {
    if (this.resetFn) {
      this.resetFn(obj);
    }
    this.pool.push(obj);
  }
}

// ============================================================
// Performance Monitoring
// ============================================================

/**
 * Simple performance monitor for debugging animation performance
 */
export class PerformanceMonitor {
  private marks = new Map<string, number>();
  private measures: Array<{ name: string; duration: number }> = [];

  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string): number {
    const startTime = this.marks.get(startMark);
    if (startTime === undefined) {
      throw new Error(`Start mark '${startMark}' not found`);
    }

    const duration = performance.now() - startTime;
    this.measures.push({ name, duration });
    
    return duration;
  }

  getMeasures(): Array<{ name: string; duration: number }> {
    return [...this.measures];
  }

  clear(): void {
    this.marks.clear();
    this.measures.length = 0;
  }
}

// Global performance monitor instance for debugging
export const perfMonitor = new PerformanceMonitor();