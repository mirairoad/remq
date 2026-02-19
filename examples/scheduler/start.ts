import { remq } from '../remq.plugin.ts';

type DataStructure = {
  id: number;
  name: string;
  email: string;
};

remq.registerHandler({
  event: 'start',
  handler: async (task, ctx) => {
    console.log(
      '%c- runs every 30 seconds',
      'color: white; background-color: yellow;',
    );

    const users: DataStructure[] = [
      {
        id: 1,
        name: 'John Wick',
        email: 'john.wick@example.com',
      },
      {
        id: 2,
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
      },
      {
        id: 3,
        name: 'Jim Beam',
        email: 'jim.beam@example.com',
      },
    ];

    for (let i = 0; i < 3; i++) {
      ctx.emit({
        event: 'on-request',
        data: users[i],
        options: {
          id: `on-request-${i}`,
        },
      });
      await task.logger?.(`added task on-request-${i}`);
    }
  },
  options: {
    repeat: {
      pattern: '* * * * * ',
    },
    // debounce: 10,
    // attempts: 1,
  },
});
