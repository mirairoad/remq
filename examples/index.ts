import { tempotask } from './tempotask.plugin.ts';
import './crons/hello-world.ts';
import './crons/multi-jobs.ts';
import './scheduler/start.ts';
import './scheduler/onrequest.ts';


console.log('🚚 tempotask is running with core');

// Start processing jobs
await tempotask.start();

// Emit a test job
tempotask.emit({
  event: 'on-request',
  data: {
    name: 'John Doe',
    email: 'john.doe@example.com',
  },
  options: {
    id: 'onrequest',
  },
});