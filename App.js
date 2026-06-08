import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen              from './src/screens/main/Loginscreen';
import FeedingConsumptionScreen from './src/screens/main/FeedingConsumptionScreen';
import ProcessScreen            from './src/screens/main/ProcessScreen';
import BatchDetailScreen        from './src/screens/main/BatchDetailScreen';
import ScannerScreen            from './src/screens/main/Scanner';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle:      { backgroundColor: '#005a92' },
          headerTintColor:  '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        {/* ── Auth — no header, full-screen branded login ── */}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />

        {/* ── Main App ── */}
        <Stack.Screen
          name="FeedingConsumption"
          component={FeedingConsumptionScreen}
          options={{ title: 'Feeding Consumption' }}
        />
        <Stack.Screen
          name="Process"
          component={ProcessScreen}
          options={{ title: 'Process' }}
        />
        <Stack.Screen
          name="BatchDetail"
          component={BatchDetailScreen}
          options={({ route }) => ({ title: `Batch ${route.params.batchNo}` })}
        />
        <Stack.Screen
          name="Scanner"
          component={ScannerScreen}
          options={{ title: 'Scanner' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}