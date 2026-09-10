import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, getQueryFn, queryClient } from '../src/queryClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('query client helpers', () => {
  it('sends JSON requests and returns successful responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"saved":true}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await apiRequest('POST', '/api/signals', { signalId: 'SIG-1' });

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledWith('/api/signals', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId: 'SIG-1' }),
      credentials: 'include',
    }));
  });

  it('reports failed responses and handles configured 401 behavior', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Missing', { status: 404, statusText: 'Not Found' })));
    await expect(apiRequest('GET', '/api/missing')).rejects.toThrow('404: Missing');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const nullableQuery = getQueryFn<{ id: string }>({ on401: 'returnNull' });
    await expect(nullableQuery({ queryKey: ['api', 'signals'] } as never)).resolves.toBeNull();

    const throwingQuery = getQueryFn<{ id: string }>({ on401: 'throw' });
    await expect(throwingQuery({ queryKey: ['api', 'signals'] } as never)).rejects.toThrow('401');
  });

  it('uses non-retrying, permanently fresh query defaults', () => {
    expect(queryClient.getDefaultOptions()).toMatchObject({
      queries: { staleTime: Infinity, retry: false, refetchInterval: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    });
  });
});