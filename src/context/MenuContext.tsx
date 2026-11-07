import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { font, radii, spacing } from '../theme/tokens';
import type { IconName } from '../data/categories';

// The ⋮ menu: a small card that opens right at the dots (or where the row was
// long-pressed), like WhatsApp's, instead of a sheet sliding up. It lives
// above the navigator so it can sit over the header and the tab bar too.

export interface MenuItem {
  key: string;
  icon: IconName;
  title: string;
  /** Red, for things like Delete. */
  danger?: boolean;
  /** Picking it swaps the menu to these (Pin → for how long). */
  children?: MenuItem[];
}

/** Where to open, in page coordinates: a view's box, or a point (width/height 0). */
export interface MenuAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MenuValue {
  openMenu: (anchor: MenuAnchor, items: MenuItem[], onPick: (key: string) => void) => void;
}

const MenuContext = createContext<MenuValue>({ openMenu: () => {} });

const ITEM_H = 48;
const HEAD_H = 40;
const PAD = spacing(1.5);
const EDGE = spacing(2);

interface Open {
  id: number;
  anchor: MenuAnchor;
  items: MenuItem[];
  onPick: (key: string) => void;
}

let seq = 0;

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<Open | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const openMenu = useCallback((anchor: MenuAnchor, items: MenuItem[], onPick: (key: string) => void) => {
    setMenu({ id: ++seq, anchor, items, onPick });
  }, []);
  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [menu, close]);

  const value = useMemo(() => ({ openMenu }), [openMenu]);

  return (
    <MenuContext.Provider value={value}>
      {children}
      {/* Always mounted, so the card can fade out when it closes. */}
      <View
        pointerEvents="box-none"
        style={StyleSheet.absoluteFill}
        onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        {menu ? <Pressable style={StyleSheet.absoluteFill} onPress={close} /> : null}
        {menu ? (
          <Card
            key={menu.id}
            menu={menu}
            screen={size}
            onPick={(key) => {
              close();
              menu.onPick(key);
            }}
          />
        ) : null}
      </View>
    </MenuContext.Provider>
  );
}

export function useMenu() {
  return useContext(MenuContext);
}

function Card({ menu, screen, onPick }: { menu: Open; screen: { width: number; height: number }; onPick: (key: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [sub, setSub] = useState<MenuItem | null>(null);
  const shown = sub?.children ?? menu.items;

  // Placed once, for its tallest page, so opening a sub-list never makes it jump.
  const place = useMemo((): { box: ViewStyle; origin: string } => {
    const { anchor } = menu;
    const rows = Math.max(menu.items.length, ...menu.items.map((i) => (i.children ? i.children.length : 0)));
    const tall = rows * ITEM_H + PAD * 2 + (menu.items.some((i) => i.children) ? HEAD_H : 0);
    const fitsBelow = anchor.y + tall <= screen.height - insets.bottom - EDGE;
    const onRight = anchor.x + anchor.width / 2 > screen.width / 2;
    return {
      box: {
        ...(fitsBelow
          ? { top: Math.max(insets.top + EDGE, anchor.y) }
          : { bottom: Math.max(insets.bottom + EDGE, screen.height - (anchor.y + anchor.height)) }),
        ...(onRight
          ? { right: Math.max(EDGE, screen.width - (anchor.x + anchor.width)) }
          : { left: Math.max(EDGE, anchor.x) }),
        maxWidth: screen.width - EDGE * 2,
      },
      // It grows out of the corner nearest the dots.
      origin: `${fitsBelow ? 'top' : 'bottom'} ${onRight ? 'right' : 'left'}`,
    };
  }, [menu, screen, insets]);

  const shownAt = useSharedValue(0);
  useEffect(() => {
    shownAt.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) });
  }, [shownAt]);
  const grow = useAnimatedStyle(() => ({
    opacity: shownAt.value,
    transform: [{ scale: 0.85 + 0.15 * shownAt.value }],
  }));

  return (
    <Animated.View exiting={FadeOut.duration(100)} style={[styles.card, place.box, { transformOrigin: place.origin }, grow]}>
      <View style={styles.clip}>
        {sub ? (
          <Pressable onPress={() => setSub(null)} style={({ pressed }) => [styles.head, pressed && styles.pressed]} hitSlop={4}>
            <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
            <Text style={styles.headText} numberOfLines={1}>
              {sub.title}
            </Text>
          </Pressable>
        ) : null}
        {shown.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => (item.children ? setSub(item) : onPick(item.key))}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            accessibilityRole="menuitem"
          >
            <Ionicons name={item.icon} size={20} color={item.danger ? colors.danger : colors.textSecondary} />
            <Text style={[styles.title, item.danger && styles.danger]} numberOfLines={1}>
              {item.title}
            </Text>
            {item.children ? <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} /> : null}
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    position: 'absolute',
    minWidth: 190,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  clip: { borderRadius: radii.md, overflow: 'hidden', paddingVertical: PAD },
  head: {
    height: HEAD_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    paddingHorizontal: spacing(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  headText: { flexShrink: 1, fontSize: font.sm, fontWeight: '700', color: c.textSecondary },
  item: {
    height: ITEM_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingLeft: spacing(4),
    paddingRight: spacing(5),
  },
  pressed: { backgroundColor: c.surfaceAlt },
  title: { flexShrink: 1, fontSize: font.md, fontWeight: '500', color: c.textPrimary },
  danger: { color: c.danger },
}));
