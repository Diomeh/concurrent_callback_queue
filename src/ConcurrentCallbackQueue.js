/*
 * Copyright 2024 David Urbina <davidurbina.dev@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Defines all the possible options that can be set when creating a new queue.
 *
 * @typedef {Object} QueueOptions
 * @property {boolean} autoStart - Indicates if the queue should start execution automatically when a callback is added.
 * @property {number} maxConcurrent - Maximum number of callbacks that can be executed in parallel.
 * @property {Function} onCallbackError - Callback that is executed when an error occurs while executing a callback, receives the error as a parameter.
 * @property {Function} onCallbackSuccess - Callback that is executed after a callback successfully executes.
 * @property {Function} onQueueIdle - Callback that is executed when the queue goes to IDLE state.
 * @property {Function} onQueueBusy - Callback that is executed when the queue goes to BUSY state.
 * @property {Function} onQueueStop - Callback that is executed when the queue stops.
 */

/**
 * Defines all the possible states the queue can be in.
 *
 * @typedef {Object} QueueStates
 * @property {string} IDLE - There are no pending callbacks and the queue will start processing as soon as a callback is added.
 * @property {string} BUSY - Currently processing callbacks up to the maximum concurrent limit.
 * @property {string} STOPPED - Processing has been stopped and no further callbacks will be executed unless the queue is started again.
 */

/**
 * Defines the structure of a callback tuple.
 *
 * @typedef {Object} CallbackTuple
 * @property {Function} callback - The callback function to execute.
 * @property {number} retries - Number of retry attempts in case of an error.
 */

/**
 * Empty function used as a default callback for lifecycle hooks and callback events.
 *
 * @returns {void}
 * @ignore
 */
const noop = () => {};

/**
 * The default options that are used when creating a new queue.
 * This object is frozen to prevent modifications to the default values.
 * For hooks, a do-nothing (noop) function is used.
 *
 * @type {QueueOptions}
 *
 * @example
 * const defaultQueueOptions = {
 *   autoStart: true,
 *   maxConcurrent: 10,
 *   onCallbackError: noop,
 *   onCallbackSuccess: noop,
 *   onQueueIdle: noop,
 *   onQueueBusy: noop,
 *   onQueueStop: noop,
 * };
 */
const defaultQueueOptions = Object.freeze({
  autoStart: true,
  maxConcurrent: 10,
  onCallbackError: noop,
  onCallbackSuccess: noop,
  onQueueIdle: noop,
  onQueueBusy: noop,
  onQueueStop: noop,
});

/**
 * Enumerates the possible states that the queue can be in.
 * This object is frozen to prevent modifications to the state values.
 *
 * @type {QueueStates}
 * @example
 * const QueueState = {
 *   IDLE: "IDLE",
 *   BUSY: "BUSY",
 *   STOPPED: "STOPPED",
 * };
 */
const QueueState = Object.freeze({
  IDLE: "IDLE",
  BUSY: "BUSY",
  STOPPED: "STOPPED",
});

/**
 * A queue implementation that allows for concurrent execution of asynchronous operations.
 *
 * This class provides a way to schedule and manage a queue of callback functions that will be executed concurrently, up to a specified limit.
 * When the maximum number of concurrent callbacks is reached, the queue will wait until one of the running callbacks finishes before starting a new one.
 * The queue can be configured to start automatically when a callback is added, and it can also be stopped and restarted as needed.
 *
 * A main use case is to manage asynchronous operations that need to be executed in parallel,
 * such as making multiple API requests or processing a large number of files.
 *
 * @example Basic usage
 * const queue = new ConcurrentCallbackQueue();
 * queue.enqueue(() => fetch('https://httpstat.us/200,400?sleep=2000'));
 *
 * @example Custom options
 * const queue = new ConcurrentCallbackQueue({
 *    autoStart: false,
 *    onCallbackError: (error) => console.error(error),
 * });
 * queue.enqueue(() => throw new Error('Error'));
 * queue.start();
 *
 * @example Multiple callbacks
 * const queue = new ConcurrentCallbackQueue();
 * queue.enqueueAll([
 *   () => fetch('https://httpstat.us/200,400?sleep=2000'),
 *   () => fetch('https://httpstat.us/200,400?sleep=2000'),
 * ]);
 *
 * @author David Urbina (davidurbina.dev@gmail.com)
 * @version 0.8.28
 * @since 2023-03-23
 * @tutorial 01 - Basic Usage
 * @tutorial 02 - Advanced Usage
 */
