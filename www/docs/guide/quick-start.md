# Quick Start

Get up and running with REMQ in minutes.

## Installation

First, install REMQ:

```bash
deno add npm:@leotermine/tasker
```

## Basic Example

Here's a simple example to get you started:

```typescript
import { TaskManager } from '@leotermine/tasker';

const taskManager = new TaskManager({
  redis: {
    host: 'localhost',
    port: 6379,
  },
});

// Schedule a task
await taskManager.schedule('my-task', { data: 'example' }, Date.now() + 1000);

console.log('Task scheduled!');
```

## What's Next?

- Learn about [Task Management](/guide/task-management)
- Explore [Message Queues](/guide/message-queues)
- Check out the [API Reference](/reference/task-manager)
