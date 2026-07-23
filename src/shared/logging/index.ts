import pino from "pino";

/** `env` defaults to `process.env` and is only overridden in tests, matching `shared/config`'s getter pattern. */
export function createLogger(env: Record<string, string | undefined> = process.env) {
  return pino({ level: env.LOG_LEVEL ?? "info" });
}

export const logger = createLogger();
