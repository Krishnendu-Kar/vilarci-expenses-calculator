import React, { useRef } from 'react';
import { Pressable, type GestureResponderEvent, type HostInstance, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import type { MenuAnchor } from '../context/MenuContext';

interface Props {
  /** Gets the button's box, for the menu to open at. */
  onOpen: (anchor: MenuAnchor) => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
}

/** The ⋮ button. */
export function MoreButton({ onOpen, size = 18, style, hitSlop = 10 }: Props) {
  const ref = useRef<HostInstance>(null);
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <Pressable
      ref={ref}
      onPress={() => ref.current?.measure((_x, _y, width, height, x, y) => onOpen({ x, y, width, height }))}
      hitSlop={hitSlop}
      style={style}
      accessibilityLabel={t('home.card.more')}
    >
      <Ionicons name="ellipsis-vertical" size={size} color={colors.textSecondary} />
    </Pressable>
  );
}

/** A long-press opens the menu where the finger is. */
export const pressPoint = (e: GestureResponderEvent): MenuAnchor => ({
  x: e.nativeEvent.pageX,
  y: e.nativeEvent.pageY,
  width: 0,
  height: 0,
});
