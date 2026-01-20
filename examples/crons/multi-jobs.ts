import { tempotask } from '../tempotask.plugin.ts';

tempotask.registerHandler({
  event: 'multi-jobs',
  handler: (job: any, ctx: any) => {
    console.log(
      '%c- runs every minute',
      'color: white; background-color: blue;',
    );
    setTimeout(() => {
    }, 5000);
  },
  options: {
    repeat: {
      pattern: '* * * * *',
    },
  },
});

