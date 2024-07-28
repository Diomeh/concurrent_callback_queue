This tutorial will guide you through some more advanced usage cases, closer to real-world scenarios.

It is assumed that you have already installed the package.

## Table of Contents

1. [Controlling queue state](#controlling-queue-state)
2. [Processing large files](#processing-large-files)
3. [Making API calls](#making-api-calls)

## Controlling queue state

The `ConcurrentCallbackQueue` allows you to control the state of the queue, such as pausing and resuming the execution of callbacks
at any point in time.

Assume we have a process for uploading large files to a server, and we want to pause the upload process if the user navigates away from the page,
focus on the `uploadFileInChunks` function body.

```javascript
import { ConcurrentCallbackQueue } from "@diomeh/concurrent_callback_queue";

// Create a queue to upload the chunks concurrently
// By default 10 parallel operations are allowed, so we'll upload up to 10 chunks at a time
// We'll set the `autoStart` option to `false` to manually control the queue
const queue = new ConcurrentCallbackQueue({ autoStart: false });

// This function would upload the file to the server
// We'll assume it's an asynchronous operation that handles file chunking
async function uploadFileInChunks(file) {
  // Some logic...

  // Eventually it'll call queue.enqueue() for each chunk to be uploaded
  for (;;) /* ... */ {
    // Process chunk logic...
    queue.enqueue(() => {
      /* here we'd post the file chunk to a server */
    });
  }
}

// Imitate the file upload process
// This is a self calling function
(async function uploadFile() {
  // We'll ignore the actual logic as it's not relevant to the example
  // Here, we'd define the logic for reading the file and calling `uploadFileInChunks`
  const file = new File();
  await uploadFileInChunks(file);
})();

// Somwhere in our DOM, we'll have two buttons to start/pause/resume/abort upload

// When the user clicks the start button we'll start the queue, which will start uploading the file
document.getElementById("startButton").addEventListener("click", () => {
  queue.start();
});

// When the user clicks the pause button we'll stop the queue, which will pause the upload process
document.getElementById("pauseButton").addEventListener("click", () => {
  queue.stop();
});

// When the user clicks the resume button we'll start the queue again, which will resume the upload process
document.getElementById("resumeButton").addEventListener("click", () => {
  queue.start();
});

// When the user clicks the abort button we'll clear the queue, which will stop the upload process and clear all pending tasks
// Notice that tasks already in progress will not be stopped
document.getElementById("abortButton").addEventListener("click", () => {
  queue.clear();
});
```

In this example, we create a `ConcurrentCallbackQueue` instance with the `autoStart` option set to `false`,
meaning that we need to manually start the queue using the `start` method.

We then define a function `uploadFileInChunks` that simulates the process of uploading a file in chunks to a server.
This function enqueues a callback for each chunk to be uploaded.

The `uploadFile` function reads the file and calls `uploadFileInChunks` to schedule file chunks for upload.
We then add event listeners to the start, pause, resume, and abort buttons to control the queue state.

When the user clicks the start button, the queue starts processing the callbacks, which initiates the file upload process.
Clicking the pause button stops the queue, pausing the upload process.
Clicking the resume button starts the queue again, resuming the upload process.
Clicking the abort button clears the queue, stopping the upload process and removing all pending tasks.

**A note on clearing the queue**: Tasks that are already in progress will not be stopped when the queue is cleared.

## Processing large files

When processing large files, it is often necessary to split the work into smaller chunks to avoid memory issues and improve performance,
treating files as a streams of data. We can make use of the `ConcurrentCallbackQueue` to process the file in chunks concurrently.

This would be done on a `node.js` environment.

```javascript
import fs from "fs";
import { ConcurrentCallbackQueue } from "@diomeh/concurrent_callback_queue";

// Create a stream to read the file
const filename = "some-file.txt";
const readableStream = fs.createReadStream(filename, { encoding: "utf8" });

// Create a queue to process the chunks concurrently
// We'll proccess up to 4 chunks at a time
const queue = new ConcurrentCallbackQueue({ maxConcurrent: 4 });

// Read the file in chunks and add them to the queue
// As the `autoStart` option is set to `true` by default
// as soon as we add the first chunk to the queue, it will start processing
readableStream.on("data", (chunk) => {
  queue.enqueue(() => processChunk(chunk));
});

// The specifics on how to process a chunk are left to the user
const processChunk = (chunk) => {
  // Do something with the chunk
};
```

## Making API calls

Assume we are uploading a large file to the server from client-side JavaScript,
and we want to upload the file in chunks to avoid memory issues and improve performance.

We'd make use of the `ConcurrentCallbackQueue` to upload the chunks concurrently,
letting the server handle the merging of the chunks.

_We assume the client properly supports the `File` API._

```javascript
import { ConcurrentCallbackQueue } from "@diomeh/concurrent_callback_queue";

// Assume we're reading 1MB chunks of the `some-file.txt` file
const filename = "some-file.txt";
const chunkSize = 1024 * 1024; // 1MB

// Create a queue to upload the chunks concurrently
// We'll upload up to 5 chunks, so 5MB at a time
const queue = new ConcurrentCallbackQueue({ maxConcurrent: 5 });

// Function to simulate file reading (replace this with actual file input handling)
async function readFile(filename) {
  // For demonstration purposes, let's create a mock File object
  // In a real scenario, this would be a file selected by the user
  const response = await fetch(filename);
  const blob = await response.blob();
  return new File([blob], filename);
}

// Function to upload a file in chunks
function uploadFileInChunks(file) {
  const totalChunks = Math.ceil(file.size / chunkSize);

  // Read the file in chunks and add them to the queue
  for (let chunkNumber = 0; chunkNumber < totalChunks; chunkNumber++) {
    // Get the start and end positions for the current chunk
    const start = chunkNumber * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    // Create a FormData object to send the chunk data
    const formData = new FormData();
    formData.append("chunk", chunk);
    formData.append("chunkNumber", chunkNumber);
    formData.append("totalChunks", totalChunks);

    // Add the upload task to the queue
    queue.enqueue(() => uploadChunk(formData));
  }
}

// Function to upload a single chunk
async function uploadChunk(formData) {
  try {
    const response = await fetch("https://your-api-endpoint/upload", {
      method: "POST",
      body: formData,
    });

    // If upload fails, throw an error
    // Error handling can be customized as needed using the `onCallbackError` hook
    if (!response.ok) {
      throw new Error(`Failed to upload chunk: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error uploading chunk:", error);
    throw error;
    // Or any other error handling logic
  }
}

// Imitate the file upload process
// This is a self calling function
(async function uploadFile(file) {
  try {
    // Read the file
    const file = await readFile(filename);

    // Make a bunch of API calls to upload the file in chunks
    await uploadFileInChunks(file);
  } catch (error) {
    console.error("Error:", error);
  }
})();
```

In this example, we create a `ConcurrentCallbackQueue` instance with a `maxConcurrent` option set to `5`,
meaning that we can upload up to 5 chunks concurrently.

We then read the file in chunks and add each chunk to the queue using the `enqueue` method.
The `uploadChunk` function is responsible for uploading a single chunk to the server.
If the upload fails, an error is thrown, which can be caught and handled using the `onCallbackError` hook.

The `uploadFile` function reads the file and uploads it in chunks using the `uploadFileInChunks` function.
