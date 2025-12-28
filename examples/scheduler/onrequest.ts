import { tempotask } from '../tempotask.plugin.ts';

tempotask.registerHandler({
  handler: async (job: any, ctx: any) => {
    console.log(
      '%c- runs on request',
      'color: white; background-color: green;',
    );
    console.log(job.data);
    await job.logger?.('testing the logger');
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
