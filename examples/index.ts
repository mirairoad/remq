import { management, remq } from './remq.plugin.ts';
import { requestJob } from './benchmarks/request.job.ts';
import { startWorldJob } from './_scheduled/start-world.ts';
import { midWorldJob } from './_scheduled/mid-world.ts';
import { endWorldJob } from './_scheduled/end-world.ts';
// import { userReadJob } from './_tasks/user.read.job.ts';
// import sqlite from 'node:sqlite'
remq.on(requestJob);
remq.on(startWorldJob);
remq.on(midWorldJob);
remq.on(endWorldJob);

// remq.on(userReadJob);

await remq.start();
