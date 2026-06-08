// ─── services/Scannerapi.js ───────────────────────────────────────────────────
//
// All REST calls for the Scanner screen.
// ─────────────────────────────────────────────────────────────────────────────

import { BASE_URL, post, ordsItems } from './Apiclient';

// ── Fixed constant ────────────────────────────────────────────────────────────
const ORG_ID = 91;

// ── Shared fetch headers ──────────────────────────────────────────────────────
const HEADERS = { 'Content-Type': 'application/json' };

// ── Normalisers ───────────────────────────────────────────────────────────────

// Columns returned by the validate_lot SQL (exact names from the query):
//   LOT_NUMBER          → lot identifier
//   ITEM_CODE           → SEGMENT1 alias — compare against item.item
//   ITEM_DESCRIPTION    → human-readable item name
//   UOM                 → PRIMARY_UOM_CODE
//   ORG_CODE            → ORGANIZATION_CODE
//   LOT_STATUS          → raw lot status string
//   EXPIRATION_DATE     → formatted 'YYYY-MM-DD'
//   IS_EXPIRED          → 'Y' | 'N'
//   SIO_FROM_CODE       → subinventory code
//   ONHAND_QTY          → on-hand quantity
//   VALIDATION_STATUS   → 'VALID' | 'INVALID: ...' | 'WARNING: ...'
//
const normaliseLot = (row) => ({
  lotNumber:        String(row.LOT_NUMBER       ?? row.lot_number       ?? ''),
  itemCode:         String(row.ITEM_CODE        ?? row.item_code        ?? ''),
  itemDescription:  String(row.ITEM_DESCRIPTION ?? row.item_description ?? ''),
  uom:              String(row.UOM              ?? row.uom              ?? ''),
  orgCode:          String(row.ORG_CODE         ?? row.org_code         ?? ''),
  lotStatus:        String(row.LOT_STATUS       ?? row.lot_status       ?? ''),
  expirationDate:   String(row.EXPIRATION_DATE  ?? row.expiration_date  ?? ''),
  isExpired:        String(row.IS_EXPIRED       ?? row.is_expired       ?? 'N'),
  subinventory:     String(row.SIO_FROM_CODE    ?? row.sio_from_code    ?? ''),
  onhandQty:        Number(row.ONHAND_QTY       ?? row.onhand_qty       ?? 0),
  validationStatus: String(row.VALIDATION_STATUS ?? row.validation_status ?? ''),
  _raw: row,
});

const normaliseHistory = (row) => ({
  id:        String(row.transaction_id ?? row.id         ?? row.lot_number ?? ''),
  lotNumber: String(row.lot_number     ?? row.LOT_NUMBER ?? ''),
  itemCode:  String(row.item_code      ?? row.ITEM_CODE  ?? ''),
  nettoKg:   Number(row.netto_kg       ?? row.netto      ?? 0),
  scannedAt: String(row.scanned_at     ?? row.created_at ?? ''),
  batchNo:   String(row.batch_no       ?? ''),
  lineId:    String(row.line_id        ?? ''),
});

// ── extractSingleRow ──────────────────────────────────────────────────────────
// Handles both ORDS response shapes:
//   { "items": [{...}] }    ← standard collection GET handler
//   { "LOT_NUMBER": "..." } ← flat implicit GET handler
//
const extractSingleRow = (json) => {
  if (!json || typeof json !== 'object') return null;
  if (Array.isArray(json.items)) {
    return json.items.length > 0 ? json.items[0] : null;
  }
  const knownCols = ['LOT_NUMBER', 'ITEM_CODE', 'lot_number', 'item_code', 'VALIDATION_STATUS'];
  if (knownCols.some((c) => c in json)) return json;
  return null;
};

// ── validateLot ───────────────────────────────────────────────────────────────
//
// GET /validate_lot?lot_no=<lotNumber>&org_id=91
//
// Bind variables in the ORDS SQL: :lot_no  and  :org_id
//
export const validateLot = async (lotNumber) => {
  const url = `${BASE_URL}/validate_lot?lot_no=${lotNumber}&org_id=${ORG_ID}`;
  console.log('[validateLot] -> GET', url);

  let res;
  try {
    res = await fetch(url, { method: 'GET', headers: HEADERS });
  } catch (networkErr) {
    throw new Error('Network error: ' + networkErr.message);
  }

  console.log('[validateLot] <- HTTP', res.status, res.statusText);
  const rawText = await res.text();
  console.log('[validateLot] raw body:', rawText);

  if (!res.ok) {
    throw new Error('HTTP ' + res.status + ' -- ' + rawText.slice(0, 300));
  }

  let json;
  try {
    json = JSON.parse(rawText);
  } catch (_) {
    throw new Error('ORDS returned non-JSON: ' + rawText.slice(0, 200));
  }

  const row = extractSingleRow(json);
  console.log('[validateLot] extracted row:', JSON.stringify(row));

  if (!row) return null;

  const lot = normaliseLot(row);

  if (lot.validationStatus.startsWith('INVALID')) {
    const err = new Error(lot.validationStatus);
    err.isLotInvalid = true;
    err.lot = lot;
    throw err;
  }

  return lot;
};

