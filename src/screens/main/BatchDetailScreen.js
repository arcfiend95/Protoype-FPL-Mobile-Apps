import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView,
  SafeAreaView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchIngredients } from '../../services';

// ─────────────────────────────────────────────────────────────────────────────

const Separator = () => <View style={styles.separator} />;

const BatchDetailScreen = ({ route, navigation }) => {
  const { batch } = route.params;

  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  // ── Fetch ingredients from REST API ───────────────────────────────────────
  const loadIngredients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // FIX Bug 2: pass batch.id (numeric batch_id) not batch.batchNo
      // fetchIngredients calls GET /batch_detail?batch_id=<id>
      const data = await fetchIngredients(batch.id);
      setIngredients(data);
    } catch (err) {
      setError(err.message || 'Failed to load ingredients.');
    } finally {
      setLoading(false);
    }
  }, [batch.id]);   // FIX Bug 2: dependency is batch.id, not batch.batchNo

  useEffect(() => {
    loadIngredients();
  }, [loadIngredients]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getStatusColor = (status) => {
    switch (status) {
      case 'WIP':  return '#f59e0b';
      case 'Done': return '#10b981';
      default:     return '#6b7280';
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>

      {/* ── App Bar ── */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Batch Detail</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── Read-only notice ── */}
        <View style={styles.noticeBanner}>
          <MaterialCommunityIcons name="information-outline" size={16} color="#005a92" />
          <Text style={styles.noticeText}>Historical view only — no changes can be made</Text>
        </View>

        {/* ── Header Card ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Header</Text>
          <Separator />

          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Batch No</Text>
              <Text style={styles.readOnlyValue}>{batch.batchNo}</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(batch.status) }]}>
                <Text style={styles.statusBadgeText}>{batch.status}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.label}>Recipe</Text>
          <Text style={styles.readOnlyValue}>{batch.recipe}</Text>

          <Text style={styles.label}>Planned Start Date</Text>
          <Text style={styles.readOnlyValue}>{batch.startDate}</Text>
        </View>

        {/* ── Ingredients Card ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Ingredients</Text>
          <Separator />

          {/* Loading */}
          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#005a92" />
              <Text style={styles.loadingText}>Loading ingredients...</Text>
            </View>
          )}

          {/* Error */}
          {!loading && error && (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#b91c1c" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={loadIngredients} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Empty */}
          {!loading && !error && ingredients.length === 0 && (
            <Text style={styles.emptyText}>No ingredients found.</Text>
          )}

          {/* List — uses plannedCase / plannedKg / actualCase / actualKg
              which are now correctly mapped in normaliseIngredient (Bug 3 fix) */}
          {!loading && !error && ingredients.map((item, index) => (
            <View key={item.id} style={styles.ingredientItem}>
              <Text style={styles.lineLabel}>Line 0{index + 1}</Text>
              <Text style={styles.itemCode}>{item.item}</Text>
              <View style={styles.qtyRow}>
                <View style={styles.qtyBox}>
                  <Text style={styles.qtyLabel}>Planned Case</Text>
                  <Text style={styles.qtyValue}>{item.plannedCase}</Text>
                </View>
                <View style={styles.qtyBox}>
                  <Text style={styles.qtyLabel}>Planned Kg</Text>
                  <Text style={styles.qtyValue}>{item.plannedKg}</Text>
                </View>
                <View style={styles.qtyBox}>
                  <Text style={styles.qtyLabel}>Actual Case</Text>
                  <Text style={[styles.qtyValue, item.actualCase > 0 && styles.actualActive]}>
                    {item.actualCase}
                  </Text>
                </View>
                <View style={styles.qtyBox}>
                  <Text style={styles.qtyLabel}>Actual Kg</Text>
                  <Text style={[styles.qtyValue, item.actualKg > 0 && styles.actualActive]}>
                    {item.actualKg}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#f4f7f6' },
  scrollContent: { padding: 16 },
  appBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#ddd',
  },
  backBtn:      { padding: 4 },
  appBarTitle:  { fontSize: 17, fontWeight: 'bold', color: '#111' },
  noticeBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f0f7',
    borderRadius: 8, padding: 10, marginBottom: 12, gap: 8,
  },
  noticeText:   { fontSize: 12, color: '#005a92', flex: 1 },
  card: {
    backgroundColor: '#fff', borderRadius: 8, padding: 16,
    marginBottom: 16, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 2,
  },
  cardHeader:   { fontSize: 14, fontWeight: 'bold', color: '#666' },
  separator:    { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  fieldRow:     { flexDirection: 'row', gap: 10, marginBottom: 4 },
  fieldGroup:   { flex: 1 },
  label:        { fontSize: 12, color: '#888', marginTop: 10, fontWeight: '600' },
  readOnlyValue: {
    backgroundColor: '#f9f9f9', padding: 10, borderRadius: 6,
    marginTop: 4, fontSize: 13, color: '#333',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  statusBadge:     { marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  loadingBox:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  loadingText:     { fontSize: 13, color: '#888' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef2f2', padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#fecaca',
  },
  errorText:       { flex: 1, fontSize: 12, color: '#b91c1c' },
  retryBtn:        { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#b91c1c', borderRadius: 4 },
  retryText:       { color: '#fff', fontSize: 12, fontWeight: '600' },
  ingredientItem: {
    paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lineLabel:  { fontSize: 11, color: '#888' },
  itemCode:   { fontSize: 14, fontWeight: '700', color: '#2c3e50', marginBottom: 8 },
  qtyRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  qtyBox:     { flex: 1, alignItems: 'center' },
  qtyLabel:   { fontSize: 10, color: '#888', textAlign: 'center' },
  qtyValue:   { fontSize: 13, fontWeight: '600', color: '#333' },
  actualActive: { color: '#27ae60' },
  emptyText:  { color: '#aaa', textAlign: 'center', paddingVertical: 20 },
});

export default BatchDetailScreen;