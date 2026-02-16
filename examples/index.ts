import { remq } from './remq.plugin.ts';
import './crons/hello-world.ts';
import './crons/multi-jobs.ts';
import './scheduler/start.ts';
import './scheduler/onrequest.ts';

console.log('🚚 remq is running with core');

// Start processing jobs
await remq.start();

// Emit a test job
remq.emit({
  event: 'on-request',
  data: {
    name: 'John Doe',
    email: 'john.doe@example.com',
  },
  options: {
    id: 'onrequest',
  },
});
