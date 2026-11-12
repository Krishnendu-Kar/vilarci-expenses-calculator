import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Avatar } from '../../components/Avatar';
import { Chip } from '../../components/Chip';
import { DateField } from '../../components/DateField';
import { DISPLAY_FONT } from '../../components/LuxeCard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useGroups } from '../../context/GroupsContext';
import {
  buildQuickExpenses,
  isMeAlias,
  matchMember,
  parseQuickAdd,
  resolveDrafts,
  rowProblem,
  type Draft,
  type QuickRow,
} from '../../lib/quickAdd';
import { resolveMe } from '../../lib/people';
import type { ManyForm } from '../../lib/drafts';
import { money } from '../../lib/money';
import { todayISO } from '../../lib/format';
import { joinNames } from '../../lib/describe';
import { newId } from '../../lib/id';
import { categoryOf, type IconName } from '../../data/categories';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { font, radii, spacing } from '../../theme/tokens';
import type { Key } from '../../i18n';
import type { CategoryKey, Group, Member } from '../../types';
import { CategoryTiles } from './CategoryTiles';
import { FormSection } from './FormSection';

interface Props {
  group: Group;
  initial?: ManyForm;
  /** After Convert: the preview, names and "Add N expenses" show, and the page hides the one-expense form. */
  converted: boolean;
  onConvert: () => void;
  /** The text was cleared: back to the one-expense form. */
  onClear: () => void;
  onChange: (form: ManyForm) => void;
  onDone: () => void;
}

const HELP: [string, Key][] = [
  ['Krish - 48, 80, 180(3)', 'quick.help1'],
  ['Krish 50+50+Sayak 60', 'quick.help2'],
  ['Krish+Tamal food 50 I paid', 'quick.help3'],
  ['Sayak roll 40 and Krish 24 ami pabo', 'quick.help4'],
];

/** Same draft → same key while the text around it changes. */
function rowKeys(drafts: Draft[]) {
  const seen: Record<number, number> = {};
  return drafts.map((d) => {
    const pos = (seen[d.line] = (seen[d.line] ?? -1) + 1);
    return `${d.line}:${pos}:${d.amount}`;
  });
}

const capitalize = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/**
 * "Paste from chat" on the Add expense page: paste a list from a group chat,
 * tap Convert, check the expenses it found, add them all at once.
 */
