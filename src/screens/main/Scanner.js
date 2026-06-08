import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, Alert, Vibration, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { validateLot, createHeader, fetchScanHistory } from '../../services';

const TAB_SCAN    = 'scan';
const TAB_HISTORY = 'history';

// ─────────────────────────────────────────────────────────────────────────────
const ScannerScreen = ({ route, navigation }) => {
  const { item, batch } = route.params;

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned]           = useState(false);
  const [scanning, setScanning]         = useState(false);
  const [torch, setTorch]               = useState(false);
  const lastScanned                     = useRef(null);

  const [validating, setValidating]     = useState(false);
  const [scannedData, setScannedData]   = useState([]);

  const [activeTab, setActiveTab]           = useState(TAB_SCAN);
  const [history, setHistory]               = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError]     = useState(null);

  const [submitting, setSubmitting] = useState(false);

  // ── Derived totals ────────────────────────────────────────────────────────
  const totalScanned = scannedData.length;
  const nettoPerCase = item.plannedCase > 0 ? item.plannedKg / item.plannedCase : 0;
  const totalNetto   = totalScanned * nettoPerCase;
  const totalPending = Math.max(item.plannedCase - totalScanned, 0);

  const resumeScan = () => {
    lastScanned.current = null;
    setScanned(false);
    setScanning(true);
  };

  const stopScan = () => {
    lastScanned.current = null;
    setScanned(false);
    setScanning(false);
  };

  // ── Camera permission ─────────────────────────────────────────────────────
  useEffect(() => {
    if (permission && !permission.granted) requestPermission();
  }, []);

  // ── History tab load ──────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const data = await fetchScanHistory(batch.batchNo, item.id);
      setHistory(data);
    } catch (err) {
      setHistoryError(err.message || 'Failed to load history.');
    } finally {
      setHistoryLoading(false);
    }
  }, [batch.batchNo, item.id]);

  useEffect(() => {
    if (activeTab === TAB_HISTORY) loadHistory();
  }, [activeTab, loadHistory]);

  // ─────────────────────────────────────────────────────────────────────────
  // Barcode scan handler
  // Flow: scan → validateLot (lot_no / org_id) → compare ITEM_CODE → createHeader POST
  // ─────────────────────────────────────────────────────────────────────────
  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || data === lastScanned.current || validating) return;

    lastScanned.current = data;
    setScanned(true);
    Vibration.vibrate(100);

    // ── Duplicate check ───────────────────────────────────────────────────
    if (scannedData.some((s) => s.lotNumber === data.trim())) {
      Alert.alert(
        '⚠️ Duplicate LOT',
        `LOT "${data}" already scanned in this session.`,
        [{ text: 'OK', onPress: resumeScan }]
      );
      return;
    }

    setValidating(true);
    setScanning(false);

    try {
      // validateLot now uses correct bind vars: lot_no= & org_id=
      const lot = await validateLot(data.trim());

      // ── LOT not found in DB ───────────────────────────────────────────────
      if (!lot) {
        Alert.alert(
          '❌ LOT Not Found',
          `LOT "${data}" does not exist in the system (org 91).`,
          [{ text: 'Try Again', onPress: resumeScan }]
        );
        return;
      }

      // ── Item code mismatch ────────────────────────────────────────────────
      if (lot.itemCode.trim().toUpperCase() !== item.item.trim().toUpperCase()) {
        Alert.alert(
          '❌ Wrong Item',
          `LOT item does not match this line.\n\nExpected:  ${item.item}\nLOT has:   ${lot.itemCode}`,
          [{ text: 'Try Again', onPress: resumeScan }]
        );
        return;
      }

      // ── EXPIRED warning — ask user to confirm or reject ───────────────────
      if (lot.isExpired === 'Y' || lot.validationStatus.startsWith('WARNING')) {
        Alert.alert(
          '⚠️ LOT Expired',
          `LOT ${lot.lotNumber} expired on ${lot.expirationDate}.\n\nDo you still want to use it?`,
          [
            { text: 'Reject', style: 'cancel', onPress: resumeScan },
            {
              text: 'Accept Anyway',
              onPress: () => commitScan(lot),
            },
          ]
        );
        return;
      }

      // ── All good — commit ─────────────────────────────────────────────────
      await commitScan(lot);

    } catch (err) {
      // isLotInvalid is thrown by validateLot for INVALID: status
      if (err.isLotInvalid) {
        Alert.alert(
          '🚫 LOT Invalid',
          `${err.lot.validationStatus}\n\nLOT: ${err.lot.lotNumber}\nStatus: ${err.lot.lotStatus}`,
          [{ text: 'Try Again', onPress: resumeScan }]
        );
      } else {
        Alert.alert(
          '⚠️ API Error',
          err.message || 'Something went wrong during validation.',
          [{ text: 'Retry', onPress: resumeScan }]
        );
      }
    } finally {
      setValidating(false);
    }
  };

  // ── commitScan: add validated LOT to session list ───────────────────────
  // NOTE: create_header is called once in ProcessScreen when a WIP batch is
  // selected — it creates the archive header + copies ingredient lines.
  // This scanner only records individual LOT scans locally; the Transact
  // button submits them all at once via scan_transact.
  const commitScan = async (lot) => {
    const newEntry = {
      id:               `${Date.now()}`,
      lotNumber:        lot.lotNumber,
      itemCode:         lot.itemCode,
      nettoKg:          nettoPerCase,
      expirationDate:   lot.expirationDate,
      validationStatus: lot.validationStatus,
      onhandQty:        lot.onhandQty,
      scannedAt:        new Date().toLocaleTimeString(),
    };

    setScannedData((prev) => {
      const updated = [...prev, newEntry];
      if (updated.length >= item.plannedCase) {
        setTimeout(() => {
          Alert.alert(
            '✅ Complete',
            `All ${item.plannedCase} case(s) scanned for this line.`,
            [
              { text: 'Done',     onPress: () => navigation.goBack() },
              { text: 'Continue', onPress: () => { lastScanned.current = null; setScanned(false); } },
            ]
          );
        }, 300);
      } else {
        setTimeout(() => { lastScanned.current = null; setScanned(false); }, 1000);
      }
      return updated;
    });
  };

  // ── Remove entry ──────────────────────────────────────────────────────────
  const handleRemoveEntry = (id) => {
    Alert.alert('Remove Entry', 'Remove this scanned LOT entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => setScannedData((prev) => prev.filter((s) => s.id !== id)),
      },
    ]);
  };

  // ── Transact ──────────────────────────────────────────────────────────────
  //
  // Calls POST /create_header once per scanned LOT.
  //
  // The ORDS handler decides what to do internally:
  //   • No header yet for this batch  → creates header + inserts lines
  //   • Header exists, lot is new     → inserts lines only
  //   • Header exists, lot duplicate  → returns status:'existing' (skipped)
  //
  // Body sent every call: { batch_id, batch_no, org_id, lot_no, created_by }
  //
  const handleTransact = () => {
    if (scannedData.length === 0) {
      Alert.alert('No Scans', 'Please scan at least one LOT before transacting.');
      return;
    }
    Alert.alert(
      'Confirm Transact',
      `Submit ${scannedData.length} LOT(s) for Batch ${batch.batchNo}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setSubmitting(true);

              let createdCount  = 0;
              let skippedCount  = 0;

              for (const scan of scannedData) {
                const payload = {
                  batchId: batch.id,       // → batch_id  NUMBER
                  batchNo: batch.batchNo,  // → batch_no  VARCHAR2
                  lotNo:   scan.lotNumber, // → lot_no    VARCHAR2
                  // org_id and created_by are added inside createHeader()
                };

                console.log('[handleTransact] -> createHeader lot_no:', scan.lotNumber);
                const res = await createHeader(payload);
                console.log('[handleTransact] <- createHeader response:', JSON.stringify(res));

                const status = res?.status ?? 'unknown';

                if (status === 'existing') {
                  // LOT already committed to DB for this batch — warn immediately
                  Alert.alert(
                    '⚠️ LOT Already Used',
                    `LOT "${scan.lotNumber}" has already been transacted for Batch ${batch.batchNo}.\n\n` +
                    `(Lot No Sudah terdaftar)\n\nPlease remove this LOT and try again.`,
                    [{ text: 'OK' }]
                  );
                  return; // stop — user must fix the scan list first
                }

                if (status === 'created') {
                  createdCount++;
                } else {
                  // Unexpected status (e.g. 'error') — stop and show raw detail
                  Alert.alert(
                    '⚠️ Unexpected Response',
                    `status: "${status}"\n${res?.message ?? ''}\n\nRaw: ${JSON.stringify(res)}`,
                    [{ text: 'OK' }]
                  );
                  return;
                }
              }

              // ── All LOTs processed ────────────────────────────────────────
              Alert.alert(
                '✅ Transact Complete',
                `Batch:      ${batch.batchNo}\nSubmitted:  ${createdCount} LOT(s)`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );

            } catch (err) {
              console.error('[handleTransact] failed:', err.message);
              Alert.alert('❌ Transact Failed', err.message, [{ text: 'OK' }]);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Permission screens
  // ─────────────────────────────────────────────────────────────────────────
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredMsg}>
          <MaterialCommunityIcons name="camera-outline" size={48} color="#ccc" />
          <Text style={styles.msgText}>Requesting camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Scanner — Batch {batch.batchNo}</Text>
        </View>
        <View style={styles.centeredMsg}>
          <MaterialCommunityIcons name="camera-off" size={52} color="#e53e3e" />
          <Text style={styles.msgText}>Camera permission denied.</Text>
          <Text style={styles.msgSubText}>Enable camera access in Settings to use the scanner.</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText} numberOfLines={1}>
          Scanner — Batch {batch.batchNo}
        </Text>
        <TouchableOpacity
          style={[styles.transactBtn, (scannedData.length === 0 || submitting) && styles.transactBtnDisabled]}
          onPress={handleTransact}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.transactBtnText}>Transact</Text>}
        </TouchableOpacity>
      </View>

      {/* ── Summary Card ── */}
      <View style={styles.summaryCard}>
        <View style={styles.blueSide}>
          <Text style={styles.whiteLabel}>LINE</Text>
          <Text style={styles.whiteValue}>{item.id}</Text>
          <Text style={styles.whiteLabel}>ITEM CODE</Text>
          <Text style={styles.whiteItemCode} numberOfLines={2}>{item.item}</Text>
          <Text style={styles.whiteLabel}>BATCH</Text>
          <Text style={styles.whiteItemCode}>{batch.batchNo}</Text>
        </View>
        <View style={styles.statsSide}>
          <View style={styles.miniStat}>
            <Text style={styles.statLabel}>PENDING</Text>
            <Text style={[styles.statValueBold, totalPending === 0 && styles.statComplete]}>
              {totalPending}
            </Text>
            <Text style={styles.unitLabel}>case</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={styles.statLabel}>SCANNED</Text>
            <Text style={[styles.statValueBold, totalScanned > 0 && styles.statActive]}>
              {totalScanned}
            </Text>
            <Text style={styles.unitLabel}>LOT</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={styles.statLabel}>NETTO</Text>
            <Text style={styles.statValueBold}>{totalNetto.toFixed(2)}</Text>
            <Text style={styles.unitLabel}>Kg</Text>
          </View>
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabBar}>
        {[
          { id: TAB_SCAN,    icon: 'barcode-scan', label: 'Scan',    badge: totalScanned > 0 ? totalScanned : null,  badgeColor: '#005a92' },
          { id: TAB_HISTORY, icon: 'history',      label: 'History', badge: history.length > 0 ? history.length : null, badgeColor: '#10b981' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={16}
              color={activeTab === tab.id ? '#005a92' : '#888'}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {tab.badge != null && (
              <View style={[styles.tabBadge, { backgroundColor: tab.badgeColor }]}>
                <Text style={styles.tabBadgeText}>{tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: SCAN
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === TAB_SCAN && (
        <ScrollView contentContainerStyle={styles.scrollContent}>

          {/* Expected item */}
          <View style={styles.expectedBox}>
            <MaterialCommunityIcons name="information-outline" size={14} color="#005a92" />
            <Text style={styles.expectedText}>
              Scan LOT for: <Text style={styles.expectedCode}>{item.item}</Text>
            </Text>
          </View>

          {/* Validating banner */}
          {validating && (
            <View style={styles.validatingBox}>
              <ActivityIndicator size="small" color="#856404" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.validatingTitle}>Validating LOT…</Text>
                <Text style={styles.validatingSub}>Calling validate_lot API</Text>
              </View>
            </View>
          )}

          {/* Camera / scan button */}
          {!validating && (
            scanning ? (
              <View style={styles.cameraWrapper}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  enableTorch={torch}
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr','code128','code39','ean13','ean8','upc_a','upc_e','datamatrix'],
                  }}
                  onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                >
                  <View style={styles.scanOverlay}>
                    <View style={styles.scanFrame}>
                      <View style={[styles.corner, styles.cornerTL]} />
                      <View style={[styles.corner, styles.cornerTR]} />
                      <View style={[styles.corner, styles.cornerBL]} />
                      <View style={[styles.corner, styles.cornerBR]} />
                    </View>
                    <Text style={styles.scanHint}>Point at LOT barcode / QR code</Text>
                  </View>
                </CameraView>
                <View style={styles.cameraControls}>
                  <TouchableOpacity style={styles.cameraControlBtn} onPress={() => setTorch((t) => !t)}>
                    <MaterialCommunityIcons
                      name={torch ? 'flashlight' : 'flashlight-off'}
                      size={20}
                      color={torch ? '#f59e0b' : '#fff'}
                    />
                    <Text style={styles.cameraControlText}>{torch ? 'Flash On' : 'Flash Off'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cameraControlBtn, styles.cameraStopBtn]} onPress={stopScan}>
                    <MaterialCommunityIcons name="close" size={20} color="#fff" />
                    <Text style={styles.cameraControlText}>Close Camera</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.scanBtn} onPress={resumeScan}>
                <MaterialCommunityIcons name="barcode-scan" size={22} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.scanBtnText}>
                  {scannedData.length > 0 ? 'Scan More LOTs' : 'Start Scanning'}
                </Text>
              </TouchableOpacity>
            )
          )}

          {/* Scanned LOT table */}
          <View style={styles.dataSection}>
            <Text style={styles.sectionTitle}>
              Scanned LOTs
              {scannedData.length > 0 && (
                <Text style={styles.scannedCount}> ({totalScanned} / {item.plannedCase})</Text>
              )}
            </Text>

            {scannedData.length === 0 ? (
              <View style={styles.tablePlaceholder}>
                <MaterialCommunityIcons name="barcode-scan" size={28} color="#ccc" />
                <Text style={styles.placeholderText}>No LOTs scanned yet</Text>
              </View>
            ) : (
              <>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>LOT / Item</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Netto (Kg)</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Expiry</Text>
                  <Text style={[styles.tableHeaderCell, { width: 32 }]}> </Text>
                </View>

                {scannedData.map((scan, index) => (
                  <View key={scan.id} style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.tableCell} numberOfLines={1}>
                        {index + 1}. {scan.lotNumber}
                      </Text>
                      <Text style={styles.tableCellSub}>{scan.itemCode}</Text>
                      {scan.validationStatus?.startsWith('WARNING') && (
                        <Text style={styles.tableCellWarn}>⚠ Expired</Text>
                      )}
                    </View>
                    <Text style={[styles.tableCell, { flex: 1 }]}>
                      {scan.nettoKg.toFixed(2)}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>
                      {scan.expirationDate || '—'}
                    </Text>
                    <TouchableOpacity
                      style={{ width: 32, alignItems: 'center' }}
                      onPress={() => handleRemoveEntry(scan.id)}
                    >
                      <MaterialCommunityIcons name="close-circle-outline" size={18} color="#e53e3e" />
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.totalsRow}>
                  <Text style={[styles.totalsCell, { flex: 2 }]}>Total</Text>
                  <Text style={[styles.totalsCell, { flex: 1 }]}>{totalNetto.toFixed(2)} Kg</Text>
                  <Text style={[styles.totalsCell, { flex: 1 }]}>{totalScanned} LOT(s)</Text>
                  <View style={{ width: 32 }} />
                </View>
              </>
            )}
          </View>

        </ScrollView>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: HISTORY
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === TAB_HISTORY && (
        <ScrollView contentContainerStyle={styles.scrollContent}>

          <View style={styles.historyHeaderRow}>
            <Text style={styles.sectionTitle}>
              Scan History
              {history.length > 0 && (
                <Text style={styles.scannedCount}> ({history.length} record{history.length !== 1 ? 's' : ''})</Text>
              )}
            </Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadHistory} disabled={historyLoading}>
              <MaterialCommunityIcons name="refresh" size={18} color={historyLoading ? '#ccc' : '#005a92'} />
            </TouchableOpacity>
          </View>

          {historyLoading && (
            <View style={styles.historyLoading}>
              <ActivityIndicator size="small" color="#005a92" />
              <Text style={styles.historyLoadingText}>Loading history…</Text>
            </View>
          )}

          {!historyLoading && historyError && (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#b91c1c" />
              <Text style={styles.errorText}>{historyError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadHistory}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!historyLoading && !historyError && history.length === 0 && (
            <View style={styles.tablePlaceholder}>
              <MaterialCommunityIcons name="history" size={32} color="#ccc" />
              <Text style={styles.placeholderText}>No historical records found</Text>
            </View>
          )}

          {!historyLoading && !historyError && history.length > 0 && (
            <>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>LOT / Item</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Kg</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Scanned At</Text>
              </View>

              {history.map((rec, index) => (
                <View key={rec.id || index} style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.tableCell} numberOfLines={1}>{rec.lotNumber || '—'}</Text>
                    <Text style={styles.tableCellSub}>{rec.itemCode}</Text>
                  </View>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{rec.nettoKg.toFixed(2)}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{rec.scannedAt}</Text>
                </View>
              ))}

              <View style={styles.totalsRow}>
                <Text style={[styles.totalsCell, { flex: 2 }]}>Total</Text>
                <Text style={[styles.totalsCell, { flex: 1 }]}>
                  {history.reduce((s, r) => s + r.nettoKg, 0).toFixed(2)} Kg
                </Text>
                <Text style={[styles.totalsCell, { flex: 1 }]}>{history.length} rec.</Text>
              </View>
            </>
          )}

        </ScrollView>
      )}

    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },

  centeredMsg:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  msgText:           { fontSize: 16, color: '#555', marginTop: 12, textAlign: 'center', fontWeight: '600' },
  msgSubText:        { fontSize: 13, color: '#aaa', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  permissionBtn:     { marginTop: 20, backgroundColor: '#005a92', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 6 },
  permissionBtnText: { color: '#fff', fontWeight: '600' },

  headerBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#005a92', paddingHorizontal: 12, paddingVertical: 14,
  },
  headerBack:          { padding: 4, marginRight: 8 },
  headerText:          { flex: 1, color: '#fff', fontSize: 16, fontWeight: 'bold' },
  transactBtn:         { backgroundColor: '#27ae60', paddingVertical: 7, paddingHorizontal: 14, borderRadius: 4, minWidth: 76, alignItems: 'center' },
  transactBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.25)' },
  transactBtnText:     { color: '#fff', fontWeight: '700', fontSize: 13 },

  summaryCard: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderColor: '#e0e0e0',
  },
  blueSide:      { backgroundColor: '#005a92', padding: 14, width: '42%', justifyContent: 'center' },
  statsSide:     { flexDirection: 'row', flex: 1, padding: 10, justifyContent: 'space-around', alignItems: 'center' },
  whiteLabel:    { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 6 },
  whiteValue:    { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  whiteItemCode: { color: '#fff', fontSize: 10, fontWeight: '600' },
  miniStat:      { alignItems: 'center' },
  statLabel:     { fontSize: 9, color: '#888', textAlign: 'center' },
  statValueBold: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  statActive:    { color: '#27ae60' },
  statComplete:  { color: '#10b981' },
  unitLabel:     { fontSize: 10, color: '#999' },

  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 2, borderBottomColor: '#e8f0f7',
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive:   { borderBottomColor: '#005a92' },
  tabLabel:       { fontSize: 13, fontWeight: '600', color: '#888' },
  tabLabelActive: { color: '#005a92' },
  tabBadge:       { marginLeft: 6, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeText:   { color: '#fff', fontSize: 10, fontWeight: '700' },

  scrollContent: { padding: 12, paddingBottom: 40 },

  expectedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#e8f0f7', borderRadius: 8, padding: 10, marginBottom: 10,
  },
  expectedText: { fontSize: 12, color: '#444' },
  expectedCode: { fontWeight: '700', color: '#005a92' },

  validatingBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff3cd', borderRadius: 8, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#ffc107',
  },
  validatingTitle: { fontSize: 13, color: '#856404', fontWeight: '700' },
  validatingSub:   { fontSize: 11, color: '#856404', marginTop: 2 },

  cameraWrapper:    { borderRadius: 12, overflow: 'hidden', marginBottom: 10, height: 240 },
  camera:           { flex: 1 },
  scanOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  scanFrame:   { width: 210, height: 130, position: 'relative', marginBottom: 16 },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: '#fff', borderWidth: 3 },
  cornerTL: { top: 0,    left: 0,  borderRightWidth: 0,  borderBottomWidth: 0 },
  cornerTR: { top: 0,    right: 0, borderLeftWidth: 0,   borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0,  borderRightWidth: 0,  borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0,   borderTopWidth: 0 },
  scanHint: { color: '#fff', fontSize: 12, opacity: 0.9 },

  cameraControls: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#1a1a1a', paddingVertical: 10, paddingHorizontal: 16,
  },
  cameraControlBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8 },
  cameraStopBtn:     { backgroundColor: '#e53e3e', borderRadius: 4 },
  cameraControlText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  scanBtn: {
    flexDirection: 'row', backgroundColor: '#5cb85c',
    padding: 14, borderRadius: 8, alignItems: 'center',
    justifyContent: 'center', marginBottom: 12,
  },
  scanBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  dataSection:  { paddingBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  scannedCount: { fontSize: 14, color: '#0070ba', fontWeight: '600' },

  tablePlaceholder: {
    height: 90, backgroundColor: '#fff', justifyContent: 'center',
    alignItems: 'center', borderRadius: 8,
    borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc', gap: 6,
  },
  placeholderText: { color: '#bbb', fontSize: 13 },

  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#e8f0f7', paddingVertical: 8,
    paddingHorizontal: 10, borderRadius: 6, marginBottom: 2,
  },
  tableHeaderCell: { fontSize: 11, fontWeight: '700', color: '#005a92', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  tableRowAlt:    { backgroundColor: '#fafafa' },
  tableCell:      { fontSize: 12, color: '#333' },
  tableCellSub:   { fontSize: 10, color: '#888', marginTop: 1 },
  tableCellWarn:  { fontSize: 10, color: '#f59e0b', marginTop: 1, fontWeight: '600' },
  totalsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 10,
    backgroundColor: '#e8f0f7', borderRadius: 6, marginTop: 4,
  },
  totalsCell: { fontSize: 12, fontWeight: '700', color: '#005a92' },

  historyHeaderRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  refreshBtn:         { padding: 6 },
  historyLoading:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 },
  historyLoadingText: { fontSize: 13, color: '#888' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef2f2', padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#fecaca',
  },
  errorText: { flex: 1, fontSize: 12, color: '#b91c1c' },
  retryBtn:  { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#b91c1c', borderRadius: 4 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

export default ScannerScreen;