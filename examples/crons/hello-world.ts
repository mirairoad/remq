import { remq } from '../remq.plugin.ts';

remq.registerHandler({
  handler: (job: any, ctx: any) => {
    console.log(
      '%c- runs every 1 minutes',
      'color: white; background-color: red;',
    );
    setTimeout(() => {
    }, 5000);
  },
  event: 'hello-world',
  options: {
    repeat: {
      pattern: '* * * * *',
    },
    // attempts: 3,
  },
});
