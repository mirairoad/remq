import { remq } from './remq.plugin.ts';
import './crons/hello-world.ts';
import './crons/multi-jobs.ts';
import './scheduler/start.ts';
import './scheduler/onrequest.ts';

console.log('🚚 remq is running with core');

// Start processing jobs
await remq.start();

// remq.isQueuePaused('default').then((paused) => {
//   console.log('Queue is paused:', paused);
// });
// remq.pauseQueue('default');
// remq.isQueuePaused('default').then((paused) => {
//   console.log('Queue is paused:', paused);
// });
// remq.resumeQueue('default');
// remq.stop(); // this use only to shutdown the remq instance and stop the processing of jobs
// remq.onTaskFinished((job) => {
//   console.log('task finished:', job);
// });

// Emit a test job
remq.emit({
  event: 'on-request',
  data: {
    name: 'John Doe',
    email: 'john.doe@example.com',
  },
});
