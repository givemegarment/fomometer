export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const e = new Error(`Request failed: ${res.status}`) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }
  return (await res.json()) as T;
}
