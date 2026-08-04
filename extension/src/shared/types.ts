/**
 * Extension-specific types (beyond what @fve/core provides).
 */

/** Options stored in chrome.storage.local. */
export interface ScoutOptions {
  faceitApiKey: string;
  leetifyApiKey: string;
  enableOverlay: boolean;
  enableAimRating: boolean;
  showSteamName: boolean;
  showFaceitLevel: boolean;
  showMembership: boolean;
  showTechnicalIds: boolean;
}
