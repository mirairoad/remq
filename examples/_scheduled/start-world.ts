import { defineJob } from '@core/mod.ts';

export const startWorldJob = defineJob(
  'start-world',
  async (ctx) => {
    console.log(
      '%c- runs every 1 minute',
      'color: white; background-color: red;',
    );
  },
  {
    repeat: {
      pattern: '* * * * *', // every 1 minute
    },
    queue: 'scheduled',
    // attempts: 3,
  },
);
