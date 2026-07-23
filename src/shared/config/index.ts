const PLACEHOLDER_MARKER = "REPLACE_ME";

/**
 * Reads the JWT signing secret and fails loudly (constitution Principle VI /
 * FR-009) rather than silently signing with a missing or still-placeholder
 * value. Mirrors `shared/db/client.ts`'s `getConnectionString` exactly.
 * `env` defaults to `process.env` and is only overridden in tests.
 */
export function getJwtSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  const value = env.JWT_SECRET;
  if (!value) {
    throw new Error(
      "JWT_SECRET is missing. Set it in your environment before starting the app (see .env.example).",
    );
  }
  if (value.includes(PLACEHOLDER_MARKER)) {
    throw new Error(
      "JWT_SECRET is still set to its documented placeholder value. Replace it with a real signing secret before starting the app.",
    );
  }
  return value;
}

/**
 * Session lifetime, hours. Defaults to 24 (matches the legacy system's
 * default) when unset — this env var has no placeholder-detection concern
 * of its own, unlike a secret.
 */
export function getJwtExpiryHours(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env.JWT_EXPIRY_HOURS;
  if (!raw) {
    return 24;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      "JWT_EXPIRY_HOURS must be a positive number when set. Got: " + raw,
    );
  }
  return parsed;
}
