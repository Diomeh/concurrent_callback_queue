// noinspection JSUnusedGlobalSymbols

/**
 * Queue configuration options.
 *
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
 * Queue states definition.
 *
 * Defines all the possible states the queue can be in.
 *
 * @typedef {Object} QueueStates
 * @property {string} IDLE - The queue is idle.
 * @property {string} BUSY - The queue is processing.
 * @property {string} STOPPED - The queue has stopped.
 */

/**
 * Default queue options
 *
 * The default options that are used when creating a new queue.
 *
 * @type {QueueOptions}
 */
const defaultQueueOptions = {
    autoStart: true,
    maxConcurrent: 10,
    onCallbackError: null,
    onCallbackSuccess: null,
    onQueueIdle: null,
    onQueueBusy: null,
    onQueueStop: null,
};

/**
 * Queue states
 *
 * The possible states that the queue can be in.
 *
 * @type {QueueStates}
 */
const QueueState = {
    IDLE: 'IDLE',
    BUSY: 'BUSY',
    STOPPED: 'STOPPED',
};

/**
 * A class to manage the execution of callbacks concurrently.
 *
 * This class provides functionality to add, remove, and execute callback functions with a specified concurrency level.
 * It supports automatic retry on error, queue state management, and customizable callback events.
 *
 * @example
 * const queue = new ConcurrentCallbackQueue({
 *     autoStart: false,
 *     maxConcurrent: 2,
 *     onCallbackError: (error) => console.error(error),
 * });
 *
 * for (let i = 0; i < 10; i++) {
 *     queue.enqueue(() => {
 *         const uri = 'https://httpstat.us/200,400?sleep=2000';
 *         return $.get(uri).done(() => {
 *             console.log(`Request ${i+1} completed`);
 *         });
 *     }, 3);
 * }
 *
 * queue.start();
 *
 * @author David Urbina (davidurbina.dev@gmail.com)
 * @version 0.8.7
 * @since 2023-03-23
 * @tutorial concurrent-callback-queue
 */
class ConcurrentCallbackQueue {
    /**
     * List of pending callbacks to execute concurrently.
     *
     * This property holds an array of functions representing the callbacks that are waiting to be executed.
     *
     * @type {Array<Function>}
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
     * @public
     */
    constructor(options = defaultQueueOptions) {
        this.#pending = [];
        this.#running = new Map();
        this.#state = QueueState.IDLE;
        this.#concurrent = 0;
        this.#initOptions(options);
    }

    /**
     * Creates a new concurrent callback queue.
     *
     * @param {QueueOptions} options - Queue configuration options.
     * @returns {ConcurrentCallbackQueue} The new queue instance.
     * @class
     * @static
     * @public
     */
    static create(options = defaultQueueOptions) {
        return new ConcurrentCallbackQueue(options);
    }

