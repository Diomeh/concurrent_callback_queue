"use strict";

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
 * @property {string} IDLE - The pending queue is empty and will start processing as soon as a callback is added.
 * @property {string} BUSY - The queue is processing callbacks.
 * @property {string} STOPPED - The queue has been stopped and will not process any more callbacks until it is started.
 */

/**
 * Empty function used as a default callback.
 *
 * @returns {void}
 */
const noop = () => {
};

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
	onCallbackError: noop,
	onCallbackSuccess: noop,
	onQueueIdle: noop,
	onQueueBusy: noop,
	onQueueStop: noop,
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
	 * @see QueueOptions
	 * @public
	 */
	constructor(options = defaultQueueOptions) {
		this.#pending = [];
		this.#running = new Map();
		this.#concurrent = 0;
		this.#initOptions(options);

		// Set the initial state of the queue
		this.#state = this.#options.autoStart ? QueueState.IDLE : QueueState.STOPPED;
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
			...options || {},
		};

		const hooks = ['onCallbackError', 'onCallbackSuccess', 'onQueueIdle', 'onQueueBusy', 'onQueueStop'];

		// Strip properties not defined in QueueOptions
		for (const key in this.#options) {
			if (!(key in defaultQueueOptions)) {
				delete this.#options[key];
				continue;
			}

			// Set a noop for unspecified callbacks to avoid checking if they are functions in each call
			// We do this as a means of ensuring that the callbacks are always functions
			if (hooks.includes(key) && (!this.#options[key] || typeof this.#options[key] !== 'function')) {
				this.#options[key] = noop;
			}
		}
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
			throw new Error('The "callbacks" parameter must be an array of functions or promises');
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

		this.#setState(QueueState.BUSY);
		this.#run();
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
	 * Executes the callbacks in the queue concurrently.
	 *
	 * @returns {void}
	 * @private
	 */
	#run() {
		if (this.#state === QueueState.BUSY) {
			if (this.#pending.length > 0) {
				while (this.#shouldProcess()) {
					const callback = this.dequeue();
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
							this.#run();
						});
				}
			} else if (this.#concurrent === 0) {
				this.#setState(QueueState.IDLE);
			}
		}
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
}

module.exports = {
	ConcurrentCallbackQueue,
	QueueState,
	defaultQueueOptions,
};
