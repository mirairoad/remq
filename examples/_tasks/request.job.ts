import { defineJob } from '@core/mod.ts';

interface OnRequestData {
  name: string;
  email: string;
}

export const userReadJob = defineJob<Record<string, unknown>, OnRequestData>(
  'user.read',
  async (ctx) => {
    console.log(ctx.data);
  },
  { queue: 'tasks' },
);
