import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { avatarColors } from '../theme/colors';
import { initials } from '../lib/format';

function tintFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return avatarColors[h % avatarColors.length];
}

export function Avatar({ name: shown, size = 36 }: { name: string; size?: number }) {
  // "~Sayan Sen" (an account you haven't saved) has the same face as "Sayan Sen".
  const name = shown.replace(/^~/, '');
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: tintFor(name) }]}>
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
    </View>
  );
}

// The tints are the same in both themes and all dark enough for white initials.
const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#FFFFFF', fontWeight: '700' },
});
