import { defineJob } from '@hushkey/remq';

export const helloWorldJob = defineJob(
  'hello-world',
  async (ctx) => {
    console.log(
      '%c- runs every 1 minutes',
      'color: white; background-color: red;',
    );
  },
  {
    repeat: {
      pattern: '* * * * *',
    },
    queue: 'scheduled',
    // attempts: 3,
  },
);
