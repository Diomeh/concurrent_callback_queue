# Concurrent Callback Queue

![GitHub Release](https://img.shields.io/github/v/release/Diomeh/concurrent_callback_queue)
<img alt="NPM Version" src="https://img.shields.io/npm/v/%40diomeh%2Fconcurrent_callback_queue?link=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40diomeh%2Fconcurrent_callback_queue">
[![jsDelivr](https://data.jsdelivr.com/v1/package/npm/@diomeh/concurrent_callback_queue/badge)](https://www.jsdelivr.com/package/npm/@diomeh/concurrent_callback_queue)
![Code Coverage](https://img.shields.io/badge/coverage-99.36%25-yellowgreen)

A simple, lightweight, zero dependencies pure JavaScript queue implementation that allows for asynchronous operations such as API calls
heavy computations or large file processing to be scheduled for execution in a parallel fashion.

The project consists of a single `ConcurrentCallbackQueue` class that provides a simple API to manage the execution of multiple callbacks concurrently with a
configurable limit on the number of concurrent executions. It also provides a retry mechanism for each callback in case of errors,
and callback hooks for queue state changes and callback events.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
  - [NPM](#npm)
  - [CDN](#cdn)
- [Usage](#usage)
  - [Example](#example)
  - [Basic Usage](#basic-usage)
  - [Configuration Options](#configuration-options)
  - [Multiple Callbacks](#multiple-callbacks)
  - [Retry Mechanism](#retry-mechanism)
  - [Queue State](#queue-state)
  - [Event Hooks](#event-hooks)
  - [Queue Control](#queue-control)
- [Use Cases](#use-cases)
- [License](#license)
- [Author](#author)
- [Contributing](#contributing)
  - [Commit Message Format](#commit-message-format)

## Features

- Concurrent Execution: Execute multiple callbacks concurrently with a configurable limit on the number of concurrent executions.
- Automatic Start: Option to automatically start the queue execution upon adding a callback.
- Retry Mechanism: Define the number of retry attempts for each callback in case of errors.
- State Management: Callbacks for different queue states (idle, busy, stopped) and events (success, error).
- Custom Callbacks: Customize behavior on callback success, error, and different queue states.

## Installation

### NPM

If you are using npm as your package manager, you can install the package by running:

```bash
npm install @diomeh/concurrent_callback_queue
```

Then you can import the `ConcurrentCallbackQueue` class in your project:

```javascript
import { ConcurrentCallbackQueue } from "@diomeh/concurrent_callback_queue";
const queue = new ConcurrentCallbackQueue();
```

### CDN

You can also include the script directly in your HTML file using the [jsDelivr](https://www.jsdelivr.com/) CDN:

As a module:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@diomeh/concurrent_callback_queue/dist/ConcurrentCallbackQueue.esm.js"
></script>
```

As a script:

```html
<script src="https://cdn.jsdelivr.net/npm/@diomeh/concurrent_callback_queue/dist/ConcurrentCallbackQueue.iife.min.js"></script>
```

This will expose the `ConcurrentCallbackQueue` class globally, and you can use it in your JavaScript code:

```javascript
const queue = new ConcurrentCallbackQueue();
```

## Usage

### Example

Detailed examples can be found in the [tutorial](tutorials/concurrent-callback-queue.md) page.

Here's an example of how to use the `ConcurrentCallbackQueue`:

```javascript
const queue = new ConcurrentCallbackQueue({
  autoStart: false,
  maxConcurrent: 2,
  onCallbackError: (error) => console.error(error),
});

for (let i = 0; i < 10; i++) {
  queue.enqueue(() => {
    const uri = "https://httpstat.us/200,400?sleep=2000";
    return fetch(uri).then((response) => response.text());
  }, 3);
}

queue.start();
```

### Basic Usage

To create and use a basic concurrent callback queue:

```javascript
const queue = new ConcurrentCallbackQueue();
queue.enqueue(() => fetch("https://httpstat.us/200,400?sleep=2000"));
```

### Configuration Options

Execution can be configured with the following options:

- `autoStart` (boolean): Whether to start the queue automatically when a callback is added.
- `maxConcurrent` (number): Maximum number of callbacks to execute concurrently.
- `onCallbackError` (function): Callback executed when an error occurs during callback execution.
- `onCallbackSuccess` (function): Callback executed after a callback is executed successfully.
- `onQueueIdle` (function): Callback executed when the queue becomes idle.
- `onQueueBusy` (function): Callback executed when the queue becomes busy.
- `onQueueStop` (function): Callback executed when the queue stops.

```javascript
const queue = new ConcurrentCallbackQueue({
  autoStart: false,
  onCallbackError: (error) => console.error(error),
});
queue.enqueue(() => {
  throw new Error("Error");
});
queue.start();
```

### Multiple Callbacks

To enqueue multiple callbacks at once:

```javascript
const queue = new ConcurrentCallbackQueue();
queue.enqueueAll([
  () => fetch("https://httpstat.us/200,400?sleep=2000"),
  () => fetch("https://httpstat.us/200,400?sleep=2000"),
]);
```

### Retry Mechanism

You can specify the number of retry attempts for each callback:

```javascript
const queue = new ConcurrentCallbackQueue();
const retries = 3;
queue.enqueue(() => fetch("https://httpstat.us/200,400?sleep=2000"), retries);
```

### Queue State

You can check the state of the queue at any time:

```javascript
const queue = new ConcurrentCallbackQueue();
console.log(queue.getState()); // QueueState.IDLE
```

Possible states are:

- `QueueState.IDLE`: There are no pending callbacks and the queue will start processing as soon as a callback is added.
- `QueueState.BUSY`: Currently processing callbacks up to the maximum concurrent limit.
- `QueueState.STOPPED`: Processing has been stopped and no further callbacks will be executed unless the queue is started again.

### Event Hooks

You can define custom event hooks to handle various queue state changes:

```javascript
const queue = new ConcurrentCallbackQueue({
  onQueueIdle: () => console.log("Queue is idle"),
  onQueueBusy: () => console.log("Queue is busy"),
  onQueueStop: () => console.log("Queue has stopped"),
});
```

There are also hooks for individual callback events:

```javascript
const queue = new ConcurrentCallbackQueue({
  onCallbackSuccess: (result) => console.log("Callback succeeded:", result),
  onCallbackError: (error) => console.error("Callback failed:", error),
});
queue.enqueueAll([
  () => fetch("https://httpstat.us/200,400?sleep=2000"),
  () => {
    throw new Error("Error");
  },
]);
```

### Queue Control

You can start, stop, and clear the queue as needed:

```javascript
const queue = new ConcurrentCallbackQueue({
  autoStart: false,
  maxConcurrent: 1,
});

queue.enqueueAll([
  () => fetch("https://httpstat.us/200,400?sleep=2000"),
  () => fetch("https://httpstat.us/200,400?sleep=2000"),
]);

queue.start(); // Will execute the first callback
queue.stop(); // Will stop the queue after the first callback
queue.clear(); // Will clear all callbacks that have not been executed yet and return them in an array
```

## Use Cases

The `ConcurrentCallbackQueue` can be used in various scenarios where you need to manage multiple asynchronous operations concurrently:

- API Calls: Execute multiple API requests in parallel.
- Heavy Computations: Run CPU-intensive tasks concurrently.
- File Processing: Process multiple files simultaneously.
- Task Scheduling: Schedule and manage multiple tasks.

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/Diomeh/concurrent_callback_queue/blob/master/LICENSE) file for details.

## Author

[David Urbina](https://github.com/Diomeh)

## Contributing

Contributions are welcome! Feel free to submit a pull request or open an issue if you have any suggestions or feedback.

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md)
and the [Conventional Commits Specification](https://www.conventionalcommits.org/en/v1.0.0/).

### Commit Message Format

From the Conventional Commits Specification [Summary](https://www.conventionalcommits.org/en/v1.0.0/#summary):

The commit message should be structured as follows:

```plaintext
{type}[optional scope]: {description}

[optional body]

[optional footer(s)]
```

Where `type` is one of the following:

| Type              | Description                                                                                             | Example Commit Message                            |
| ----------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `fix`             | Patches a bug in your codebase (correlates with PATCH in Semantic Versioning)                           | `fix: correct typo in README`                     |
| `feat`            | Introduces a new feature to the codebase (correlates with MINOR in Semantic Versioning)                 | `feat: add new user login functionality`          |
| `BREAKING CHANGE` | Introduces a breaking API change (correlates with MAJOR in Semantic Versioning)                         | `feat!: drop support for Node 8`                  |
| `build`           | Changes that affect the build system or external dependencies                                           | `build: update dependency version`                |
| `chore`           | Other changes that don't modify src or test files                                                       | `chore: update package.json scripts`              |
| `ci`              | Changes to CI configuration files and scripts                                                           | `ci: add CircleCI config`                         |
| `docs`            | Documentation only changes                                                                              | `docs: update API documentation`                  |
| `style`           | Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.) | `style: fix linting errors`                       |
| `refactor`        | Code change that neither fixes a bug nor adds a feature                                                 | `refactor: rename variable for clarity`           |
| `perf`            | Code change that improves performance                                                                   | `perf: reduce size of image files`                |
| `test`            | Adding missing tests or correcting existing tests                                                       | `test: add unit tests for new feature`            |
| Custom Types      | Any other type defined by the project for its specific needs                                            | `security: address vulnerability in dependencies` |

For more information, refer to the [Conventional Commits Specification](https://www.conventionalcommits.org/en/v1.0.0/).
