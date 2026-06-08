// ─── services/feedingConsumptionApi.js ───────────────────────────────────────
//
// All REST calls for the Feeding Consumption feature live here.
// Add new endpoints for this screen below without touching any other file.
// ─────────────────────────────────────────────────────────────────────────────

import { get, ordsItems } from './Apiclient';

// ── Field normaliser ─────────────────────────────────────────────────────────
// Maps Oracle ORDS snake_case column names → the shape the app expects.
// If your view uses different column names, adjust the fallback keys here.
//
// Expected ORDS response per row:
//   batch_id    → unique row identifier
//   batch_no    → batch number shown in the list
//   status      → "WIP" | "Done" | "Pending"
//   recipe      → recipe code string
//   start_date  → planned start date string
//
const normaliseBatch = (row) => ({
  id:        String(row.batch_id   ?? row.id          ?? row.batch_no),
  batchNo:   String(row.batch_no   ?? row.batchno     ?? ''),
  status:    String(row.status     ?? row.batch_status_display ?? ''),
  recipe:    String(row.recipe     ?? row.recipe_no  ?? ''),
  startDate: String(row.start_date ?? row.actual_start_date    ?? ''),
});

// ── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * Fetch the batch list for the Feeding Consumption screen.
 *
 * GET /batch_list
 * Returns: normalised Batch[]
 */
export const fetchBatchList = async () => {
  const json = await get('/batch_list');
  return ordsItems(json).map(normaliseBatch);
};

// ─────────────────────────────────────────────────────────────────────────────
// Add more Feeding Consumption endpoints below as needed, e.g.:
//
// export const fetchBatchDetail = async (batchNo) => {
//   const json = await get(`/batch_detail?batch_no=${batchNo}`);
//   return ordsItems(json).map(normaliseDetail);
// };