export interface Organization {
  id: string;
  name: string;
  slug: string;
  planId: string | null;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The only shape any other bounded context ever receives (bcs/identity-access/CONTRACT.md). */
export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  planId: string | null;
}

/**
 * Thrown when self-hosted mode already has an organization and a second
 * creation is attempted (FR-006) — self-hosted installs get exactly one
 * `organizations` row, per PDR-003.
 */
export class SecondOrganizationNotAllowedError extends Error {
  constructor() {
    super(
      "This self-hosted install already has an organization — self-hosted installs support exactly one.",
    );
    this.name = "SecondOrganizationNotAllowedError";
  }
}
