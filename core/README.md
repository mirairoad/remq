# Remq API Reference

## Creation

```ts
Remq.create(options)
Remq.getInstance()
```

## Registration

```ts
remq.on(event, handler, options?)
remq.on(jobDefinition)
```

## Emission

- `remq.emit(event, data?, options?)` — fire and forget
- `remq.emitAsync(event, data?, options?)` — awaitable

## Lifecycle

```ts
remq.start()
remq.stop()
remq.drain()
```

## WebSocket

- `options.expose` — port

## Options

| Option | Description |
|--------|-------------|
| `options.db` | Redis connection |
| `options.streamdb` | Dedicated stream connection |
| `options.redis` | Auto-create stream connection |
| `options.concurrency` | |
| `options.debug` | |
| `options.processor.jobStateTtlSeconds` | |
| `options.processor.maxLogsPerJob` | |
| `options.processor.pollIntervalMs` | |
| `options.processor.read.count` | |
| `options.processor.read.blockMs` | |

## Handler options

- `options.queue`
- `options.repeat.pattern`
- `options.attempts`
- `options.delay`
- `options.debounce`
- `options.priority`
