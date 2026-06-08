import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView,
  TouchableOpacity, SafeAreaView, Alert,
  TextInput, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchAllBatches, fetchIngredients, submitBatch } from '../../services';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getStatusColor = (status) => {
  switch (status) {
    case 'WIP':     return '#f59e0b';
    case 'Pending': return '#6b7280';
    default:        return '#6b7280';
  }
};

const Separator = () => <View style={styles.separator} />;

// ─── LOV Modal ────────────────────────────────────────────────────────────────
const BatchLOVModal = ({ visible, onClose, onSelect, currentBatchNo }) => {
  const [searchText, setSearchText]   = useState('');
  const [allBatches, setAllBatches]   = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  // Fetch once when modal opens
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchAllBatches();
        if (!cancelled) setAllBatches(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load batches.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible]);

  const filtered = allBatches.filter((b) =>
    b.batchNo.toLowerCase().includes(searchText.toLowerCase()) ||
    b.recipe.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleClose = () => {
    setSearchText('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>

          {/* ── Modal Header ── */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Batch</Text>
            <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
              <MaterialCommunityIcons name="close" size={22} color="#333" />
            </TouchableOpacity>
          </View>

          <Separator />

          {/* ── Search Input ── */}
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={20} color="#888" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search batch no or recipe..."
              placeholderTextColor="#aaa"
              value={searchText}
              onChangeText={setSearchText}
              autoCorrect={false}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#aaa" />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Loading ── */}
          {loading && (
            <View style={styles.lovLoading}>
              <ActivityIndicator size="small" color="#005a92" />
              <Text style={styles.lovLoadingText}>Loading...</Text>
            </View>
          )}

          {/* ── Error ── */}
          {!loading && error && (
            <View style={styles.lovErrorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#b91c1c" />
              <Text style={styles.lovErrorText}>{error}</Text>
            </View>
          )}

          {/* ── Batch List ── */}
          {!loading && !error && (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = item.batchNo === currentBatchNo;
                return (
                  <TouchableOpacity
                    style={[styles.lovRow, isSelected && styles.lovRowSelected]}
                    onPress={() => {
                      onSelect(item);
                      setSearchText('');
                      onClose();
                    }}
                  >
                    <View style={styles.lovRowLeft}>
                      <Text style={[styles.lovBatchNo, isSelected && styles.lovBatchNoSelected]}>
                        {item.batchNo}
                      </Text>
                      <Text style={styles.lovRecipe}>{item.recipe}</Text>
                    </View>
                    <View style={styles.lovRowRight}>
                      <View style={[styles.statusBadgeSmall, { backgroundColor: getStatusColor(item.status) }]}>
                        <Text style={styles.statusBadgeSmallText}>{item.status}</Text>
                      </View>
                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={18}
                          color="#005a92"
                          style={{ marginTop: 4 }}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.lovEmpty}>
                  <MaterialCommunityIcons name="tray-remove" size={36} color="#ccc" />
                  <Text style={styles.lovEmptyText}>No batches found</Text>
                </View>
              }
              ItemSeparatorComponent={() => <View style={styles.lovDivider} />}
            />
          )}

        </View>
      </View>
    </Modal>
  );
};

// ─── Main ProcessScreen ───────────────────────────────────────────────────────
const ProcessScreen = ({ navigation }) => {
  const [selectedBatch, setSelectedBatch]   = useState(null);
  const [lovVisible, setLovVisible]         = useState(false);
  const [ingredients, setIngredients]       = useState([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [ingredientsError, setIngredientsError]     = useState(null);
  const [submitting, setSubmitting]         = useState(false);

  const isWIP     = selectedBatch?.status === 'WIP';
  const isPending = selectedBatch?.status === 'Pending';

  // ── Load ingredients whenever a WIP batch is selected ────────────────────
  const loadIngredients = useCallback(async (batch_id) => {
    try {
      setIngredientsLoading(true);
      setIngredientsError(null);
      const data = await fetchIngredients(batch_id);  // FIX Bug 1: pass batch.id (numeric)
      setIngredients(data);
    } catch (err) {
      setIngredientsError(err.message || 'Failed to load ingredients.');
    } finally {
      setIngredientsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isWIP && selectedBatch?.id) {
      loadIngredients(selectedBatch.id);   // FIX Bug 1: was selectedBatch.batchNo ❌
    } else {
      setIngredients([]);
      setIngredientsError(null);
    }
  }, [selectedBatch, isWIP, loadIngredients]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!selectedBatch) {
      Alert.alert('No Batch Selected', 'Please select a batch before submitting.');
      return;
    }
    if (isPending) {
      Alert.alert('Cannot Submit', 'This batch is Pending. Please select a WIP batch to process.');
      return;
    }
    Alert.alert(
      'Submit Confirmation',
      `Submit Batch ${selectedBatch.batchNo}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              setSubmitting(true);
              await submitBatch(selectedBatch.batchNo);
              Alert.alert('Success', 'Batch submitted successfully.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (err) {
              Alert.alert('Submit Failed', err.message || 'Something went wrong.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>

      {/* ── App Bar ── */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Feeding Consumption Process</Text>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!selectedBatch || isPending || submitting) && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.submitBtnText}>Submit</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── LOV Batch Selector Card ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Batch Selection</Text>
          <Separator />
          <Text style={styles.label}>Batch No</Text>

          <TouchableOpacity style={styles.lovTrigger} onPress={() => setLovVisible(true)}>
            {selectedBatch ? (
              <View style={styles.lovTriggerLeft}>
                <Text style={styles.lovTriggerBatchNo}>{selectedBatch.batchNo}</Text>
                <Text style={styles.lovTriggerRecipe}>{selectedBatch.recipe}</Text>
              </View>
            ) : (
              <View style={styles.lovTriggerLeft}>
                <Text style={styles.lovPlaceholder}>Tap to select a batch...</Text>
              </View>
            )}
            <View style={styles.lovTriggerRight}>
              {selectedBatch && (
                <View style={[styles.statusBadgeSmall, { backgroundColor: getStatusColor(selectedBatch.status) }]}>
                  <Text style={styles.statusBadgeSmallText}>{selectedBatch.status}</Text>
                </View>
              )}
              <MaterialCommunityIcons
                name="chevron-down"
                size={20}
                color="#005a92"
                style={{ marginTop: selectedBatch ? 4 : 0 }}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Empty State — nothing selected yet ── */}
        {!selectedBatch && (
          <View style={styles.emptyStateBanner}>
            <MaterialCommunityIcons name="format-list-bulleted" size={52} color="#c5d8ea" />
            <Text style={styles.emptyStateTitle}>No Batch Selected</Text>
            <Text style={styles.emptyStateSubText}>
              Tap the batch selector above to choose a WIP or Pending batch to process.
            </Text>
            <TouchableOpacity
              style={styles.selectBatchBtn}
              onPress={() => setLovVisible(true)}
            >
              <MaterialCommunityIcons name="magnify" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.selectBatchBtnText}>Select Batch</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Header Card — only shown when batch is selected ── */}
        {selectedBatch && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Header</Text>
            <Separator />

            <View style={styles.fieldRow}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Batch No</Text>
                <Text style={styles.readOnlyValue}>{selectedBatch.batchNo}</Text>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedBatch.status) }]}>
                  <Text style={styles.statusBadgeText}>{selectedBatch.status}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.label}>Recipe</Text>
            <Text style={styles.readOnlyValue}>{selectedBatch.recipe}</Text>

            <Text style={styles.label}>Planned Start Date</Text>
            <Text style={styles.readOnlyValue}>{selectedBatch.startDate}</Text>
          </View>
        )}

        {/* ── Pending State — locked ── */}
        {isPending && (
          <View style={styles.pendingBanner}>
            <MaterialCommunityIcons name="lock-outline" size={36} color="#6b7280" />
            <Text style={styles.pendingTitle}>Batch is Pending</Text>
            <Text style={styles.pendingSubText}>
              This batch has not started yet. Ingredients cannot be selected.
              Please choose a WIP batch to proceed.
            </Text>
            <TouchableOpacity
              style={styles.pickAnotherBtn}
              onPress={() => setLovVisible(true)}
            >
              <MaterialCommunityIcons name="swap-horizontal" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.pickAnotherText}>Pick Another Batch</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── WIP State — show ingredients ── */}
        {isWIP && (
          <>
            <Text style={styles.sectionTitle}>Ingredients</Text>

            {ingredientsLoading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#005a92" />
                <Text style={styles.loadingText}>Loading ingredients...</Text>
              </View>
            )}

            {!ingredientsLoading && ingredientsError && (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#b91c1c" />
                <Text style={styles.errorText}>{ingredientsError}</Text>
                <TouchableOpacity
                  onPress={() => loadIngredients(selectedBatch.id)}  // FIX Bug 1: was batchNo ❌
                  style={styles.retryBtn}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {!ingredientsLoading && !ingredientsError && ingredients.length === 0 && (
              <View style={styles.emptyBox}>
                <MaterialCommunityIcons name="tray-remove" size={36} color="#ccc" />
                <Text style={styles.emptyText}>No ingredients found for this batch.</Text>
              </View>
            )}

            {!ingredientsLoading && !ingredientsError && ingredients.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={styles.ingredientCard}
                onPress={() => navigation.navigate('Scanner', { item, batch: selectedBatch })}
              >
                {/* Ingredient Header */}
                <View style={styles.ingredientHeader}>
                  <View>
                    <Text style={styles.lineLabel}>Line 0{index + 1}</Text>
                    <Text style={styles.itemCode}>{item.item}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color="#0070ba" />
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Planned{'\n'}Case</Text>
                    <Text style={styles.statValue}>{item.plannedCase}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Planned{'\n'}Kg</Text>
                    <Text style={styles.statValue}>{item.plannedKg}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Actual{'\n'}Case</Text>
                    <Text style={[styles.statValue, item.actualCase > 0 && styles.actualActive]}>
                      {item.actualCase}
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Actual{'\n'}Kg</Text>
                    <Text style={[styles.statValue, item.actualKg > 0 && styles.actualActive]}>
                      {item.actualKg}
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBg}>
                  <View style={[
                    styles.progressFill,
                    { width: `${Math.min((item.actualCase / item.plannedCase) * 100, 100)}%` },
                  ]} />
                </View>
                <Text style={styles.progressLabel}>
                  {item.plannedCase > 0
                    ? `${Math.round((item.actualCase / item.plannedCase) * 100)}% completed`
                    : '0% completed'}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}

      </ScrollView>

      {/* ── LOV Modal ── */}
      <BatchLOVModal
        visible={lovVisible}
        onClose={() => setLovVisible(false)}
        onSelect={(batch) => setSelectedBatch(batch)}
        currentBatchNo={selectedBatch?.batchNo ?? null}
      />

    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#f4f7f6' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  appBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#ddd',
  },
  backBtn:          { padding: 4 },
  appBarTitle:      { fontSize: 16, fontWeight: 'bold', color: '#111', flex: 1, marginLeft: 8 },
  submitBtn:        { backgroundColor: '#0070ba', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 4, minWidth: 70, alignItems: 'center' },
  submitBtnDisabled:{ backgroundColor: '#b0bec5' },
  submitBtnText:    { color: '#fff', fontWeight: 'bold' },
  card: {
    backgroundColor: '#fff', borderRadius: 8, padding: 16,
    marginBottom: 16, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 2,
  },
  cardHeader: { fontSize: 14, fontWeight: 'bold', color: '#666' },
  separator:  { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  lovTrigger: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#005a92', borderRadius: 8,
    padding: 12, marginTop: 6, backgroundColor: '#f0f6ff',
  },
  lovTriggerLeft:    { flex: 1 },
  lovTriggerBatchNo: { fontSize: 16, fontWeight: '700', color: '#005a92' },
  lovTriggerRecipe:  { fontSize: 12, color: '#666', marginTop: 2 },
  lovTriggerRight:   { alignItems: 'center' },
  lovPlaceholder:    { fontSize: 14, color: '#aaa', fontStyle: 'italic' },
  emptyStateBanner: {
    backgroundColor: '#fff', borderRadius: 8, padding: 32,
    alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  emptyStateTitle:   { fontSize: 16, fontWeight: '700', color: '#555', marginTop: 12 },
  emptyStateSubText: { fontSize: 13, color: '#aaa', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  selectBatchBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#005a92', marginTop: 16,
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6,
  },
  selectBatchBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  fieldRow:      { flexDirection: 'row', gap: 10 },
  fieldGroup:    { flex: 1 },
  label:         { fontSize: 12, color: '#888', marginTop: 10, fontWeight: '600' },
  readOnlyValue: {
    backgroundColor: '#f9f9f9', padding: 10, borderRadius: 6, marginTop: 4,
    fontSize: 13, color: '#333', borderWidth: 1, borderColor: '#e0e0e0',
  },
  statusBadge:          { marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusBadgeText:      { color: '#fff', fontWeight: '700', fontSize: 13 },
  statusBadgeSmall:     { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeSmallText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  pendingBanner: {
    backgroundColor: '#fff', borderRadius: 8, padding: 24,
    alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: '#e0e0e0', borderStyle: 'dashed',
  },
  pendingTitle:    { fontSize: 16, fontWeight: '700', color: '#6b7280', marginTop: 10 },
  pendingSubText:  { fontSize: 13, color: '#aaa', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  pickAnotherBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#005a92', marginTop: 16,
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6,
  },
  pickAnotherText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  sectionTitle:   { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  ingredientCard: {
    backgroundColor: '#fff', borderRadius: 8, padding: 15,
    marginBottom: 12, borderLeftWidth: 5, borderLeftColor: '#0070ba',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 2,
  },
  ingredientHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  lineLabel:    { fontSize: 11, color: '#888' },
  itemCode:     { fontSize: 14, fontWeight: '700', color: '#0070ba' },
  statsRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statBox:      { flex: 1, alignItems: 'center' },
  statLabel:    { fontSize: 10, color: '#888', textAlign: 'center' },
  statValue:    { fontSize: 14, fontWeight: '600', color: '#333' },
  actualActive: { color: '#27ae60' },
  progressBg:   { height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, marginTop: 4 },
  progressFill: { height: 6, backgroundColor: '#0070ba', borderRadius: 3 },
  progressLabel:{ fontSize: 11, color: '#888', marginTop: 4, textAlign: 'right' },
  emptyBox:     { backgroundColor: '#fff', borderRadius: 8, padding: 24, alignItems: 'center' },
  emptyText:    { color: '#aaa', fontSize: 14, marginTop: 8 },
  loadingBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, backgroundColor: '#fff', borderRadius: 8, marginBottom: 12 },
  loadingText: { fontSize: 13, color: '#888' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef2f2', padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#fecaca', marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 12, color: '#b91c1c' },
  retryBtn:  { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#b91c1c', borderRadius: 4 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContainer:  { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '75%', paddingBottom: 24 },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  modalTitle:      { fontSize: 17, fontWeight: 'bold', color: '#111' },
  modalCloseBtn:   { padding: 4 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f5f5f5', borderRadius: 8,
    marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput:        { flex: 1, fontSize: 14, color: '#333' },
  lovLoading:         { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 20, justifyContent: 'center' },
  lovLoadingText:     { fontSize: 13, color: '#888' },
  lovErrorBox:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', margin: 16, padding: 10, borderRadius: 8 },
  lovErrorText:       { flex: 1, fontSize: 12, color: '#b91c1c' },
  lovRow:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  lovRowSelected:     { backgroundColor: '#f0f6ff' },
  lovRowLeft:         { flex: 1 },
  lovBatchNo:         { fontSize: 15, fontWeight: '700', color: '#333' },
  lovBatchNoSelected: { color: '#005a92' },
  lovRecipe:          { fontSize: 12, color: '#888', marginTop: 2 },
  lovRowRight:        { alignItems: 'center', marginLeft: 12 },
  lovDivider:         { height: 1, backgroundColor: '#f0f0f0', marginHorizontal: 16 },
  lovEmpty:           { alignItems: 'center', paddingVertical: 40 },
  lovEmptyText:       { color: '#aaa', marginTop: 8, fontSize: 14 },
});

export default ProcessScreen;