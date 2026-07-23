/**
 * Self-hosted vs. managed-SaaS is distinguished by `STRIPE_ENABLED`, per
 * `context/deployment.md`'s already-documented convention ("one build
 * artifact, STRIPE_ENABLED=false ... for self-host, the identical code path
 * otherwise") — not a new flag invented by this feature (research.md §1).
 */
export function isSelfHosted(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.STRIPE_ENABLED !== "true";
}
