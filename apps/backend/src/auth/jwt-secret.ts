/**
 * The JWT signing secret, required at boot (B2).
 *
 * Before B2 both AuthModule and JwtStrategy fell back to the literal
 * 'dev-secret' when JWT_SECRET was unset, so a process started without
 * the env (e.g. a bare `node dist/main.js`) silently signed forgeable
 * tokens. Now a missing or blank value refuses to start.
 *
 * The value is returned verbatim (no trim): tokens already issued in prod
 * were signed with the exact string compose passes in.
 */
export function requireJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error(
      'JWT_SECRET is not set: refusing to start. Set it in the environment ' +
        '(docker compose passes ${JWT_SECRET} from the root .env; locally put it in apps/backend/.env).',
    );
  }
  return secret;
}
