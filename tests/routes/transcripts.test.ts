import { expect, test } from '../fixtures';

test.describe.serial('/api/transcripts', () => {
  test('Ada can parse the transcript list response body as JSON', async ({
    adaContext,
  }) => {
    const response = await adaContext.request.get('/api/transcripts');
    expect(response.status()).toBe(200);

    const payload = await response.json();

    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.pagination).toMatchObject({
      page: 1,
      limit: 20,
    });
  });

  test('Ada can parse transcript detail errors as JSON', async ({
    adaContext,
  }) => {
    const response = await adaContext.request.get('/api/transcripts/not-a-number');
    expect(response.status()).toBe(400);

    const payload = await response.json();

    expect(payload).toMatchObject({
      error: 'Invalid transcript ID',
    });
  });
});
