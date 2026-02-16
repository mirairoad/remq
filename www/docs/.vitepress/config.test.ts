Deno.test('API Reference includes Admin / AdminStore entry', async () => {
  const configText = await Deno.readTextFile(
    new URL('./config.ts', import.meta.url),
  );
  const expectedLine =
    "{ text: 'Admin / AdminStore', link: '/reference/admin-store' },";
  if (!configText.includes(expectedLine)) {
    throw new Error('Expected Admin / AdminStore sidebar entry.');
  }
});