export function QuickAddPanel({ group, initial, converted, onConvert, onClear, onChange, onDone }: Props) {
  const { addExpenses, people, profile, meMap, setMe } = useGroups();
  const styles = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useI18n();
  const members = group.members;
  const [text, setText] = useState(initial?.text ?? '');
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [category, setCategory] = useState<CategoryKey>(initial?.category ?? 'food');
  /** Typed name (lower-cased) → a member's id, someone from your other groups, or "new". */
  const [names, setNames] = useState<ManyForm['names']>(initial?.names ?? {});
  const [fixes, setFixes] = useState<ManyForm['rows']>(initial?.rows ?? {});
  // "Me" is whoever you picked before, or your profile's person in this group.
  const [meId, setMeId] = useState<string | null>(() => resolveMe(group, profile, meMap[group.id]));
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [openName, setOpenName] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  // Convert was tapped on this text but found nothing to add.
  const [tried, setTried] = useState(false);

  useEffect(() => {
    onChange({ text, date, category, names, rows: fixes });
  }, [text, date, category, names, fixes, onChange]);

  // Emptying the box after converting goes back to the one-expense form.
  useEffect(() => {
    if (converted && !text.trim()) onClear();
  }, [converted, text, onClear]);

  // People from your other groups who aren't in this one.
  const outsiders = useMemo(() => people.filter((p) => !members.some((m) => m.id === p.id)), [people, members]);

  // The preview trails the typing slightly, so the text box never lags or
  // drops letters while a long list is being re-read.
  const readText = useDeferredValue(text);
  const { drafts, errors } = useMemo(() => parseQuickAdd(readText, members), [readText, members]);
  const keys = useMemo(() => rowKeys(drafts), [drafts]);

  // Every name typed, once, as first written.
  const typed = useMemo(() => {
    const out = new Map<string, string>();
    for (const d of drafts)
      for (const n of [d.payer, ...(d.forNames ?? [])])
        if (n && !out.has(n.toLowerCase())) out.set(n.toLowerCase(), n);
    return out;
  }, [drafts]);
  const usesMe = [...typed.keys()].some(isMeAlias);
  const others = [...typed.entries()].filter(([k]) => !isMeAlias(k));

  // Joining the group with this: brand-new people, or people from your other groups.
  const joining = new Map<string, Member>();
  for (const [k, n] of others) {
    if (names[k] === 'new') joining.set(`new:${k}`, { id: `new:${k}`, name: capitalize(n) });
    const known = outsiders.find((p) => p.id === names[k]);
    if (known) joining.set(known.id, { id: known.id, name: known.name });
  }
  const newMembers = [...joining.values()];
  const everyone = [...members, ...newMembers];
  const nameOf = (id: string) => everyone.find((m) => m.id === id)?.name ?? '?';

  const nameToId: Record<string, string | null> = {};
  for (const [k, n] of typed) {
    if (isMeAlias(k)) nameToId[k] = meId;
    else if (names[k] === 'new') nameToId[k] = `new:${k}`;
    else if (names[k] && everyone.some((m) => m.id === names[k])) nameToId[k] = names[k];
    else nameToId[k] = matchMember(n, members, meId);
  }

  const rows: QuickRow[] = resolveDrafts(drafts, nameToId, categoryOf(category).label).map((r, i) => {
    const fix = fixes[keys[i]];
    if (!fix) return r;
    const valid = (id: string) => everyone.some((m) => m.id === id);
    return {
      ...r,
      ...(fix.payer && valid(fix.payer) ? { payer: fix.payer } : {}),
      ...('among' in fix ? { among: fix.among ? fix.among.filter(valid) : null } : {}),
    };
  });

  const unknownNames = others.filter(([k]) => !nameToId[k]);
  const problems = rows.filter((r) => rowProblem(r)).length;
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const byPayer = new Map<string, number>();
  for (const r of rows) if (r.payer) byPayer.set(r.payer, (byPayer.get(r.payer) ?? 0) + r.amount);
  const ready = rows.length > 0 && problems === 0 && (!usesMe || !!meId);

  const fixRow = (key: string, patch: { payer?: string; among?: string[] | null }) =>
    setFixes((f) => ({ ...f, [key]: { ...f[key], ...patch } }));

  const edit = (v: string) => {
    setText(v);
    setTried(false);
  };

  /** Reads `source` right away (not the trailing preview) and opens the result if it found anything. */
  const convert = (source: string) => {
    Keyboard.dismiss();
    if (parseQuickAdd(source, members).drafts.length === 0) return setTried(true);
    setShowHelp(false);
    onConvert();
  };

  const paste = async () => {
    try {
      const clip = (await Clipboard.getStringAsync()).trim();
      if (!clip) return;
      const next = text.trim() ? `${text.trimEnd()}\n${clip}` : clip;
      edit(next);
      convert(next);
    } catch {
      // Nothing to paste; the box can still be typed in.
    }
  };

  const clear = () => {
    edit('');
    setNames({});
    setFixes({});
    setOpenRow(null);
    setOpenName(null);
    onClear();
  };

  const tryExample = () => {
    const [a, b, c] = [0, 1, 2].map((i) => members[i % members.length]?.name.split(' ')[0] ?? 'Friend');
    const example = `${a} - 48, 80, 180(3), 120\n${b} 290\n${a}+${b} food 50 ami diyachi\n${c} roll 40 and ${a} 24 ami pabo`;
    edit(example);
    convert(example);
  };

  const save = () => {
    const built = buildQuickExpenses(rows, { everyone: everyone.map((m) => m.id), date, category }, newId);
    if (!built || !ready) return;
    // Brand-new people get real ids now; people from other groups keep theirs.
    const real = Object.fromEntries(newMembers.filter((m) => m.id.startsWith('new:')).map((m) => [m.id, newId()]));
    const fix = (id: string) => real[id] ?? id;
    const expenses = built.map((e) => ({
      ...e,
      payers: Object.fromEntries(Object.entries(e.payers).map(([id, v]) => [fix(id), v])),
      splitAmong: e.splitAmong.map(fix),
    }));
    addExpenses(group.id, expenses, newMembers.map((m) => ({ id: fix(m.id), name: m.name })));
    // Remembered for next time, only where it's yours to pick (a live group
    // knows you by your account).
    if (meId && !group.online) setMe(group.id, meId);
    onDone();
  };

  const bubbleText = dark ? '#E9F5EE' : '#0F1B0F';

  return (
    <View>
      <FormSection
        icon="chatbubbles-outline"
        title={t('chat.title')}
        right={
          <Pressable onPress={() => setShowHelp((v) => !v)} hitSlop={10} accessibilityLabel={t('quick.howTo')}>
            <Ionicons name={showHelp ? 'close-circle-outline' : 'help-circle-outline'} size={22} color={colors.tint} />
          </Pressable>
        }
      >
        <Text style={styles.sub}>{t('chat.sub')}</Text>
        {showHelp ? (
          <View style={styles.help}>
            <Text style={styles.helpIntro}>{t('quick.helpIntro')}</Text>
            {HELP.map(([example, meaning]) => (
              <View key={example} style={styles.helpRow}>
                <Text style={styles.code}>{example}</Text>
                <Text style={styles.helpText}>{t(meaning)}</Text>
              </View>
            ))}
            <Text style={styles.helpText}>{t('quick.helpMe')}</Text>
            <Pressable onPress={tryExample} hitSlop={6} style={styles.exampleBtn}>
              <Text style={styles.link}>{t('quick.tryExample')}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Looks like the message it came from. */}
        <TextInput
          style={[styles.bubble, dark && styles.bubbleDark, { color: bubbleText }]}
          value={text}
          onChangeText={edit}
          multiline
          placeholder={'Krish - 48, 80, 64, 180(3)\nTamal - 36, 360\nMe - 60, 48'}
          placeholderTextColor={dark ? 'rgba(233,245,238,0.5)' : 'rgba(15,27,15,0.42)'}
          keyboardAppearance={dark ? 'dark' : 'light'}
          autoCapitalize="words"
          autoCorrect={false}
          textAlignVertical="top"
          accessibilityLabel={t('chat.title')}
        />

        {tried && !converted ? <Text style={styles.nothing}>{t('chat.nothing')}</Text> : null}
        {(converted || tried) && errors.length ? (
          <View style={styles.errors}>
            {errors.map((e, i) => (
              <Text key={i} style={styles.errorText}>
                {t('quick.lineError', { line: e.line, message: e.message })}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.actions}>
          {/* Browsers ask before a page reads the clipboard; paste into the box there. */}
          {Platform.OS !== 'web' ? <GhostButton icon="clipboard-outline" label={t('chat.paste')} onPress={paste} /> : null}
          {text ? <GhostButton icon="close" label={t('chat.clear')} onPress={clear} /> : null}
          <View style={styles.flex} />
          {!converted ? (
            <Pressable
              onPress={() => convert(text)}
              disabled={!text.trim()}
              accessibilityRole="button"
              style={({ pressed }) => [styles.convert, !text.trim() && styles.convertOff, pressed && styles.pressed]}
            >
              <Text style={styles.convertText}>{t('chat.convert')}</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.onPrimary} />
            </Pressable>
          ) : null}
        </View>
      </FormSection>

      {converted ? (
        <>
          {usesMe ? (
            <FormSection icon="person-circle-outline" title={t('quick.whoIsMe')} attention={!meId}>
              <View style={styles.chips}>
                {members.map((m) => (
                  <Chip key={m.id} label={m.name} selected={meId === m.id} onPress={() => setMeId(m.id)} />
                ))}
              </View>
            </FormSection>
          ) : null}

          {others.length ? (
            <FormSection icon="people-outline" title={t('quick.names')} attention={unknownNames.length > 0}>
              {others.map(([k, n], i) => {
                const id = nameToId[k];
                const editing = openName === k || !id;
                const knownId = matchMember(n, outsiders);
                const known = knownId ? outsiders.find((p) => p.id === knownId) : undefined;
                return (
                  <View key={k} style={[styles.nameRow, i > 0 && styles.line]}>
                    <Pressable onPress={() => setOpenName(openName === k ? null : k)} style={styles.nameHead}>
                      <Text style={styles.nameTyped}>{n}</Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
                      {id ? <Avatar name={nameOf(id)} size={22} /> : null}
                      <Text style={[styles.nameMatched, !id && styles.problem]}>
                        {id
                          ? names[k] === 'new' || joining.has(id)
                            ? t('quick.newTag', { name: nameOf(id) })
                            : nameOf(id)
                          : t('quick.whoIsThis')}
                      </Text>
                    </Pressable>
                    {editing ? (
                      <View style={styles.chips}>
                        {members.map((m) => (
                          <Chip
                            key={m.id}
                            label={m.name}
                            selected={id === m.id}
                            onPress={() => {
                              setNames((s) => ({ ...s, [k]: m.id }));
                              setOpenName(null);
                            }}
                          />
                        ))}
                        {known ? (
                          <Chip
                            label={t('quick.addKnown', { name: known.name })}
                            icon="people-outline"
                            selected={names[k] === known.id}
                            onPress={() => {
                              setNames((s) => ({ ...s, [k]: known.id }));
                              setOpenName(null);
                            }}
                          />
                        ) : null}
                        <Chip
                          label={t('quick.addNew', { name: capitalize(n) })}
                          icon="person-add-outline"
                          selected={names[k] === 'new'}
                          onPress={() => {
                            setNames((s) => ({ ...s, [k]: 'new' }));
                            setOpenName(null);
                          }}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </FormSection>
          ) : null}

          {rows.length ? (
            <View style={styles.preview}>
              <View style={styles.previewHead}>
                <View style={styles.flex}>
                  <Text style={styles.previewCount}>{t('chat.count', { count: rows.length })}</Text>
                  <Text style={styles.previewHint}>{t('chat.tapHint')}</Text>
                </View>
                <Text style={styles.previewTotal} numberOfLines={1} adjustsFontSizeToFit>
                  {money(total)}
                </Text>
              </View>
              {rows.map((r, i) => {
                const key = keys[i];
                const problem = rowProblem(r);
                const open = openRow === key;
                const forText =
                  r.among === null ? t('quick.forEveryone') : r.among.length ? joinNames(r.among.map(nameOf)) : t('quick.forNobody');
                return (
                  <View key={key} style={[i > 0 && styles.line, problem && styles.rowAsk]}>
                    <Pressable onPress={() => setOpenRow(open ? null : key)} style={styles.rowHead}>
                      {r.payer ? (
                        <Avatar name={nameOf(r.payer)} size={30} />
                      ) : (
                        <View style={styles.askIcon}>
                          <Ionicons name="help" size={16} color={colors.danger} />
                        </View>
                      )}
                      <View style={styles.flex}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {r.title}
                        </Text>
                        <Text style={[styles.rowMeta, problem && styles.problem]} numberOfLines={2}>
                          {problem ?? t('quick.rowMeta', { payer: nameOf(r.payer!), for: forText })}
                        </Text>
                      </View>
                      <Text style={styles.rowAmount}>{money(r.amount)}</Text>
                      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
                    </Pressable>
                    {open ? (
                      <View style={styles.editor}>
                        <Text style={styles.editorLabel}>{t('quick.paidBy')}</Text>
                        <View style={styles.chips}>
                          {everyone.map((m) => (
                            <Chip key={m.id} label={m.name} selected={r.payer === m.id} onPress={() => fixRow(key, { payer: m.id })} />
                          ))}
                        </View>
                        <Text style={styles.editorLabel}>{r.needCount ? t('quick.forPick', { count: r.needCount }) : t('quick.for')}</Text>
                        <View style={styles.chips}>
                          {!r.needCount ? (
                            <Chip label={t('quick.everyone')} selected={r.among === null} onPress={() => fixRow(key, { among: null })} />
                          ) : null}
                          {everyone.map((m) => {
                            const on = r.among?.includes(m.id) ?? false;
                            return (
                              <Chip
                                key={m.id}
                                label={m.name}
                                selected={on}
                                onPress={() => {
                                  const cur = r.among ?? [];
                                  const next = on ? cur.filter((x) => x !== m.id) : [...cur, m.id];
                                  fixRow(key, { among: next });
                                }}
                              />
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {byPayer.size ? (
                <View style={styles.previewFoot}>
                  {[...byPayer.entries()].map(([id, amt]) => (
                    <View key={id} style={styles.footLine}>
                      <Text style={styles.footName}>{t('quick.paidSummary', { name: nameOf(id) })}</Text>
                      <Text style={styles.footAmt}>{money(amt)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          <FormSection icon="calendar-outline" title={t('chat.forAll')}>
            <DateField value={date} onChange={setDate} />
            <View style={styles.tiles}>
              <CategoryTiles value={category} onChange={setCategory} />
            </View>
          </FormSection>

          {!ready && rows.length ? (
            <Text style={styles.blocker}>
              {usesMe && !meId
                ? t('quick.pickMe')
                : unknownNames.length
                  ? t('quick.tellWho', {
                      count: unknownNames.length,
                      names: joinNames(unknownNames.map(([, n]) => `"${n}"`)),
                    })
                  : t('quick.needAnswer', { count: problems })}
            </Text>
          ) : null}
          {rows.length ? (
            <PrimaryButton label={t('quick.addButton', { count: rows.length })} onPress={save} disabled={!ready} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function GhostButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}>
      <Ionicons name={icon} size={15} color={colors.tint} />
      <Text style={styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  sub: { fontSize: font.sm, color: c.textSecondary, lineHeight: 18, marginTop: -spacing(1.5), marginBottom: spacing(3) },
  link: { color: c.tint, fontWeight: '700', fontSize: font.sm + 1 },
  help: {
    backgroundColor: c.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing(3.5),
    marginBottom: spacing(3),
    gap: spacing(2),
  },
  helpIntro: { fontSize: font.sm + 1, color: c.textPrimary, lineHeight: 19 },
  helpRow: { gap: 2 },
  code: {
    fontFamily: 'monospace',
    fontSize: font.sm,
    color: c.textPrimary,
    backgroundColor: c.surface,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: 4,
  },
  helpText: { fontSize: font.sm, color: c.textSecondary, lineHeight: 17 },
  exampleBtn: { alignSelf: 'flex-start', marginTop: spacing(1) },
  // A chat bubble: the same greens as the website's.
  bubble: {
    minHeight: 96,
    backgroundColor: '#DCF8C6',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: spacing(3.5),
    paddingTop: spacing(3),
    paddingBottom: spacing(3),
    fontSize: font.md,
    lineHeight: 22,
  },
  bubbleDark: { backgroundColor: '#144D37' },
  nothing: { fontSize: font.sm + 1, color: c.danger, fontWeight: '600', marginTop: spacing(2.5) },
  errors: { backgroundColor: c.dangerBg, borderRadius: radii.md, padding: spacing(3), gap: spacing(1), marginTop: spacing(2.5) },
  errorText: { fontSize: font.sm, color: c.danger },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginTop: spacing(3) },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  ghostText: { color: c.tint, fontWeight: '700', fontSize: font.sm },
  convert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    backgroundColor: c.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(4.5),
    paddingVertical: spacing(2.5),
    shadowColor: c.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  convertOff: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  convertText: { color: c.onPrimary, fontWeight: '800', fontSize: font.md, letterSpacing: 0.3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  nameRow: { paddingVertical: spacing(2.5), gap: spacing(2) },
  nameHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  nameTyped: { fontSize: font.md, color: c.textSecondary },
  nameMatched: { fontSize: font.md, fontWeight: '700', color: c.textPrimary, flexShrink: 1 },
  problem: { color: c.danger },
  // Like the website's preview: a header-coloured top with the count and total.
  preview: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
    marginBottom: spacing(4),
  },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: c.header,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3.5),
  },
  previewCount: { color: c.white, fontSize: font.md, fontWeight: '800' },
  previewHint: { color: c.white, opacity: 0.72, fontSize: font.xs + 1, marginTop: 2 },
  previewTotal: { color: c.white, fontFamily: DISPLAY_FONT, fontSize: 28, maxWidth: '50%' },
  rowAsk: { backgroundColor: c.dangerBg },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingHorizontal: spacing(4), paddingVertical: spacing(3) },
  askIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: c.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: font.md, fontWeight: '700', color: c.textPrimary },
  rowMeta: { fontSize: font.sm, color: c.textSecondary, marginTop: 2 },
  rowAmount: { fontSize: font.md + 1, fontWeight: '800', color: c.textPrimary, fontVariant: ['tabular-nums'] },
  editor: { paddingHorizontal: spacing(4), paddingBottom: spacing(3.5), gap: spacing(2) },
  editorLabel: { fontSize: font.xs + 1, fontWeight: '700', color: c.textSecondary, textTransform: 'uppercase', marginTop: spacing(1) },
  previewFoot: { backgroundColor: c.surfaceAlt, paddingHorizontal: spacing(4), paddingVertical: spacing(3), gap: spacing(1.5) },
  footLine: { flexDirection: 'row', justifyContent: 'space-between' },
  footName: { fontSize: font.sm + 1, color: c.textSecondary },
  footAmt: { fontSize: font.sm + 1, fontWeight: '700', color: c.textPrimary, fontVariant: ['tabular-nums'] },
  tiles: { marginTop: spacing(4) },
  blocker: { fontSize: font.sm + 1, color: c.danger, fontWeight: '600', marginBottom: spacing(3) },
}));
