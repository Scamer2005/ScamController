import { ProbeResult } from '../types/crafty';

export async function probeServer(
  rawUrl: string,
  timeoutMs: number,
  allowSelfSignedCert: boolean,
  signal?: AbortSignal
): Promise<ProbeResult> {
  if (!rawUrl.trim()) {
    return { reachable: false, reason: 'URL is blank' };
  }

  try {
    const response = await fetch('/api/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: rawUrl,
        timeoutMs,
        allowSelfSignedCert,
      }),
      signal,
    });

    if (!response.ok) {
      return { reachable: false, reason: `Probe HTTP ${response.status}` };
    }

    const data = (await response.json()) as ProbeResult;
    return data;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { reachable: false, reason: 'Probe cancelled' };
    }
    return {
      reachable: false,
      reason: err instanceof Error ? err.message : 'Network error',
    };
  }
}
