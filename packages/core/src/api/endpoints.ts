// Typed wrappers for the routes the Phase 2 slice uses. Paths and query
// encoding copy the web call sites (play/page.tsx, play/[id]/page.tsx,
// providers.tsx, login/register pages).
import type { ApiClient } from './client';
import type {
  AttemptBody,
  AttemptResponse,
  AuthResponse,
  CreateSessionBody,
  CreateSessionResponse,
  FinishQuery,
  FinishResponse,
  LoginBody,
  MeResponse,
  NextResponse,
  RegisterBody,
  SessionDetail,
} from './types';

const sid = (id: string) => encodeURIComponent(id);

export function createEndpoints(client: ApiClient) {
  return {
    auth: {
      login: (body: LoginBody) => client.post<AuthResponse>('/auth/login', body),
      register: (body: RegisterBody) => client.post<AuthResponse>('/auth/register', body),
    },
    users: {
      me: () => client.get<MeResponse>('/users/me'),
    },
    sessions: {
      create: (body: CreateSessionBody) => client.post<CreateSessionResponse>('/sessions', body),
      next: (id: string) => client.post<NextResponse>(`/sessions/${sid(id)}/next`),
      attempt: (id: string, body: AttemptBody) =>
        client.post<AttemptResponse>(`/sessions/${sid(id)}/attempt`, body),
      /** Web: `save=false` only on discard, `localDate` always (server ignores it on discard). */
      finish: (id: string, q: FinishQuery) =>
        client.post<FinishResponse>(`/sessions/${sid(id)}/finish`, undefined, {
          query: { save: q.save === false ? 'false' : undefined, localDate: q.localDate },
        }),
      detail: (id: string) => client.get<SessionDetail>(`/sessions/${sid(id)}`),
    },
  };
}

export type Endpoints = ReturnType<typeof createEndpoints>;
