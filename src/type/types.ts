// ─── Root Stack Param List ────────────────────────────────────────────────────
// Defines all screen names and their expected navigation params.
// Import this file into any screen that uses navigation or route props.

export type RootStackParamList = {
  // ── Main Screens ──
  FeedingConsumption: undefined;       // No params needed
  Process:            undefined;       // No params needed

  // ── Detail Screens ──
  BatchDetail: {
    batchNo: string;                   // Passed from FeedingConsumptionScreen
  };
};