class ConcurrentCallbackQueue {
  /**
   * List of pending callbacks to execute concurrently.
   *
   * This property holds an array of functions representing the callbacks that are waiting to be executed.
   *
   * @type {Array<CallbackTuple>}
   * @private
   */
  #pending;

  /**
   * Callbacks currently running
   *
   * Each callback is stored with a unique index to identify it
   *
   * @type {Map<number, Function>}
   * @private
   */
  #running;

  /**
   * Represents the current state of the queue.
   *
   * This property holds the state of the queue as a string, indicating its current status.
   * The possible states are IDLE, BUSY, and STOPPED.
   *
   * @type {string}
   * @see QueueState
   * @see QueueStates
   * @private
   */
  #state;

  /**
   * Number of callbacks currently running.
   *
   * This property keeps track of the count of callbacks that are currently being executed.
   *
   * @type {number}
   * @see ConcurrentCallbackQueue#maxConcurrent
   * @private
   */
  #concurrent;

  /**
   * Queue configuration options
   *
   * @type {QueueOptions}
   * @private
   */
  #options;

  /**
   * Creates a new concurrent callback queue.
   *
   * @param {QueueOptions} options - Queue configuration options.
   * @class
   * @see QueueOptions
   * @public
   */
  constructor(options = defaultQueueOptions) {
    this.#pending = [];
    this.#running = new Map();
    this.#concurrent = 0;
    this.#initOptions(options);

    // Set the initial state of the queue
    this.#state = this.#options.autoStart
      ? QueueState.IDLE
      : QueueState.STOPPED;
  }

  /**
   * Creates a new concurrent callback queue.
   *
   * @param {QueueOptions} options - Queue configuration options.
   * @returns {ConcurrentCallbackQueue} The new queue instance.
   * @class
   * @see QueueOptions
   * @static
   * @public
   */
  static create(options = defaultQueueOptions) {
    return new ConcurrentCallbackQueue(options);
  }

  /********************************************/
  /** Internal API ******************************/

