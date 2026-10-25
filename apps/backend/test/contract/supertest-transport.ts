import type { TestApp } from '../helpers/app';
import type { ContractTransport } from './web-scenario';

/**
 * Sends a contract request exactly like apps/frontend/src/lib/api.ts:
 * always `Content-Type: application/json`, Bearer token when present,
 * body JSON-stringified (or absent). Bodies are parsed from the raw text
 * so the e2e test and the fetch-based legacy smoke see identical values.
 */
export function supertestTransport(t: TestApp, prefix = '/api'): ContractTransport {
  return async ({ method, path, token, body }) => {
    const agent = t.http();
    const url = `${prefix}${path}`;
    let req =
      method === 'GET' ? agent.get(url)
      : method === 'POST' ? agent.post(url)
      : method === 'PATCH' ? agent.patch(url)
      : agent.delete(url);
    req = req.set('Content-Type', 'application/json');
    if (token) req = req.set('Authorization', `Bearer ${token}`);
    const res = body === undefined ? await req : await req.send(JSON.stringify(body));
    const text = res.text ?? '';
    let parsed: unknown = null;
    if (text.length > 0) {
      try { parsed = JSON.parse(text); } catch { parsed = text; }
    }
    return { status: res.status, body: parsed };
  };
}
