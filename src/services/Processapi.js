// ─── services/Processapi.js ───────────────────────────────────────────────────
//
// All REST calls for the Process (Feeding Consumption Process) screen.
// ─────────────────────────────────────────────────────────────────────────────

import { get, post, ordsItems } from './Apiclient';

// ── Normalisers ───────────────────────────────────────────────────────────────

// batch_list endpoint expected columns:
//   batch_id              → numeric id  (used as param for batch_detail)
//   batch_no              → display string
//   batch_status_display  → "WIP" | "Pending"
//   recipe_no             → recipe code
//   planned_start_date    → date string
//
const normaliseBatch = (row) => ({
  id:        String(row.batch_id                          ?? row.id       ?? ''),
  batchNo:   String(row.batch_no                          ?? row.batchno  ?? ''),
  status:    String(row.batch_status_display ?? row.status               ?? ''),
  recipe:    String(row.recipe_no            ?? row.recipe               ?? ''),
  startDate: String(row.planned_start_date   ?? row.start_date           ?? ''),
});

// batch_detail endpoint expected columns (Oracle ORDS view):
//   line_no           → ingredient line identifier
//   item_code         → item code string
//   plan_output_qty   → planned cases  (shown as "Planned Case" in UI)
//   plan_qty          → planned kg     (shown as "Planned Kg" in UI)
//   actual_qty        → actual cases   (shown as "Actual Case" in UI)
//   actual_kg         → actual kg      (shown as "Actual Kg" in UI)
//
// FIX (Bug 3): map to plannedCase / plannedKg / actualCase / actualKg so
// ProcessScreen and BatchDetailScreen can read item.plannedCase etc. directly.
//
const normaliseIngredient = (row) => ({
  id:          String(row.line_no      ?? row.line_id   ?? ''),
  item:        String(row.item_code                     ?? ''),
  plannedCase: Number(row.plan_output_qty               ?? 0),   // ← was planOutputQty
  plannedKg:   Number(row.plan_qty                      ?? 0),   // ← was planQty
  actualCase:  Number(row.actual_qty                    ?? 0),   // ← was actualQty
  actualKg:    Number(row.actual_kg    ?? row.actualkg  ?? 0),
});

// ── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * Fetch all batches for the LOV (WIP + Pending).
 *
 * GET /batch_list
 * Returns: normalised Batch[]
 */
export const fetchAllBatches = async () => {
  const json = await get('/batch_list');
  return ordsItems(json).map(normaliseBatch);
};

/**
 * Fetch ingredient lines for a given batch.
 *
 * GET /batch_detail?batch_id=<id>
 *
 * FIX (Bug 1 & 2): always pass batch.id (the numeric batch_id, e.g. 2),
 * NOT batch.batchNo (the display string, e.g. "3628").
 *
 * Callers:
 *   ProcessScreen    → loadIngredients(selectedBatch.id)     ✅
 *   BatchDetailScreen → fetchIngredients(batch.id)           ✅
 *
 * Returns: normalised Ingredient[]
 */
export const fetchIngredients = async (batch_id) => {
  const json = await get(`/batch_detail?batch_id=${batch_id}`);
  return ordsItems(json).map(normaliseIngredient);
};

/**
 * Submit a WIP batch.
 *
 * POST /batch_submit
 * Body:    { batch_no }
 * Returns: { returncode, message }
 */
export const submitBatch = (batchNo) =>
  post('/batch_submit', { batch_no: batchNo });