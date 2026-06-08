import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  FlatList, SafeAreaView, StatusBar, ActivityIndicator,
  RefreshControl, Alert, Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchBatchList } from '../../services';

// ─────────────────────────────────────────────────────────────────────────────

const FeedingConsumptionScreen = ({ navigation, route }) => {
  // user context passed from LoginScreen via navigation.replace('FeedingConsumption', { user })
  const user = route?.params?.user ?? null;

  const [batches, setBatches]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);
  const [logoutModal, setLogoutModal] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadBatches = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else           setLoading(true);
      setError(null);

      const data = await fetchBatchList();
      setBatches(data);
    } catch (err) {
      setError(err.message || 'Failed to load batches.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => loadBatches());
    return unsubscribe;
  }, [navigation, loadBatches]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => setLogoutModal(true);

  const confirmLogout = () => {
    setLogoutModal(false);
    // Replace entire stack back to Login — user cannot navigate back
    navigation.replace('Login');
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleBatchPress   = (batch) => navigation.navigate('BatchDetail', { batch });
  const handleProcessPress = ()       => navigation.navigate('Process');

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getStatusStyle = (status) => {
    switch (status) {
      case 'WIP':  return styles.badgeWIP;
      case 'Done': return styles.badgeDone;
      default:     return styles.badgeDefault;
    }
  };

  // ── Renderers ─────────────────────────────────────────────────────────────
  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.colLink}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleBatchPress(item)}
          accessibilityLabel={`View detail for batch ${item.batchNo}`}
        >
          <MaterialCommunityIcons name="file-document-outline" size={22} color="#005a92" />
        </TouchableOpacity>
      </View>
      <Text style={[styles.cell, styles.colBatchNo]}>{item.batchNo}</Text>
      <View style={styles.colStatus}>
        <View style={[styles.badge, getStatusStyle(item.status)]}>
          <Text style={styles.badgeText}>{item.status}</Text>
        </View>
      </View>
      <Text style={[styles.cell, styles.colRecipe]} numberOfLines={1}>
        {item.recipe}
      </Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="tray-remove" size={48} color="#ccc" />
      <Text style={styles.emptyText}>No batches found</Text>
    </View>
  );

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

      {/* ── Header ── */}
      <View style={styles.header}>

        {/* Left: title + logged-in user */}
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Feeding Consumption</Text>
          {user?.username ? (
            <View style={styles.userPill}>
              <MaterialCommunityIcons name="account-circle-outline" size={13} color="#005a92" />
              <Text style={styles.userPillText} numberOfLines={1}>
                {user.fullName || user.username}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Right: Process + Logout */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.processButton}
            onPress={handleProcessPress}
            accessibilityLabel="Process button"
          >
            <MaterialCommunityIcons name="cog-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.buttonText}>Process</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            accessibilityLabel="Logout button"
          >
            <MaterialCommunityIcons name="logout" size={18} color="#dc2626" />
          </TouchableOpacity>
        </View>

      </View>

      {/* ── Error Banner ── */}
      {error && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#b91c1c" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadBatches()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Full-screen loader ── */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#005a92" />
          <Text style={styles.loadingText}>Loading batches...</Text>
        </View>
      )}

      {/* ── Table ── */}
      {!loading && (
        <>
          <View style={[styles.row, styles.tableHeader]}>
            <Text style={[styles.cellHeader, styles.colLink]}>Link</Text>
            <Text style={[styles.cellHeader, styles.colBatchNo]}>Batch No</Text>
            <Text style={[styles.cellHeader, styles.colStatus]}>Status</Text>
            <Text style={[styles.cellHeader, styles.colRecipe]}>Recipe</Text>
          </View>

          <FlatList
            data={batches}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={batches.length === 0 ? styles.emptyList : undefined}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadBatches(true)}
                colors={['#005a92']}
                tintColor="#005a92"
              />
            }
          />
        </>
      )}

      {/* ── Logout Confirmation Modal ── */}
      <Modal
        visible={logoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>

            {/* Icon */}
            <View style={styles.modalIconBox}>
              <MaterialCommunityIcons name="logout" size={32} color="#dc2626" />
            </View>

            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalSubtitle}>
              Are you sure you want to sign out
              {user?.username ? ` as ${user.fullName || user.username}` : ''}?
            </Text>

            {/* User info strip */}
            {user?.username && (
              <View style={styles.modalUserStrip}>
                <MaterialCommunityIcons name="account-circle" size={20} color="#005a92" />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.modalUserName}>{user.fullName || user.username}</Text>
                  {user.email ? (
                    <Text style={styles.modalUserEmail}>{user.email}</Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setLogoutModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmLogoutBtn}
                onPress={confirmLogout}
              >
                <MaterialCommunityIcons name="logout" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.confirmLogoutBtnText}>Sign Out</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  // ── Header ──
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1, borderColor: '#e0e0e0',
    elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2,
  },
  headerLeft: { flex: 1, marginRight: 8 },
  title:      { fontSize: 17, fontWeight: '700', color: '#111' },
  userPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 3, alignSelf: 'flex-start',
    backgroundColor: '#e8f0f7', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  userPillText: { fontSize: 11, color: '#005a92', fontWeight: '600', maxWidth: 140 },

  headerActions:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  processButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#005a92',
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 6,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  logoutButton: {
    width: 36, height: 36, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#fecaca',
    backgroundColor: '#fff5f5',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Error ──
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2',
    borderRadius: 8, margin: 12, padding: 10, gap: 8,
    borderWidth: 1, borderColor: '#fecaca',
  },
  errorText: { flex: 1, fontSize: 12, color: '#b91c1c' },
  retryBtn:  { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#b91c1c', borderRadius: 4 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // ── Loading ──
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:      { fontSize: 14, color: '#888' },

  // ── Table ──
  tableHeader: { backgroundColor: '#e8f0f7', borderBottomWidth: 2, borderColor: '#c5d8ea' },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    paddingHorizontal: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderColor: '#f0f0f0',
  },
  colLink:    { width: 40 },
  colBatchNo: { flex: 1 },
  colStatus:  { flex: 1 },
  colRecipe:  { flex: 2 },
  cellHeader: {
    fontWeight: '700', fontSize: 13, color: '#005a92',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  cell:        { fontSize: 14, color: '#333' },
  iconButton:  { padding: 4 },
  badge:       { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText:   { fontSize: 12, fontWeight: '600', color: '#fff' },
  badgeWIP:    { backgroundColor: '#f59e0b' },
  badgeDone:   { backgroundColor: '#10b981' },
  badgeDefault:{ backgroundColor: '#6b7280' },
  emptyList:      { flexGrow: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText:      { marginTop: 12, fontSize: 15, color: '#aaa' },

  // ── Logout Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  modalCard: {
    width: '100%', backgroundColor: '#fff',
    borderRadius: 16, padding: 24,
    alignItems: 'center',
    elevation: 10, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  modalIconBox: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#fff5f5', borderWidth: 2, borderColor: '#fecaca',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  modalTitle:    { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  modalUserStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f0f6ff', borderRadius: 10, padding: 12,
    width: '100%', marginBottom: 20,
    borderWidth: 1, borderColor: '#c5d8ea',
  },
  modalUserName:  { fontSize: 14, fontWeight: '700', color: '#005a92' },
  modalUserEmail: { fontSize: 12, color: '#666', marginTop: 2 },
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#d0d0d0',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f9f9f9',
  },
  cancelBtnText:       { fontSize: 15, fontWeight: '600', color: '#444' },
  confirmLogoutBtn: {
    flex: 1, flexDirection: 'row', paddingVertical: 13, borderRadius: 10,
    backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center',
    elevation: 2,
  },
  confirmLogoutBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

export default FeedingConsumptionScreen;