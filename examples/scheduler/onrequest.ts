import { remq } from '../remq.plugin.ts';

remq.registerHandler({
  handler: async (task, ctx) => {
    ctx.update('started_upload', 0);
    console.log(
      '%c- runs on request',
      'color: white; background-color: green;',
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));
    ctx.update('phase1', 33);

    await task.logger?.('testing the logger');
    ctx.update('phase2', 66);
    // randomly throw an error
    if (Math.random() > 0.5) {
      throw new Error('random error');
    }
    ctx.update('phase3', 100);
  },
  event: 'on-request',
  options: {
    attempts: 3,
  },
});
