Deno.test('API Reference includes Sdk entry', async () => {
  const configText = await Deno.readTextFile(
    new URL('./config.ts', import.meta.url),
  );
  const expectedLine =
    "{ text: 'Sdk', link: '/reference/sdk' },";
  if (!configText.includes(expectedLine)) {
    throw new Error('Expected Sdk sidebar entry.');
  }
});
