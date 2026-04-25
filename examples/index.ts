import { hound } from './plugins/hound.plugin.ts';

await hound.start();

hound.emit('user.read', {
  email: 'leo@gmail.com',
  name: 'lucio',
}, { id: 'user.read-1' });
