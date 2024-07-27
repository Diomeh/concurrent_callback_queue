// noinspection JSCheckFunctionSignatures

const {
	ConcurrentCallbackQueue,
	QueueState,
	defaultQueueOptions,
} = require('../src/ConcurrentCallbackQueue');

const compareOptions = (options, expected) => {
	expect(options.autoStart).toBe(expected.autoStart);
	expect(options.maxConcurrent).toBe(expected.maxConcurrent);
	expect(options.onCallbackSuccess).toBe(expected.onCallbackSuccess);
	expect(options.onCallbackError).toBe(expected.onCallbackError);
	expect(options.onQueueIdle).toBe(expected.onQueueIdle);
	expect(options.onQueueBusy).toBe(expected.onQueueBusy);
	expect(options.onQueueStop).toBe(expected.onQueueStop);
}

describe('ConcurrentCallbackQueue', () => {
	test('should create an instance with default options', () => {
		const queue = new ConcurrentCallbackQueue();
		const options = queue.getOptions();
		compareOptions(options, defaultQueueOptions);
	});

	test('should create an instance from static function', () => {
		const queue = ConcurrentCallbackQueue.create();
		const options = queue.getOptions();
		compareOptions(options, defaultQueueOptions);
	});

	test('should create an instance from null options', () => {
		const queue = ConcurrentCallbackQueue.create(null);
		const options = queue.getOptions();
		compareOptions(options, defaultQueueOptions);
	});

	test('should strip invalid options on creation', () => {
		// Invalid options should be stripped or corrected
		// on* hooks should default to a noop function if missing or invalid
		// this is so in defaultQueueOptions
		const options = {
			autoStart: true,
			maxConcurrent: 10,
			onCallbackSuccess: null,
			// onCallbackError: 'invalid',
			onQueueIdle: false,
			onQueueBusy: 0,
			onQueueStop: 'invalid',
			foo: 'bar',
			bar: false,
			baz: null,
		};

		const queue = new ConcurrentCallbackQueue(options);
		expect(queue.getOptions()).toEqual(defaultQueueOptions);
	});

	test('should set custom options on creation', () => {
		const onCallbackSuccess = jest.fn();
		const queue = new ConcurrentCallbackQueue({
			autoStart: false,
			maxConcurrent: 5,
			onCallbackSuccess
		});
		const options = queue.getOptions();

		expect(queue.getState()).toBe(QueueState.STOPPED);
		expect(options.maxConcurrent).toBe(5);
		expect(options.autoStart).toBe(false);
		expect(options.onCallbackSuccess).toBe(onCallbackSuccess);
	});

	test('should enqueue a single callback and process it', async () => {
		const onCallbackSuccess = jest.fn();
		const queue = new ConcurrentCallbackQueue({onCallbackSuccess});
		const mockCallback = jest.fn().mockResolvedValue(true);

		queue.enqueue(mockCallback);
		queue.start();
		expect(queue.getState()).toBe(QueueState.BUSY);

		// Wait for the callback to process
		await new Promise((resolve) => {
			setTimeout(resolve, 100)
		});

		expect(mockCallback).toHaveBeenCalled();
		expect(onCallbackSuccess).toHaveBeenCalled();
	});

	test('should trigger exceptions on enqueueing', () => {
		const queue = new ConcurrentCallbackQueue();

		try {
			queue.enqueue(false);
		} catch (e) {
			expect(e.message).toBe('The "callback" parameter must be a function or a promise');
		}

		try {
			queue.enqueue(() => {
			}, "foo");
		} catch (e) {
			expect(e.message).toBe('The "retries" parameter must be a positive number');
		}
	});

	test('should handle callback errors and retry', async () => {
		const onCallbackError = jest.fn();
		const queue = new ConcurrentCallbackQueue({onCallbackError});
		const mockCallback = jest.fn().mockRejectedValue(new Error('Test Error'));

		queue.enqueue(mockCallback, 2); // 2 retries

		// Wait for the callback to process
		await new Promise((resolve) => {
			setTimeout(resolve, 100)
		});

		expect(mockCallback).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
		expect(onCallbackError).toHaveBeenCalledWith(expect.any(Error));
	});

	test('should enqueue multiple callbacks', async () => {
		const queue = new ConcurrentCallbackQueue();
		const callbacks = Array.from({length: 5}, (_, i) => jest.fn().mockResolvedValue(i));

		queue.enqueueAll(callbacks);
		expect(queue.getState()).toBe(QueueState.BUSY);

		// Wait for the callbacks to process
		await new Promise((resolve) => {
			setTimeout(resolve, 100)
		});

		callbacks.forEach((callback) => {
			expect(callback).toHaveBeenCalled();
		});
	});

	test('should enqueue multiple callbacks with retries', async () => {
		const queue = new ConcurrentCallbackQueue();
		const callbacks = Array.from({length: 5}, (_, i) => jest.fn().mockRejectedValue(i));

		queue.enqueueAll(callbacks, 2);
		expect(queue.getState()).toBe(QueueState.BUSY);

		// Wait for the callbacks to process
		await new Promise((resolve) => {
			setTimeout(resolve, 100)
		});

		callbacks.forEach((callback) => {
			expect(callback).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
		});
	});

	test('should trigger exceptions on enqueueing multiple callbacks', () => {
		const queue = new ConcurrentCallbackQueue();

		try {
			queue.enqueueAll(false);
		} catch (e) {
			expect(e.message).toBe('The "callbacks" parameter must be an array of functions or promises');
		}

		try {
			queue.enqueueAll([() => {
			}], {});
		} catch (e) {
			expect(e.message).toBe('The "retries" parameter must be a positive number');
		}
	});

	test('should stop and clear the pending queue', () => {
		const mockCallback = jest.fn().mockResolvedValue(0);
		const queue = new ConcurrentCallbackQueue();

		queue.enqueue(mockCallback);
		queue.stop();

		const ret = queue.dequeue();

		expect(queue.getState()).toBe(QueueState.STOPPED);
		expect(mockCallback).not.toHaveBeenCalled();
		expect(queue.getPendingCount()).toBe(0);
		expect(queue.getRunningCount()).toBe(1);
		expect(ret).toBe(undefined);
	});

	test('should clear all pending callbacks', () => {
		const queue = new ConcurrentCallbackQueue({
			autoStart: false
		});

		const length = 5;
		const callbacks = Array.from({length}, (_, i) => jest.fn().mockResolvedValue(i));

		queue.enqueueAll(callbacks);
		const clearedCallbacks = queue.clear();

		expect(queue.getState()).toBe(QueueState.STOPPED);
		expect(clearedCallbacks).toHaveLength(length);
		expect(queue.getPendingCount()).toBe(0);
		expect(queue.getRunningCount()).toBe(0);

		callbacks.forEach((callback) => {
			expect(callback).not.toHaveBeenCalled();
		});

		clearedCallbacks.forEach((callback) => {
			expect(callback).toBeInstanceOf(Function);
		});
	});

	test('should return correct state', async () => {
		const queue = new ConcurrentCallbackQueue();
		expect(queue.getState()).toBe(QueueState.IDLE);

		const mockCallback = jest.fn().mockResolvedValue(0);
		queue.enqueue(mockCallback);
		expect(queue.getState()).toBe(QueueState.BUSY);

		await new Promise((resolve) => {
			setTimeout(resolve, 100)
		});

		queue.stop();
		expect(queue.getState()).toBe(QueueState.STOPPED);
	});

	test('should properly start and stop the queue', async () => {
		const queue = new ConcurrentCallbackQueue({
			autoStart: false
		});

		expect(queue.getState()).toBe(QueueState.STOPPED);

		queue.enqueue(() => new Promise((resolve) => {
			setTimeout(resolve, 100)
		}));
		queue.start();
		expect(queue.getState()).toBe(QueueState.BUSY);

		// Wait for the callback to process
		await new Promise((resolve) => {
			setTimeout(resolve, 200)
		});
		expect(queue.getState()).toBe(QueueState.IDLE);
	});

	test('should trigger onCallbackSuccess hook', async () => {
		const onCallbackSuccess = jest.fn();
		const queue = new ConcurrentCallbackQueue({onCallbackSuccess});
		const mockCallback = jest.fn().mockResolvedValue(true);

		queue.enqueue(mockCallback);

		// Wait for the callback to process
		await new Promise((resolve) => {
			setTimeout(resolve, 100)
		});

		expect(onCallbackSuccess).toHaveBeenCalled();
	});

	test('should trigger onCallbackError hook', async () => {
		const onCallbackError = jest.fn();
		const queue = new ConcurrentCallbackQueue({onCallbackError});
		const mockCallback = jest.fn().mockRejectedValue(new Error('Test Error'));

		queue.enqueue(mockCallback);

		// Wait for the callback to process
		await new Promise((resolve) => {
			setTimeout(resolve, 100)
		});

		expect(onCallbackError).toHaveBeenCalled();
	});

	test('should trigger onQueueIdle hook', async () => {
		const onQueueIdle = jest.fn();
		const queue = new ConcurrentCallbackQueue({onQueueIdle});

		queue.enqueue(() => new Promise((resolve) => {
			setTimeout(resolve, 100)
		}));

		await new Promise((resolve) => {
			setTimeout(resolve, 200)
		});

		expect(onQueueIdle).toHaveBeenCalled();
	});

	test('should trigger onQueueBusy hook', async () => {
		const onQueueBusy = jest.fn();
		const queue = new ConcurrentCallbackQueue({onQueueBusy});

		queue.enqueue(() => new Promise((resolve) => {
			setTimeout(resolve, 100)
		}));

		expect(onQueueBusy).toHaveBeenCalled();
	});

	test('should trigger onQueueStop hook', async () => {
		const onQueueStop = jest.fn();
		const queue = new ConcurrentCallbackQueue({
			autoStart: false,
			onQueueStop,
		});

		queue.enqueue(() => new Promise((resolve) => {
			setTimeout(resolve, 100)
		}));

		queue.start();
		queue.stop();
		expect(onQueueStop).toHaveBeenCalled();
	});
});
