# Consumer

The `Consumer` class receives and processes messages from queues.

## Constructor

```typescript
new Consumer(options: ConsumerOptions)
```

## Events

### message

Emitted when a message is received from the queue.

```typescript
consumer.on('message', (message: Message) => {
  // Handle message
});
```

### error

Emitted when an error occurs.

```typescript
consumer.on('error', (error: Error) => {
  // Handle error
});
```

## Methods

### start

Starts consuming messages from the queue.

```typescript
start(): Promise<void>
```

### stop

Stops consuming messages.

```typescript
stop(): Promise<void>
```

## Example

```typescript
const consumer = new Consumer({/* options */});

consumer.on('message', async (message) => {
  await processMessage(message);
});

await consumer.start();
```

## Next Steps

- [Processor API](/reference/processor)
- [TaskManager API](/reference/task-manager)
