import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';

// ─── Updated path: go up 3 levels to reach src/types/types.ts ────────────────
import { RootStackParamList } from '../../types/types';

// ─── Types ────────────────────────────────────────────────────────────────────
type Batch = {
  id: string;
  batchNo: string;
  status: string;
  recipe: string;
};

type FeedingConsumptionNavProp = StackNavigationProp<
  RootStackParamList,
  'FeedingConsumption'
>;

type Props = {
  navigation: FeedingConsumptionNavProp;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_BATCHES: Batch[] = [
  { id: '1', batchNo: '3628', status: 'WIP',  recipe: 'WP.PML.XXXC2' },
  { id: '2', batchNo: '3629', status: 'Done', recipe: 'WP.PML.XXXC3' },
  { id: '3', batchNo: '3630', status: 'WIP',  recipe: 'WP.PML.XXXC4' },
];

// ─── Component ────────────────────────────────────────────────────────────────
const FeedingConsumptionScreen: React.FC<Props> = ({ navigation }) => {

  const handleProcessPress = (): void => {
    navigation.navigate('Process');
  };

  const handleBatchPress = (batchNo: string): void => {
    navigation.navigate('BatchDetail', { batchNo });
  };

  const getStatusStyle = (status: string): ViewStyle => {
    switch (status) {
      case 'WIP':  return styles.badgeWIP;
      case 'Done': return styles.badgeDone;
      default:     return styles.badgeDefault;
    }
  };

  const renderItem = ({ item }: { item: Batch }): React.ReactElement => (
    <View style={styles.row}>
      <View style={styles.colLink}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleBatchPress(item.batchNo)}
          accessibilityLabel={`Open batch ${item.batchNo}`}
        >
          <MaterialCommunityIcons
            name="file-document-outline"
            size={22}
            color="#005a92"
          />
        </TouchableOpacity>
      </View>
      <Text style={[styles.cell, styles.colBatchNo]}>{item.batchNo}</Text>
      <View style={styles.colStatus}>
        <View style={[styles.badge, getStatusStyle(item.status)] as ViewStyle[]}>
          <Text style={styles.badgeText}>{item.status}</Text>
        </View>
      </View>
      <Text style={[styles.cell, styles.colRecipe]} numberOfLines={1}>
        {item.recipe}
      </Text>
    </View>
  );

  const renderEmpty = (): React.ReactElement => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="tray-remove" size={48} color="#ccc" />
      <Text style={styles.emptyText}>No batches found</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

      <View style={styles.header}>
        <Text style={styles.title}>Feeding Consumption List</Text>
        <TouchableOpacity
          style={styles.processButton}
          onPress={handleProcessPress}
          accessibilityLabel="Process button"
        >
          <MaterialCommunityIcons
            name="cog-outline"
            size={16}
            color="#fff"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.buttonText}>Process</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.row, styles.tableHeader]}>
        <Text style={[styles.cellHeader, styles.colLink]}>Link</Text>
        <Text style={[styles.cellHeader, styles.colBatchNo]}>Batch No</Text>
        <Text style={[styles.cellHeader, styles.colStatus]}>Status</Text>
        <Text style={[styles.cellHeader, styles.colRecipe]}>Recipe</Text>
      </View>

      <FlatList<Batch>
        data={MOCK_BATCHES}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={
          MOCK_BATCHES.length === 0 ? styles.emptyList : undefined
        }
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  title:          { fontSize: 18, fontWeight: '700', color: '#111' },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#005a92',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  buttonText:     { color: '#fff', fontWeight: '600', fontSize: 14 },
  tableHeader:    { backgroundColor: '#e8f0f7', borderBottomWidth: 2, borderColor: '#c5d8ea' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  colLink:        { width: 40 },
  colBatchNo:     { flex: 1 },
  colStatus:      { flex: 1 },
  colRecipe:      { flex: 2 },
  cellHeader: {
    fontWeight: '700',
    fontSize: 13,
    color: '#005a92',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cell:           { fontSize: 14, color: '#333' },
  iconButton:     { padding: 4 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText:      { fontSize: 12, fontWeight: '600', color: '#fff' },
  badgeWIP:       { backgroundColor: '#f59e0b' },
  badgeDone:      { backgroundColor: '#10b981' },
  badgeDefault:   { backgroundColor: '#6b7280' },
  emptyList:      { flexGrow: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText:      { marginTop: 12, fontSize: 15, color: '#aaa' },
});

export default FeedingConsumptionScreen;
