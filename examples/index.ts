import { hound } from './plugins/hound.plugin.ts';

if (Deno.args.includes('benchmark')) {
  await hound.benchmark({
    concurrency: 1,
    totalJobs: 100,
    simulatedWorkMs: 50,
  });

  Deno.exit(0);
}

await hound.start(); // auto-registers all *.job.ts from jobDirs

hound.emit('user.read', {
  email: 'leo@gmail.com',
  name: 'lucio',
}, { id: 'user.read-1' });
