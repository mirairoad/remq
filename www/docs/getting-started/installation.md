# Installation

## Prerequisites

- Deno 1.40 or higher
- Redis server running

## Install

```bash
deno add npm:@leotermine/tasker
```

Or import directly:

```typescript
import { TaskManager } from 'npm:@leotermine/tasker';
```

## Setup Redis

Make sure you have Redis running on your system:

```bash
# Using Docker
docker run -d -p 6379:6379 redis:latest

# Or install locally
# macOS
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis
```

## Next Steps

- [Getting Started Guide](../)
- [Examples](../../examples)
