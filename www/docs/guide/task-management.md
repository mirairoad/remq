---
title: Task Management
description: Define jobs, schedules, and retries with TaskManager.
---

# Task Management

Learn how to manage tasks in REMQ.

## Creating Tasks

Tasks in REMQ are simple messages that can be scheduled and processed:

```typescript
import { TaskManager } from '@leotermine/tasker';

const taskManager = new TaskManager({
  redis: {
    host: 'localhost',
    port: 6379,
  },
});

// Schedule a task for later execution
await taskManager.schedule('task-id', { data: 'example' }, Date.now() + 1000);
```

## Task Properties

Tasks can contain any serializable data:

```typescript
await taskManager.schedule('send-email', {
  to: 'user@example.com',
  subject: 'Welcome',
  body: 'Welcome to REMQ!',
}, Date.now() + 5000);
```

## Next Steps

- Learn about [Message Queues](/guide/message-queues)
- Understand [Consumers](/guide/consumers)
