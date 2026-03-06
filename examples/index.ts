import { remq } from './remq.plugin.ts';
// import { requestJob } from './benchmarks/request.job.ts';
import { helloWorldJob } from './_scheduled/hello-world.ts';
import { byeWorldJob } from './_scheduled/multi-jobs.ts';
// import { userReadJob } from './_tasks/user.read.job.ts';

// remq.on(requestJob);
remq.on(helloWorldJob);
remq.on(byeWorldJob);

// remq.on(userReadJob);

await remq.start();

// remq.emit('user.read', {
//   name: 'John Doe',
//   email: 'john.doe@example.com',
// }, { queue: 'tasks' });
