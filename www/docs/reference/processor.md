# Processor

The `Processor` class handles message processing logic.

## Constructor

```typescript
new Processor(options: ProcessorOptions)
```

## Methods

### process

Processes a message.

```typescript
process(message: Message): Promise<void>
```

**Parameters:**

- `message`: The message to process

**Example:**

```typescript
const processor = new Processor({
  handler: async (message) => {
    console.log('Processing:', message);
    // Your processing logic here
  },
});

await processor.process(message);
```

## Next Steps

- [Consumer API](/reference/consumer)
- [Guide](/guide/)
