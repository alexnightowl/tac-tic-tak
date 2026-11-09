// Typed wrappers for the routes the Phase 2 slice uses. Paths and query
// encoding copy the web call sites (play/page.tsx, play/[id]/page.tsx,
// providers.tsx, login/register pages).
import type { TrainingStyle } from '../rules';
import type { ApiClient } from './client';
import type {
  AttemptBody,
  AttemptResponse,
  AuthResponse,
  CreateSessionBody,
  CreateSessionResponse,
  ExperienceResponse,
  FinishQuery,
  FinishResponse,
  LoginBody,
  MeResponse,
  NextResponse,
  RegisterBody,
  SessionDetail,
  CreateWoodpeckerSetBody,
  WoodpeckerSet,
  WoodpeckerSetSummary,
  HasteResponse,
  PlanToday,
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
      experience: () => client.get<ExperienceResponse>('/users/me/experience'),
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
    // Woodpecker sets (D40): results go through /library/sync with bookId = set id.
    woodpecker: {
      list: () => client.get<WoodpeckerSetSummary[]>('/woodpecker/sets'),
      get: (id: string) => client.get<WoodpeckerSet>(`/woodpecker/sets/${sid(id)}`),
      create: (body: CreateWoodpeckerSetBody) => client.post<WoodpeckerSet>('/woodpecker/sets', body, { timeoutMs: 30_000 }),
      archive: (id: string) => client.del<{ ok: true }>(`/woodpecker/sets/${sid(id)}`),
    },
    // Haste indicator (D40): hasty mistakes over the last `days`, the trend and 8 weeks.
    haste: (days = 30) => client.get<HasteResponse>('/analytics/haste', { query: { days } }),
    // Daily plan (D40): `since` = the player's local midnight (ISO).
    plan: {
      today: (style: TrainingStyle, since: string) => client.get<PlanToday>('/plan/today', { query: { style, since } }),
    },
  };
}

export type Endpoints = ReturnType<typeof createEndpoints>;
