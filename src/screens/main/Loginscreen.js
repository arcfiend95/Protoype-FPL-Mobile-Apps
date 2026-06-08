// ─── screens/main/LoginScreen.js ─────────────────────────────────────────────
import React, { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  TouchableOpacity, SafeAreaView, StatusBar,
  ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loginWithApex } from '../../services';

// ── Error code → icon + colour mapping ───────────────────────────────────────
const ERROR_META = {
  USER_NOT_FOUND:   { icon: 'account-off-outline',  color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  WRONG_PASSWORD:   { icon: 'lock-alert-outline',    color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  ACCOUNT_INACTIVE: { icon: 'account-lock-outline',  color: '#6b21a8', bg: '#faf5ff', border: '#e9d5ff' },
  ACCOUNT_LOCKED:   { icon: 'lock-remove-outline',   color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
  default:          { icon: 'alert-circle-outline',  color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
};

// ── Validation step labels shown while loading ────────────────────────────────
const STEP_IDLE      = null;
const STEP_CHECKING  = 'Checking credentials…';
const STEP_SIGNING   = 'Signing in to APEX…';

// ─────────────────────────────────────────────────────────────────────────────
const LoginScreen = ({ navigation }) => {
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingStep, setLoadingStep] = useState(STEP_IDLE);   // null | string
  const [error, setError]             = useState(null);        // { message, code }

  // Which field is highlighted as invalid
  const [usernameInvalid, setUsernameInvalid] = useState(false);
  const [passwordInvalid, setPasswordInvalid] = useState(false);

  const scrollRef   = useRef(null);
  const passwordRef = useRef(null);
  const shakeAnim   = useRef(new Animated.Value(0)).current;

  const isLoading = loadingStep !== STEP_IDLE;

  // ── Shake card on error ───────────────────────────────────────────────────
  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  -6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  // ── Scroll password field into view when keyboard opens ──────────────────
  const handlePasswordFocus = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  // ── Clear errors when user edits a field ─────────────────────────────────
  const handleUsernameChange = (t) => {
    setUsername(t);
    setError(null);
    setUsernameInvalid(false);
    setPasswordInvalid(false);
  };

  const handlePasswordChange = (t) => {
    setPassword(t);
    setError(null);
    setPasswordInvalid(false);
  };

  // ── Client-side empty checks ──────────────────────────────────────────────
  const validateLocally = () => {
    if (!username.trim()) {
      setError({ message: 'Please enter your username.', code: null });
      setUsernameInvalid(true);
      triggerShake();
      return false;
    }
    if (!password) {
      setError({ message: 'Please enter your password.', code: null });
      setPasswordInvalid(true);
      triggerShake();
      return false;
    }
    return true;
  };

  // ── Main login handler ────────────────────────────────────────────────────
  const handleLogin = async () => {
    setError(null);
    setUsernameInvalid(false);
    setPasswordInvalid(false);

    if (!validateLocally()) return;

    try {
      // Step 1 — DB validation
      setLoadingStep(STEP_CHECKING);
      // loginWithApex internally calls validateCredentials first,
      // then apexLogin. We show two different spinner labels.
      // We hook into the two phases via a small wrapper:
      await new Promise((resolve) => setTimeout(resolve, 0)); // flush state

      const user = await loginWithApex(username, password);

      setLoadingStep(STEP_SIGNING);
      await new Promise((resolve) => setTimeout(resolve, 400)); // brief visual pause

      navigation.replace('FeedingConsumption', { user });

    } catch (err) {
      const code = err.code ?? null;

      // Highlight the right field red
      if (code === 'USER_NOT_FOUND')   setUsernameInvalid(true);
      if (code === 'WRONG_PASSWORD')   setPasswordInvalid(true);
      if (code === 'ACCOUNT_INACTIVE' || code === 'ACCOUNT_LOCKED') {
        setUsernameInvalid(true);
      }

      setError({ message: err.message || 'Login failed. Please try again.', code });
      triggerShake();
    } finally {
      setLoadingStep(STEP_IDLE);
    }
  };

  // ── Error meta (icon, colours) ────────────────────────────────────────────
  const errMeta = error ? (ERROR_META[error.code] ?? ERROR_META.default) : null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#003f6b" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >

          {/* ── Branding ── */}
          <View style={styles.brandBlock}>
            <View style={styles.logoCircle}>
              <MaterialCommunityIcons name="factory" size={46} color="#fff" />
            </View>
            <Text style={styles.appName}>FPL Mobile</Text>
            <Text style={styles.appSubtitle}>Feeding Consumption System</Text>
          </View>

          {/* ── Card ── */}
          <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>

            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>Authenticated via Oracle APEX</Text>

            {/* ── Error Banner ── */}
            {error && errMeta && (
              <View style={[styles.errorBanner, { backgroundColor: errMeta.bg, borderColor: errMeta.border }]}>
                <MaterialCommunityIcons name={errMeta.icon} size={22} color={errMeta.color} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.errorTitle, { color: errMeta.color }]}>
                    {error.code === 'USER_NOT_FOUND'   ? 'Username not found'     :
                     error.code === 'WRONG_PASSWORD'   ? 'Incorrect password'     :
                     error.code === 'ACCOUNT_INACTIVE' ? 'Account inactive'       :
                     error.code === 'ACCOUNT_LOCKED'   ? 'Account locked'         :
                     'Sign in failed'}
                  </Text>
                  <Text style={[styles.errorMsg, { color: errMeta.color }]}>
                    {error.message}
                  </Text>
                </View>
              </View>
            )}

            {/* ── Username ── */}
            <Text style={styles.label}>
              Username
              {usernameInvalid && <Text style={styles.requiredDot}> ●</Text>}
            </Text>
            <View style={[
              styles.inputWrapper,
              usernameInvalid && styles.inputError,
              isLoading       && styles.inputDisabled,
            ]}>
              <MaterialCommunityIcons
                name={usernameInvalid ? 'account-off-outline' : 'account-outline'}
                size={20}
                color={usernameInvalid ? '#ef4444' : '#888'}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your APEX username"
                placeholderTextColor="#bbb"
                value={username}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!isLoading}
              />
              {usernameInvalid && (
                <MaterialCommunityIcons name="close-circle" size={18} color="#ef4444" />
              )}
            </View>

            {/* ── Password ── */}
            <Text style={styles.label}>
              Password
              {passwordInvalid && <Text style={styles.requiredDot}> ●</Text>}
            </Text>
            <View style={[
              styles.inputWrapper,
              passwordInvalid && styles.inputError,
              isLoading       && styles.inputDisabled,
            ]}>
              <MaterialCommunityIcons
                name={passwordInvalid ? 'lock-alert-outline' : 'lock-outline'}
                size={20}
                color={passwordInvalid ? '#ef4444' : '#888'}
                style={styles.inputIcon}
              />
              <TextInput
                ref={passwordRef}
                style={[styles.input, { flex: 1 }]}
                placeholder="Enter your password"
                placeholderTextColor="#bbb"
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                onFocus={handlePasswordFocus}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                disabled={isLoading}
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#888"
                />
              </TouchableOpacity>
            </View>

            {/* ── Validation step indicator ── */}
            {isLoading && (
              <View style={styles.stepRow}>
                <ActivityIndicator size="small" color="#005a92" />
                <Text style={styles.stepText}>{loadingStep}</Text>
              </View>
            )}

            {/* ── Sign In Button ── */}
            <TouchableOpacity
              style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.loginBtnText}>{loadingStep}</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <MaterialCommunityIcons name="login" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.loginBtnText}>Sign In</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ── APEX badge ── */}
            <View style={styles.apexBadge}>
              <MaterialCommunityIcons name="shield-check-outline" size={13} color="#005a92" />
              <Text style={styles.apexBadgeText}>
                Secured by Oracle APEX · apex_authentication.login
              </Text>
            </View>

          </Animated.View>

          <Text style={styles.footer}>Oracle APEX · ORDS · AP-Singapore-1</Text>
          <View style={{ height: 40 }} />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#004a7c' },
  scroll: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: 24, paddingTop: 40, paddingBottom: 20,
  },

  // Branding
  brandBlock:  { alignItems: 'center', marginBottom: 28 },
  logoCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  appName:     { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  appSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    elevation: 10, shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10,
  },
  cardTitle:    { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#999', marginBottom: 16 },

  // Error banner
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: 10, padding: 12, marginBottom: 14,
    borderWidth: 1,
  },
  errorTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  errorMsg:   { fontSize: 12, lineHeight: 17 },

  // Inputs
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 14 },
  requiredDot: { color: '#ef4444', fontSize: 10 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#d0d0d0',
    borderRadius: 10, backgroundColor: '#fafafa',
    paddingHorizontal: 12,
  },
  inputError:    { borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  inputDisabled: { backgroundColor: '#f0f0f0', borderColor: '#e0e0e0' },
  inputIcon:     { marginRight: 8 },
  input:         { flex: 1, height: 50, fontSize: 15, color: '#222' },
  eyeBtn:        { padding: 6 },

  // Step indicator (shown while loading)
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 14, paddingHorizontal: 4,
  },
  stepText: { fontSize: 12, color: '#005a92', fontWeight: '600' },

  // Button
  btnRow:    { flexDirection: 'row', alignItems: 'center' },
  loginBtn: {
    backgroundColor: '#005a92', borderRadius: 10,
    paddingVertical: 15, marginTop: 20,
    alignItems: 'center', justifyContent: 'center',
    elevation: 3,
    shadowColor: '#005a92', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 5,
  },
  loginBtnDisabled: { backgroundColor: '#8ab3cc' },
  loginBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 4 },

  // APEX badge
  apexBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 16, gap: 5,
    backgroundColor: '#f0f6ff', borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#c5d8ea',
  },
  apexBadgeText: { fontSize: 10, color: '#005a92', fontWeight: '600' },

  // Footer
  footer: {
    textAlign: 'center', color: 'rgba(255,255,255,0.4)',
    fontSize: 11, marginTop: 24,
  },
});

export default LoginScreen;