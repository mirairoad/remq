# TaskManager

The `TaskManager` class is used to manage tasks and scheduling in REMQ.

## Constructor

```typescript
new TaskManager(options: TaskManagerOptions)
```

## Methods

### schedule

Schedules a task for execution at a specific time.

```typescript
schedule(taskId: string, data: any, timestamp: number): Promise<void>
```

**Parameters:**

- `taskId`: Unique identifier for the task
- `data`: Task data (any serializable object)
- `timestamp`: Unix timestamp in milliseconds when the task should execute

**Example:**

```typescript
await taskManager.schedule(
  'send-email',
  { to: 'user@example.com' },
  Date.now() + 5000,
);
```

## Next Steps

- [Consumer API](/reference/consumer)
- [Processor API](/reference/processor)
