import { remq } from '../remq.plugin.ts';

remq.registerHandler({
  handler: async (task, ctx) => {
    console.log(
      '%c- runs on request',
      'color: white; background-color: green;',
    );
    console.log(task.data);
    await task.logger?.('testing the logger');
    // randomly throw an error
    if (Math.random() > 0.5) {
      throw new Error('random error');
    }
  },
  event: 'on-request',
  options: {
    attempts: 3,
  },
});