// ── createHeader ──────────────────────────────────────────────────────────────
//
// POST /create_header
//
// Single endpoint that handles EVERY lot scan — first or subsequent.
// The PL/SQL decides internally:
//
//   Case A — header does NOT yet exist for this batch (v_exists = 0):
//     1. Fetches batch info from SIM_GME_BATCH_HEADER
//     2. INSERTs a new row into APX_FPL_FEEDING_COMPOSITION_ARCHIVE_HEADER
//     3. Copies ingredient lines from SIM_GME_MATERIAL_DETAILS, storing lot_no
//        on each line in the LOT_NO column
//     4. Returns HTTP 201  { status:'created', header_id, batch_no, line_count }
//
//   Case B — header already exists (v_exists > 0):
//     1. Checks if lot_no is already stored in ARCHIVE_LINE for this batch
//        → duplicate: returns HTTP 200  { status:'existing', lot_no, batch_no }
//        → new lot:   fetches header_id, copies ingredient lines with lot_no,
//                     returns HTTP 201  { status:'created', header_id, lot_no, line_count }
//
// Body fields (must match PL/SQL v_json.get_* calls exactly):
//   batch_id   NUMBER   — v_json.get_number('batch_id') — numeric id e.g. 2
//   batch_no   VARCHAR2 — v_json.get_string('batch_no') — display string e.g. "FPL-BATCH-2026-002"
//   org_id     NUMBER   — v_json.get_number('org_id')   — fixed 91
//   lot_no     VARCHAR2 — v_json.get_string('lot_no')   — scanned LOT number
//   created_by VARCHAR2 — v_json.get_string('created_by') — defaults to 'MOBILE_APP' via NVL
//
// Possible response shapes:
//   { status:'created',  header_id, batch_no, line_count }  — first LOT, header just created
//   { status:'created',  header_id, lot_no,   line_count }  — subsequent LOT, lines added
//   { status:'existing', lot_no,    batch_no }              — duplicate LOT, nothing inserted
//   { status:'error',    message }                          — batch not found or DB error
//
export const createHeader = (payload) => {
  const body = {
    batch_id:   Number(payload.batchId),           // → v_json.get_number('batch_id')
    batch_no:   String(payload.batchNo),           // → v_json.get_string('batch_no')
    org_id:     ORG_ID,                            // → v_json.get_number('org_id')  fixed 91
    lot_no:     String(payload.lotNo ?? ''),       // → v_json.get_string('lot_no')
    created_by: payload.createdBy ?? 'MOBILE_APP', // → NVL(v_json.get_string('created_by'), 'MOBILE_APP')
  };
  console.log('[createHeader] -> POST /create_header', JSON.stringify(body));
  return post('/create_header', body);
};

// ── fetchScanHistory ──────────────────────────────────────────────────────────
// GET /scan_list?batch_no=<batchNo>&line_id=<lineId>
// Returns committed scan records for the History tab.
//
export const fetchScanHistory = async (batchNo, lineId) => {
  const url = `${BASE_URL}/scan_list?batch_no=${encodeURIComponent(batchNo)}&line_id=${encodeURIComponent(lineId)}`;
  console.log('[fetchScanHistory] -> GET', url);

  let res;
  try {
    res = await fetch(url, { method: 'GET', headers: HEADERS });
  } catch (networkErr) {
    throw new Error('Network error: ' + networkErr.message);
  }

  console.log('[fetchScanHistory] <- HTTP', res.status, res.statusText);
  const rawText = await res.text();
  console.log('[fetchScanHistory] raw body:', rawText);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} — ${rawText.slice(0, 200)}`);
  }

  let json;
  try {
    json = JSON.parse(rawText);
  } catch {
    console.warn('[fetchScanHistory] non-JSON response, returning []');
    return [];
  }

  const rows = ordsItems(json);
  console.log('[fetchScanHistory]', rows.length, 'records found');
  return rows.map(normaliseHistory);
};

// ── Legacy exports ────────────────────────────────────────────────────────────
export const fetchScannedData   = fetchScanHistory;
export const scanBarcode        = (batchNo, lineId, barcode) =>
  post('/scan_input', { batch_no: batchNo, line_id: lineId, barcode });
export const transactIngredient = (batchNo, lineId, scans) =>
  post('/scan_transact', { batch_no: batchNo, line_id: lineId, scans });