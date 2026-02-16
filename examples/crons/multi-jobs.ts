import { remq } from '../remq.plugin.ts';

remq.registerHandler({
  event: 'multi-jobs',
  handler: (task, ctx) => {
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
