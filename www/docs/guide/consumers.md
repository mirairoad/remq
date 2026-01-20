# Consumers

Learn how to process messages with consumers in REMQ.

## What are Consumers?

Consumers are components that receive and process messages from queues. They handle the actual work of your application.

## Basic Consumer

```typescript
import { Consumer } from '@leotermine/tasker';

const consumer = new Consumer({
  redis: {
    host: 'localhost',
    port: 6379,
  },
});

consumer.on('message', async (message) => {
  console.log('Received:', message);
  // Process the message
  await processMessage(message);
});
```

## Error Handling

Always handle errors in your consumers:

```typescript
consumer.on('error', (error) => {
  console.error('Consumer error:', error);
});

consumer.on('message', async (message) => {
  try {
    await processMessage(message);
  } catch (error) {
    console.error('Processing error:', error);
  }
});
```

## Next Steps

- Check the [Consumer API Reference](/reference/consumer)
- Learn about [Processors](/reference/processor)