  /**
   * Initializes the queue configuration options, merging the defaults with the provided options.
   *
   * @param {QueueOptions|Object} options - Queue configuration options.
   * @returns {void}
   *
   * @private
   */
  #initOptions(options) {
    this.#options = {
      ...defaultQueueOptions,
      ...(options || {}),
    };

    const hooks = [
      "onCallbackError",
      "onCallbackSuccess",
      "onQueueIdle",
      "onQueueBusy",
      "onQueueStop",
    ];

    // Strip properties not defined in QueueOptions
    for (const key in this.#options) {
      if (!(key in defaultQueueOptions)) {
        delete this.#options[key];
        continue;
      }

      // Set a noop for unspecified callbacks to avoid checking if they are functions in each call
      // We do this as a means of ensuring that the callbacks are always functions
      if (
        hooks.includes(key) &&
        (!this.#options[key] || typeof this.#options[key] !== "function")
      ) {
        this.#options[key] = noop;
      }
    }
  }

  /**
   * Sets the state of the queue and triggers the corresponding event.
   *
   * @param {string} state - The new state of the queue.
   * @returns {string} - The previous state of the queue.
   * @private
   */
  #setState(state) {
    const prevState = this.#state;
    this.#state = state;

    // Trigger queue state events as needed
    switch (state) {
      case QueueState.IDLE:
        this.#options.onQueueIdle();
        break;
      case QueueState.BUSY:
        this.#options.onQueueBusy();
        break;
      case QueueState.STOPPED:
        this.#options.onQueueStop();
        break;
    }

    return prevState;
  }

  /**
   * Handles errors that occur during the execution of a callback.
   *
   * @param {Error} error - The error object.
   * @returns {void}
   * @private
   */
  #handleError(error) {
    this.#options.onCallbackError(error);
  }

  /**
   * Builds a retry mechanism for a callback function.
   *
   * @param {CallbackTuple} tuple - Tuple containing the callback function and the number of retries.
   * @returns {Function} - The callback function wrapped in a retry mechanism.
   */
  #buildRetryCallback(tuple) {
    const callback = tuple?.callback;
    const retries = tuple?.retries || 0;

    const retryCallback = async (currentRetry) => {
      try {
        await callback();
      } catch (error) {
        if (currentRetry < retries) {
          // Retry the callback if the number of retries has not been reached
          // Exec error hook
          this.#handleError(error);
          await retryCallback(currentRetry + 1);
        } else {
          // Rethrow the error if the number of retries has been reached
          throw error;
        }
      }
    };

    return () => retryCallback(0);
  }

  /**
   * Processes the next callback in the queue, if possible.
   *
   * @returns {void}
   * @private
   */
  #processNext() {
    if (
      // Has the user stopped the queue?
      this.#state === QueueState.STOPPED ||
      // Do we have room for more concurrent tasks?
      this.#concurrent >= this.#options.maxConcurrent
    ) {
      return;
    }

    // Are there any more pending callbacks?
    if (this.#pending.length === 0) {
      // Are we done processing all callbacks?
      // If so, idle until a new callback is added
      if (this.#concurrent === 0) {
        this.#setState(QueueState.IDLE);
      }

      return;
    }

    // Prevent any race conditions by checking the tuple directly
    // as dequeue() could return undefined if the queue is empty
    const tuple = this.dequeue();
    if (!tuple) {
      // idle until a new callback is added
      this.#setState(QueueState.IDLE);
      return;
    }

    // Build a retry mechanism for the callback
    const callback = this.#buildRetryCallback(tuple);
    const index = Date.now();

    Promise.resolve()
      .then(() => {
        // Update state
        this.#concurrent++;
        this.#running.set(index, callback);

        return callback();
      })
      .then(() => this.#options.onCallbackSuccess())
      .catch((error) => this.#handleError(error))
      .finally(() => {
        this.#concurrent--;
        this.#running.delete(index);

        // This block could be executed after the queue has been stopped
        // or the main execution interval has been cleared
        // therefore, we need to update state even if it looks redundant
        // to avoid race conditions

        // Check if this is the last running task and set to IDLE if so
        // only when user has not stopped the queue
        if (
          this.#state === QueueState.BUSY &&
          this.#concurrent === 0 &&
          this.#pending.length === 0
        ) {
          this.#setState(QueueState.IDLE);
        }
      });
  }

  /**
   * Main execution loop for the queue.
   *
   * @returns {void}
   * @private
   */
  #run() {
    // Immediately process the first callback
    this.#processNext();

    // Use an interval to process the next callback
    // This allows promises to resolve in the next microtask
    // while still processing the next callback in the queue

    // A loop will run forever as queue state updates are done within promise resolution
    // and promises are only resolved on the next microtask after loop iteration

    // OTOH, while a recursive approach could be used, with big enough queues
    // it could lead to a stack overflow
    const interval = setInterval(() => {
      this.#processNext();

      // Clear the interval after we're done processing all callbacks
      // or if the queue has been stopped by the user
      // State updates are done within promise resolution in #processNext
      if (this.#state !== QueueState.BUSY || this.#pending.length === 0) {
        clearInterval(interval);
      }
    });
  }

  /********************************************/
  /** Public API ******************************/

  /********************************************/
  /** Getters *********************************/

  /**
   * Returns the current state of the queue.
   *
   * @returns {string}
   * @public
   */
  getState() {
    return this.#state;
  }

  /**
   * Returns the number of pending callbacks in the queue.
   *
   * @returns {number}
   * @public
   */
  getPendingCount() {
    return this.#pending.length;
  }

  /**
   * Returns the number of running callbacks in the queue.
   *
   * @returns {number}
   * @public
   */
  getRunningCount() {
    return this.#concurrent;
  }

  /**
   * Returns the current queue configuration options.
   */
  getOptions() {
    return this.#options;
  }

  /********************************************/
  /** Queue Operations ************************/

  /**
   * Adds a callback to the queue, if autoStart is enabled the queue execution starts.
   * You can specify an optional number of retries in case of an error.
   *
   * @param {Function} callback - The callback function to add to the queue.
   * @param {number} [retries=0] - Number of retry attempts in case of an error (optional).
   * @returns {void}
   * @throws {Error} If the callback is not a function or retries is not a number.
   *
   * @public
   */
  enqueue(callback, retries = 0) {
    if (typeof callback !== "function") {
      throw new Error(
        'The "callback" parameter must be a function or a promise',
      );
    }

    if (typeof retries !== "number" || retries < 0) {
      throw new Error('The "retries" parameter must be a positive number');
    }

    this.#pending.push({ callback, retries });
    if (this.#options.autoStart) {
      this.start();
    }
  }

  /**
   * Adds multiple callbacks to the queue, if autoStart is enabled the queue execution starts.
   * You can specify an optional number of retry attempts in case of an error.
   *
   * @param {Array<Function>} callbacks - The array of callback functions to add to the queue.
   * @param {number} [retries=0] - Number of retry attempts in case of an error for all callbacks (optional).
   * @returns {void}
   * @throws {Error} If callbacks is not an array of functions or retries is not a number.
   *
   * @public
   */
  enqueueAll(callbacks, retries = 0) {
    if (
      !Array.isArray(callbacks) ||
      !callbacks.every((callback) => typeof callback === "function")
    ) {
      throw new Error(
        'The "callbacks" parameter must be an array of functions or promises',
      );
    }

    if (typeof retries !== "number" || retries < 0) {
      throw new Error('The "retries" parameter must be a positive number');
    }

    // Map callbacks to a <function, number> tuple to store the number of retries
    const tuples = callbacks.map((callback) => ({ callback, retries }));
    this.#pending.push(...tuples);

    if (this.#options.autoStart) {
      this.start();
    }
  }

  /**
   * Removes a pending callback from the queue without stopping execution.
   *
   * @return {CallbackTuple|undefined} Removed callback tuple or undefined if the queue is empty.
   * @public
   */
  dequeue() {
    return this.#pending.shift();
  }

  /**
   * Removes all pending callbacks from the queue without stopping the queue execution.
   *
   * @returns {Array<CallbackTuple>} List of pending callbacks
   * @public
   */
  dequeueAll() {
    const queue = this.#pending;
    this.#pending = [];
    return queue;
  }

  /********************************************/
  /** Queue Control ***************************/

  /**
   * Starts the execution of the queue.
   *
   * If the queue is stopped at any point and then restarted,
   * the execution resumes from the last pending callback.
   *
   * @returns {void}
   * @public
   */
  start() {
    if (this.#state === QueueState.BUSY || this.#pending.length === 0) {
      return;
    }

    this.#setState(QueueState.BUSY);
    this.#run();
  }

  /**
   * Stops the execution of the queue, but does not remove pending callbacks.
   *
   * Calling this method will not stop the execution of callbacks that are already being processed,
   * nor will it remove pending callbacks from the queue, so if the queue is restarted,
   * it will resume from the last pending callback.
   * Sets the queue state to STOPPED.
   *
   * @returns {void}
   * @public
   */
  stop() {
    this.#setState(QueueState.STOPPED);
  }

  /**
   * Stops the execution of the queue and removes all pending callbacks from it.
   *
   * @returns {Array<CallbackTuple>} List of pending callbacks
   * @public
   */
  clear() {
    this.stop();
    return this.dequeueAll();
  }
}

export { ConcurrentCallbackQueue, QueueState, defaultQueueOptions };
