import { defineJob } from '../plugins/hound.plugin.ts';

interface OnRequestData {
  name: string;
  email: string;
}

export const userReadJob = defineJob<OnRequestData>(
  'user.read',
  async (ctx) => {
    console.log(ctx.id, ctx.data.email, ctx.foo);
  },
  { queue: 'tasks', concurrency: 1 },
);
