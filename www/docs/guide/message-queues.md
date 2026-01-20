# Message Queues

Understanding how message queues work in REMQ.

## What are Message Queues?

Message queues in REMQ allow you to decouple the sending and receiving of messages, enabling asynchronous processing and better scalability.

## Queue Concepts

- **Producer**: Creates and sends messages to the queue
- **Consumer**: Receives and processes messages from the queue
- **Queue**: A buffer that stores messages until they're processed

## Example

```typescript
// Producer
await taskManager.schedule('process-order', { orderId: 123 }, Date.now());

// Consumer (running separately)
const consumer = new Consumer(/* config */);
consumer.on('message', (message) => {
  console.log('Processing:', message);
});
```

## Next Steps

- Learn about [Consumers](/guide/consumers)
- Check the [API Reference](/reference/task-manager)
