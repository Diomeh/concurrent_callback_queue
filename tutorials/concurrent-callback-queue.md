# Using Concurrent Callback Queue

This tutorial will guide you through the steps of using the `ConcurrentCallbackQueue` to manage and execute callbacks concurrently. 

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Basic Usage](#basic-usage)
4. [Advanced Configuration](#advanced-configuration)
5. [Handling Callbacks](#handling-callbacks)
6. [Queue Management](#queue-management)
7. [Examples](#examples)

## Introduction

The `ConcurrentCallbackQueue` is a powerful utility for managing the execution of multiple callbacks concurrently. It allows you to control the number of concurrent executions, handle errors, and define custom behaviors for various queue states.

## Installation

### Script Tag

You can include the `ConcurrentCallbackQueue.js` file directly in your HTML:

```html
<script src="path/to/ConcurrentCallbackQueue.js"></script>
```

### Module Import

If you are using a module bundler like Webpack or a module-based project setup, you can import it:

```javascript
import ConcurrentCallbackQueue from './path/to/ConcurrentCallbackQueue.js';
```

## Basic Usage

### Creating a Queue

To create a queue, simply instantiate the `ConcurrentCallbackQueue` class:

```javascript
const queue = new ConcurrentCallbackQueue();
```

### Adding Callbacks

You can add a callback to the queue using the enqueue method:

```javascript
queue.enqueue(() => {
    console.log('Callback executed');
});
```

### Starting the Queue

If autoStart is not enabled, you need to start the queue manually:

```javascript
queue.start();
```

## Advanced Configuration

The `ConcurrentCallbackQueue` class can be configured with various options during instantiation:

```javascript
const queue = new ConcurrentCallbackQueue({
    autoStart: false,
    maxConcurrent: 3,
    onCallbackError: (error) => console.error('Error:', error),
    onCallbackSuccess: () => console.log('Callback succeeded'),
    onQueueIdle: () => console.log('Queue is idle'),
    onQueueBusy: () => console.log('Queue is busy'),
    onQueueStop: () => console.log('Queue stopped'),
});
```

### Configuration Options

- `autoStart` (boolean): Automatically start the queue when a callback is added.
- `maxConcurrent` (number): Maximum number of concurrent executions.
- `onCallbackError` (function): Function called on callback error.
- `onCallbackSuccess` (function): Function called on callback success.
- `onQueueIdle` (function): Function called when the queue is idle.
- `onQueueBusy` (function): Function called when the queue is busy.
- `onQueueStop` (function): Function called when the queue stops.

## Handling Callbacks

### Adding Callbacks with Retries

You can specify the number of retries for a callback in case of errors:

```javascript
queue.enqueue(() => {
    // Callback code
}, 3);
```

### Adding Multiple Callbacks

You can add multiple callbacks at once using enqueueAll:

```javascript
const callbacks = [
    () => console.log('Callback 1'),
    () => console.log('Callback 2'),
];

queue.enqueueAll(callbacks, 2);
```

## Queue Management

### Starting the Queue

To start the queue manually:

```javascript
queue.start();
```

### Stopping the Queue

To stop the queue without clearing the pending callbacks:

```javascript
queue.stop();
```

### Clearing the Queue

To stop the queue and clear all pending callbacks:

```javascript
queue.clear();
```

### Removing Callbacks

To remove a single pending callback:

```javascript
queue.dequeue();
```

To remove all pending callbacks:

```javascript
queue.dequeueAll();
```

## Examples

### Example 1: Basic Usage

```javascript
const queue = new ConcurrentCallbackQueue({ autoStart: true, maxConcurrent: 2 });

queue.enqueue(() => {
    console.log('Callback 1 executed');
});

queue.enqueue(() => {
    console.log('Callback 2 executed');
});
```

### Example 2: Using Callbacks with Retries

```javascript
const queue = new ConcurrentCallbackQueue({ maxConcurrent: 1 });

queue.enqueue(() => {
    return new Promise((resolve, reject) => {
        // Simulate an async operation
        setTimeout(() => {
            console.log('Callback executed');
            resolve();
        }, 1000);
    });
}, 2);

queue.start();
```

### Example 3: Handling Callback Success and Error

```javascript
const queue = new ConcurrentCallbackQueue({
    onCallbackSuccess: () => console.log('Callback succeeded'),
    onCallbackError: (error) => console.error('Error:', error),
});

queue.enqueue(() => {
    return new Promise((resolve, reject) => {
        // Simulate a callback with an error
        setTimeout(() => {
            reject(new Error('Something went wrong'));
        }, 1000);
    });
});

queue.start();
```