    /**
     * Empty function used as a default callback.
     *
     * @returns {void}
     * @private
     */
    #noop = () => {
    };

    /**
     * Initializes the queue configuration options, merging the defaults with the provided options.
     *
     * @param {QueueOptions} options - Queue configuration options.
     * @returns {void}
     *
     * @private
     */
    #initOptions(options) {
        this.#options = {
            ...defaultQueueOptions,
            ...options,
        };

        // Set a noop for unspecified callbacks to avoid checking if they are functions in each call
        this.#options.onCallbackError = typeof options.onCallbackError === 'function' ? options.onCallbackError : this.#noop;
        this.#options.onCallbackSuccess = typeof options.onCallbackSuccess === 'function' ? options.onCallbackSuccess : this.#noop;
        this.#options.onQueueIdle = typeof options.onQueueIdle === 'function' ? options.onQueueIdle : this.#noop;
        this.#options.onQueueBusy = typeof options.onQueueBusy === 'function' ? options.onQueueBusy : this.#noop;
        this.#options.onQueueStop = typeof options.onQueueStop === 'function' ? options.onQueueStop : this.#noop;
    }

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
        if (typeof callback !== 'function') {
            throw new Error('The "callback" parameter must be a function or a promise');
        }

        if (typeof retries !== 'number' || retries < 0) {
            throw new Error('The "retries" parameter must be a positive number');
        }

        const retryCallback = async (currentRetry) => {
            try {
                await callback();
            } catch (error) {
                if (currentRetry < retries) {
                    console.warn(`Error executing callback. Retrying (${currentRetry + 1}/${retries})...`);
                    await retryCallback(currentRetry + 1);
                } else {
                    this.#handleError(error);
                }
            }
        };

        this.#pending.push(() => retryCallback(0));
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
        if (!Array.isArray(callbacks) || !callbacks.every(callback => typeof callback === 'function')) {
            throw new Error('The "callbacks" parameter must be an array of functions');
        }

        if (typeof retries !== 'number' || retries < 0) {
            throw new Error('The "retries" parameter must be a positive number');
        }

        const retryCallbacks = callbacks.map(callback => {
            const retryCallback = async (currentRetry) => {
                try {
                    await callback();
                } catch (error) {
                    if (currentRetry < retries) {
                        console.warn(`Error executing callback. Retrying (${currentRetry + 1}/${retries})...`);
                        await retryCallback(currentRetry + 1);
                    } else {
                        this.#handleError(error);
                    }
                }
            };

            return () => retryCallback(0);
        });

        this.#pending.push(...retryCallbacks);

        if (this.#options.autoStart) {
            this.start();
        }
    }

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

        this.#state = QueueState.BUSY;
        this.#processIfNecessary();
    }

    /**
     * Executes the callbacks in the queue concurrently.
     *
     * @returns {void}
     * @private
     */
    #process() {
        while (this.#shouldProcess()) {
            const callback = this.#pending.shift();
            this.#concurrent++;
            const index = Date.now();
            this.#running.set(index, callback);

            Promise.resolve()
                .then(() => callback())
                .then(() => this.#options.onCallbackSuccess())
                .catch((error) => this.#handleError(error))
                .finally(() => {
                    this.#concurrent--;
                    this.#running.delete(index);
                    this.#processIfNecessary();
                });
        }

        // Check if the queue is now idle or busy
        if (this.#state === QueueState.IDLE) {
            this.#options.onQueueIdle();
        } else if (this.#state === QueueState.BUSY) {
            this.#options.onQueueBusy();
        } else if (this.#state === QueueState.STOPPED) {
            this.#options.onQueueStop();
        }
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
     * Determines if the queue should be processed
     *
     * @returns {boolean} True if the queue should be processed, false otherwise
     * @private
     */
    #shouldProcess() {
        return this.#state === QueueState.BUSY
            && this.#concurrent < this.#options.maxConcurrent
            && this.#pending.length > 0;
    }

    /**
     * Checks the state of the queue and processes it if necessary.
     *
     * @returns {void}
     * @private
     */
    #processIfNecessary() {
        if (this.#state === QueueState.BUSY) {
            if (this.#pending.length > 0) {
                this.#process();
            } else if (this.#concurrent === 0) {
                this.stop();
            }
        }
    }

    /**
     * Stops the execution of the queue, but does not remove pending callbacks.
     *
     * Calling this method will not stop the execution of callbacks that are already being processed,
     * nor will it remove pending callbacks from the queue, so if the queue is restarted,
     * it will resume from the last pending callback.
     *
     * @returns {void}
     * @public
     */
    stop() {
        this.#state = QueueState.IDLE;
    }

    /**
     * Stops the execution of the queue and removes all callbacks from it.
     *
     * @returns {Array<Function>} List of pending callbacks
     * @public
     */
    clear() {
        this.stop();
        return this.dequeueAll();
    }

    /**
     * Removes a pending callback from the queue without stopping the queue execution.
     *
     * @return {Function} Removed callback
     * @public
     */
    dequeue() {
        return this.#pending.shift();
    }

    /**
     * Removes all pending callbacks from the queue without stopping the queue execution.
     *
     * @returns {Array<Function>} List of pending callbacks
     * @public
     */
    dequeueAll() {
        const queue = this.#pending;
        this.#pending = [];
        return queue;
    }

    /**
     * Returns the current state of the queue.
     *
     * @returns {string}
     * @public
     */
    getState() {
        return this.#state;
    }
}
