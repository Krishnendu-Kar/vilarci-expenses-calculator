import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { makeStyles } from '../theme/ThemeContext';
import { font, radii, spacing } from '../theme/tokens';

interface Props<K extends string> {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}

export function Segmented<K extends string>({ options, value, onChange }: Props<K>) {
  const styles = useStyles();
  return (
    <View style={styles.track}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.seg, active && styles.segActive]}>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1} adjustsFontSizeToFit>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  track: {
    flexDirection: 'row',
    backgroundColor: c.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing(1),
  },
  seg: { flex: 1, paddingVertical: spacing(2.5), paddingHorizontal: spacing(0.5), borderRadius: radii.sm, alignItems: 'center' },
  segActive: {
    backgroundColor: c.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: { fontSize: font.sm + 1, fontWeight: '600', color: c.textSecondary },
  labelActive: { color: c.tint },
}));
