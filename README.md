# Concurrent Callback Queue

This JavaScript module provides a concurrent callback queue that allows you to manage and execute multiple callbacks concurrently with various configuration options. The queue ensures controlled execution of the callbacks with options for handling errors, managing concurrency levels, and defining custom behavior on different queue states.

## Features
- Concurrent Execution: Execute multiple callbacks concurrently with a configurable limit on the number of concurrent executions.
- Automatic Start: Option to automatically start the queue execution upon adding a callback.
- Retry Mechanism: Define the number of retry attempts for each callback in case of errors.
- State Management: Callbacks for different queue states (idle, busy, stopped) and events (success, error).
- Custom Callbacks: Customize behavior on callback success, error, and different queue states.

## Installation

To use the `ConcurrentCallbackQueue`, you can directly include the JavaScript file in your project.

```html
<script src="path/to/ConcurrentCallbackQueue.js"></script>
```

Or, if you're using a module bundler, you can import it:

```javascript
import ConcurrentCallbackQueue from './path/to/ConcurrentCallbackQueue.js';
```

## Usage

### Example

Here's an example of how to use the `ConcurrentCallbackQueue`:

```javascript
const queue = new ConcurrentCallbackQueue({
    autoStart: false,
    maxConcurrent: 2,
    onCallbackError: (error) => console.error(error),
});

for (let i = 0; i < 10; i++) {
    queue.enqueue(() => {
        const uri = 'https://httpstat.us/200,400?sleep=2000';
        return $.get(uri).done(() => {
            console.log(`Request ${i+1} completed`);
        });
    }, 3);
}

queue.start();
```

More detailed examples can be found in the [tutorial](tutorials/concurrent-callback-queue.md) page. 

### Configuration Options

The queue can be configured with the following options:

- `autoStart` (boolean): Whether to start the queue automatically when a callback is added.
- `maxConcurrent` (number): Maximum number of callbacks to execute concurrently.
- `onCallbackError` (function): Callback executed when an error occurs during callback execution.
- `onCallbackSuccess` (function): Callback executed after a callback is executed successfully.
- `onQueueIdle` (function): Callback executed when the queue becomes idle.
- `onQueueBusy` (function): Callback executed when the queue becomes busy.
- `onQueueStop` (function): Callback executed when the queue stops.

### API

`enqueue(callback, retries = 0)`

Adds a callback to the queue. If autoStart is enabled, it starts the queue.

- `callback` (function): The callback function to be added to the queue.
- `retries` (number, optional): Number of retry attempts in case of error.

`enqueueAll(callbacks, retries = 0)
`
Adds multiple callbacks to the queue. If autoStart is enabled, it starts the queue.

- `callbacks` (Array<function>): An array of callback functions to be added to the queue.
- `retries` (number, optional): Number of retry attempts for all callbacks in case of error.

`start()`

Starts the execution of the queue. Resumes execution if the queue was stopped.

`stop()`

Stops the execution of the queue without clearing the pending callbacks.

`clear()`

Stops the execution of the queue and clears all pending callbacks.

`dequeue()`

Removes a pending callback from the queue without stopping the queue execution.

`dequeueAll()`

Removes all pending callbacks from the queue without stopping the queue execution.

`getState()`

Returns the current state of the queue.

### Queue States

- `IDLE`: The queue is idle.
- `BUSY`: The queue is busy executing callbacks.
- `STOPPED`: The queue is stopped.

## License

This project is licensed under the MIT License.

## Author

[David Urbina](https://github.com/Diomeh)
