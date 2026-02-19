import { remq } from '../remq.plugin.ts';

remq.registerHandler({
  handler: async (task, ctx) => {
    console.log(task.data);
    ctx.socket.update('started_upload', 0);
    console.log(
      '%c- runs on request',
      'color: white; background-color: green;',
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    ctx.socket.update('phase1', 33);

    await task.logger?.('testing the logger');
    ctx.socket.update('phase2', 66);
    // randomly throw an error
    if (Math.random() > 0.1) {
      throw new Error('random error');
    }
    ctx.socket.update('phase3', 100);
  },
  event: 'on-request',
});
