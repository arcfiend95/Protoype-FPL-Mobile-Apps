// ─── services/index.js ───────────────────────────────────────────────────────
//
// Barrel file — import everything from ONE place in your screens:
//
//   import { fetchBatchList }  from '../../services';
//   import { validateLot }     from '../../services';
//
// When you add a new screen API file (e.g. batchDetailApi.js), just add its
// export line here and it becomes available everywhere instantly.
// ─────────────────────────────────────────────────────────────────────────────
export { loginWithApex }                                       from './Loginapi';
export { fetchBatchList }                                             from './Feedingconsumptionapi';
export { fetchAllBatches, fetchIngredients, submitBatch }             from './Processapi';
export {
  validateLot,
  createHeader,
  fetchScanHistory,
  // legacy
  fetchScannedData,
  scanBarcode,
  transactIngredient,
}                                                                     from './Scannerapi';

// ── How to add a new screen ───────────────────────────────────────────────────
// 1. Create  src/services/myNewScreenApi.js
// 2. Write your fetch functions + normaliser in that file
// 3. Add one export line here:
//      export { myFunction } from './myNewScreenApi';
// 4. Import in your screen:
//      import { myFunction } from '../../services';
// That's it — no other file needs to change.