export type EntitlementSnapshot = {
  coreFeaturesEnabled: boolean;
  maxTeams: number | null;
  maxApiKeys: number | null;
  maxProjects: number | null;
  maxPromptVersionHistory: number | null;
  ssoEnabled: boolean;
  auditRetentionDays: number;
  prioritySupport: boolean;
  seatLimit: number | null;
  customBranding: boolean;
};

export type EntitlementKey = keyof EntitlementSnapshot;

export const FREE_ENTITLEMENTS: Readonly<EntitlementSnapshot> = Object.freeze({
  coreFeaturesEnabled: true,
  maxTeams: null,
  maxApiKeys: 5,
  maxProjects: null,
  maxPromptVersionHistory: 20,
  ssoEnabled: false,
  auditRetentionDays: 7,
  prioritySupport: false,
  seatLimit: null,
  customBranding: false,
});
