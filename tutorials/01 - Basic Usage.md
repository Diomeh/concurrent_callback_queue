This tutorial will guide you through the most basic usage cases.

It is assumed that you have already installed the package.

## Table of Contents

1. [Basic usage](#simple-usage)
2. [Scheduling callbacks](#scheduling-callbacks)
3. [Handling errors](#handling-errors)
4. [Advanced Configuration](#advanced-configuration)
5. [Configuration Options](#configuration-options)

## Simple usage

The most basic example of using the callback queue is to add a single callback and execute it,
though it is not very useful in practice.

```javascript
const queue = new CallbackQueue();
queue.enqueue(() => console.log("Hello, world!"));
```

In this example, we create a new `CallbackQueue` instance and add a single callback that logs
"Hello, world!" to the console. The callback is executed immediately after being added to the queue.

## Scheduling callbacks

The callback queue allows you to schedule callbacks to be executed at a later time.
This is achieved by disabling the `autoStart` option and manually starting the queue.

```javascript
const queue = new CallbackQueue({ autoStart: false });
queue.enqueue(() => console.log("Hello World!"));

// Some other code...

queue.start();
```

In this example, we create a new `CallbackQueue` instance with the `autoStart` option set to `false`.
We then add a single callback that logs "Hello World!" to the console. The callback is not executed
until we manually start the queue using the `start` method.

## Handling errors

You can handle errors that occur during the execution of a callback by providing an `onCallbackError`
handler when creating the queue.

```javascript
const queue = new CallbackQueue({
  onCallbackError: (error) => console.error("An error occurred:", error),
});

queue.enqueue(() => {
  throw new Error("Something went wrong!");
});
```

In this example, we create a new `CallbackQueue` instance with an `onCallbackError` handler that logs
any errors that occur during the execution of a callback. We then add a callback that throws an error,
which is caught by the error handler.

The error handler recieves the error object as an argument, allowing you to log or handle the error as you see fit.

# Advanced Configuration

The `CallbackQueue` class can be configured with various options during instantiation:

```javascript
const queue = new CallbackQueue({
  autoStart: false,
  maxConcurrent: 3,
  onCallbackError: (error) => console.error("Error:", error),
  onCallbackSuccess: () => console.log("Callback succeeded"),
  onQueueIdle: () => console.log("Queue is idle"),
  onQueueBusy: () => console.log("Queue is busy"),
  onQueueStop: () => console.log("Queue stopped"),
});
```

### Configuration Options

- `autoStart` (boolean): Automatically start the queue when a callback is added.
- `maxConcurrent` (number): Maximum number of concurrent executions.
- `onCallbackError` (function): Function called on callback error.
- `onCallbackSuccess` (function): Function called on callback success.
- `onQueueIdle` (function): Function called when the queue goes idle.
- `onQueueBusy` (function): Function called when the queue goes busy.
- `onQueueStop` (function): Function called when the queue stops.

Regarding function arguments:

- `onQueue*` hooks don't take any arguments.
- `onCallbackSuccess` doesn't take any arguments.
- `onCallbackError` takes the `error` (object) as an argument.
