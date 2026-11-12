import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { inviteCode, isOurLink } from '../lib/invite';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { ScreenProps } from '../navigation/types';

type Found = { kind: 'invite'; code: string } | { kind: 'broken' } | { kind: 'other' };

const FRAME = 240;
const GOLD = '#FDE047';

/**
 * Full-screen camera that reads a group's invite QR code (from Home's scan
 * button, or pulling right past All). Joining needs live groups, which come
 * later, so for now it says what it found and how to share a group today.
 * Nothing is recorded or saved.
 */
export function ScanScreen({ navigation }: ScreenProps<'Scan'>) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [found, setFound] = useState<Found | null>(null);
  const [available, setAvailable] = useState(true);

  // Only the web can say (a computer may have none). On a phone this call
  // doesn't exist and throws, so asking there would always say "no camera".
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    CameraView.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);

  // Ask once on arrival; after a "never" the screen offers Settings instead.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission().catch(() => {});
    // Only when the answer first arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.status]);

  const onScanned = useCallback(
    (r: BarcodeScanningResult) => {
      const code = inviteCode(r.data);
      // An invite goes straight to joining.
      if (code) navigation.replace('Join', { code });
      else setFound(isOurLink(r.data) ? { kind: 'broken' } : { kind: 'other' });
    },
    [navigation],
  );

  const typeCode = (
    <Pressable
      onPress={() => navigation.replace('Join')}
      hitSlop={8}
      accessibilityRole="button"
      style={[styles.typeCode, { bottom: insets.bottom + spacing(8) }]}
    >
      <Ionicons name="keypad-outline" size={16} color="#FFFFFF" />
      <Text style={styles.typeCodeText}>{t('join.typeCode')}</Text>
    </Pressable>
  );

  const close = (
    <Pressable
      onPress={() => navigation.goBack()}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t('common.cancel')}
      style={[styles.close, { top: insets.top + spacing(2) }]}
    >
      <Ionicons name="close" size={24} color="#FFFFFF" />
    </Pressable>
  );

  // No camera here (a computer without one, or a browser that won't share it).
  if (!available) {
    return (
      <View style={styles.screen}>
        {close}
        {typeCode}
        <Message icon="camera-outline" title={t('scan.noCamera.title')} body={t('scan.noCamera.body')} />
      </View>
    );
  }

  if (!permission) return <View style={styles.screen}>{close}</View>;

  if (!permission.granted) {
    return (
      <View style={styles.screen}>
        {close}
        {typeCode}
        <Message icon="camera-outline" title={t('scan.permTitle')} body={t('scan.permBody')}>
          {permission.canAskAgain ? (
            <PrimaryButton label={t('scan.allow')} onPress={() => requestPermission().catch(() => {})} style={styles.button} />
          ) : (
            <PrimaryButton label={t('scan.openSettings')} onPress={() => Linking.openSettings().catch(() => {})} style={styles.button} />
          )}
        </Message>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        // Stops reading while a result is showing, so it isn't found twice.
        onBarcodeScanned={found ? undefined : onScanned}
      />
      {/* A square to aim at, with gold corners. */}
      <View pointerEvents="none" style={styles.aim}>
        <View style={styles.frame}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <Text style={styles.aimText}>{t('scan.hint')}</Text>
      </View>
      {close}
      {found ? null : typeCode}

      {found ? (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing(5) }]}>
          <View style={styles.sheetIcon}>
            <Ionicons
              name={found.kind === 'invite' ? 'people' : 'alert-circle-outline'}
              size={24}
              color={found.kind === 'invite' ? '#7A1F2B' : '#C62828'}
            />
          </View>
          <Text style={styles.sheetTitle}>
            {found.kind === 'invite' ? t('scan.inviteTitle') : found.kind === 'broken' ? t('scan.brokenTitle') : t('scan.otherTitle')}
          </Text>
          {found.kind === 'invite' ? <Text style={styles.code}>{found.code}</Text> : null}
          <Text style={styles.sheetBody}>
            {found.kind === 'invite' ? t('scan.inviteBody') : found.kind === 'broken' ? t('scan.brokenBody') : t('scan.otherBody')}
          </Text>
          <PrimaryButton label={t('scan.again')} onPress={() => setFound(null)} style={styles.button} />
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.done}>
            <Text style={styles.doneText}>{t('scan.done')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Message({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.message}>
      <View style={styles.messageIcon}>
        <Ionicons name={icon} size={34} color={GOLD} />
      </View>
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageBody}>{body}</Text>
      {children}
    </View>
  );
}

// Always dark, like any camera.
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0506' },
  typeCode: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 2,
  },
  typeCodeText: { color: '#FFFFFF', fontSize: font.sm + 1, fontWeight: '700' },
  close: {
    position: 'absolute',
    left: spacing(4),
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 2,
  },
  aim: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  frame: { width: FRAME, height: FRAME },
  corner: { position: 'absolute', width: 36, height: 36, borderColor: GOLD },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  aimText: {
    color: '#FFFFFF',
    fontSize: font.md,
    fontWeight: '600',
    marginTop: spacing(6),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    overflow: 'hidden',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(5),
    alignItems: 'center',
  },
  sheetIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4E6E4',
  },
  sheetTitle: { fontSize: font.xl, fontWeight: '800', color: '#241012', marginTop: spacing(3), textAlign: 'center' },
  code: { fontSize: font.lg, fontWeight: '800', letterSpacing: 3, color: '#7A1F2B', marginTop: spacing(2) },
  sheetBody: { fontSize: font.sm + 1, color: '#8A6F72', textAlign: 'center', lineHeight: 20, marginTop: spacing(2) },
  button: { alignSelf: 'stretch', marginTop: spacing(5) },
  done: { marginTop: spacing(4) },
  doneText: { color: '#7A1F2B', fontWeight: '700', fontSize: font.md },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing(8) },
  messageIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253,224,71,0.12)',
  },
  messageTitle: { color: '#FFFFFF', fontSize: font.xl, fontWeight: '800', marginTop: spacing(5), textAlign: 'center' },
  messageBody: { color: 'rgba(255,255,255,0.72)', fontSize: font.md, textAlign: 'center', lineHeight: 22, marginTop: spacing(2) },
});
