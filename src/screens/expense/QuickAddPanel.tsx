import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '../../components/Chip';
import { DateField } from '../../components/DateField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SectionLabel } from '../../components/SectionLabel';
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
import { getMe, setMe, type ManyForm } from '../../lib/drafts';
import { money } from '../../lib/money';
import { plural, todayISO } from '../../lib/format';
import { joinNames } from '../../lib/describe';
import { newId } from '../../lib/id';
import { CATEGORIES, categoryOf } from '../../data/categories';
import { colors } from '../../theme/colors';
import { font, radii, spacing } from '../../theme/tokens';
import type { CategoryKey, Group, Member } from '../../types';

interface Props {
  group: Group;
  initial?: ManyForm;
  onChange: (form: ManyForm) => void;
  onDone: () => void;
}

const HELP: [string, string][] = [
  ['Krish - 48, 80, 180(3)', 'Krish paid each amount for everyone. (3) = only 3 people shared it.'],
  ['Krish 50+50+Sayak 60', 'Several people on one line.'],
  ['Krish+Tamal food 50 I paid', 'You paid for just those two. "ami diyachi" works too.'],
  ['Sayak roll 40 and Krish 24 ami pabo', 'Each of them owes you their own amount.'],
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

export function QuickAddPanel({ group, initial, onChange, onDone }: Props) {
  const { addExpenses } = useGroups();
  const members = group.members;
  const [text, setText] = useState(initial?.text ?? '');
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [category, setCategory] = useState<CategoryKey>(initial?.category ?? 'food');
  const [names, setNames] = useState<ManyForm['names']>(initial?.names ?? {});
  const [fixes, setFixes] = useState<ManyForm['rows']>(initial?.rows ?? {});
  const [meId, setMeId] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [openName, setOpenName] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(!initial?.text);

  useEffect(() => {
    getMe(group.id)
      .then((id) => id && members.some((m) => m.id === id) && setMeId(id))
      .catch(() => {});
  }, [group.id, members]);

  useEffect(() => {
    onChange({ text, date, category, names, rows: fixes });
  }, [text, date, category, names, fixes, onChange]);

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

  const newMembers: Member[] = [...typed.entries()]
    .filter(([k]) => names[k] === 'new' && !isMeAlias(k))
    .map(([k, n]) => ({ id: `new:${k}`, name: capitalize(n) }));
  const everyone = [...members, ...newMembers];
  const nameOf = (id: string) => everyone.find((m) => m.id === id)?.name ?? '?';

  const nameToId: Record<string, string | null> = {};
  for (const [k, n] of typed) {
    if (isMeAlias(k)) nameToId[k] = meId;
    else if (names[k] === 'new') nameToId[k] = `new:${k}`;
    else if (names[k] && members.some((m) => m.id === names[k])) nameToId[k] = names[k];
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

  const unknownNames = [...typed.entries()].filter(([k]) => !isMeAlias(k) && !nameToId[k]);
  const problems = rows.filter((r) => rowProblem(r)).length;
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const byPayer = new Map<string, number>();
  for (const r of rows) if (r.payer) byPayer.set(r.payer, (byPayer.get(r.payer) ?? 0) + r.amount);
  const ready = rows.length > 0 && problems === 0 && (!usesMe || !!meId);

  const fixRow = (key: string, patch: { payer?: string; among?: string[] | null }) =>
    setFixes((f) => ({ ...f, [key]: { ...f[key], ...patch } }));

  const tryExample = () => {
    const [a, b, c] = [0, 1, 2].map((i) => members[i % members.length]?.name.split(' ')[0] ?? 'Friend');
    setText(`${a} - 48, 80, 180(3), 120\n${b} 290\n${a}+${b} food 50 ami diyachi\n${c} roll 40 and ${a} 24 ami pabo`);
    setShowHelp(false);
  };

  const save = () => {
    const built = buildQuickExpenses(rows, { everyone: everyone.map((m) => m.id), date, category }, newId);
    if (!built || (usesMe && !meId)) return;
    const real = Object.fromEntries(newMembers.map((m) => [m.id, newId()]));
    const fix = (id: string) => real[id] ?? id;
    const expenses = built.map((e) => ({
      ...e,
      payers: Object.fromEntries(Object.entries(e.payers).map(([id, v]) => [fix(id), v])),
      splitAmong: e.splitAmong.map(fix),
    }));
    addExpenses(group.id, expenses, newMembers.map((m) => ({ id: real[m.id], name: m.name })));
    if (meId) setMe(group.id, meId).catch(() => {});
    onDone();
  };

  return (
    <View>
      <Pressable onPress={() => setShowHelp((v) => !v)} style={styles.helpHead} hitSlop={6}>
        <Ionicons name="help-circle-outline" size={18} color={colors.primary} />
        <Text style={styles.link}>How to write it</Text>
        <Ionicons name={showHelp ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
      </Pressable>
      {showHelp ? (
        <View style={styles.help}>
          <Text style={styles.helpIntro}>
            Paste a message from your group chat, or type one line per person. Nobody needs to know the total. The app
            adds it all up.
          </Text>
          {HELP.map(([example, meaning]) => (
            <View key={example} style={styles.helpRow}>
              <Text style={styles.code}>{example}</Text>
              <Text style={styles.helpText}>{meaning}</Text>
            </View>
          ))}
          <Text style={styles.helpText}>"Me", "I", "ami", "amar" mean you. Write 1200, not 1,200.</Text>
          <Pressable onPress={tryExample} hitSlop={6} style={styles.exampleBtn}>
            <Text style={styles.link}>Try an example</Text>
          </Pressable>
        </View>
      ) : null}

      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        multiline
        placeholder={'Krish - 48, 80, 64, 180(3)\nTamal - 36, 360\nMe - 60, 48'}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="words"
        autoCorrect={false}
        textAlignVertical="top"
      />

      {errors.length ? (
        <View style={styles.errors}>
          {errors.map((e, i) => (
            <Text key={i} style={styles.errorText}>
              Line {e.line}: {e.message}
            </Text>
          ))}
        </View>
      ) : null}

      {usesMe ? (
        <View style={[styles.card, !meId && styles.cardAttention]}>
          <Text style={styles.cardTitle}>Who is "me"?</Text>
          <View style={styles.chips}>
            {members.map((m) => (
              <Chip key={m.id} label={m.name} selected={meId === m.id} onPress={() => setMeId(m.id)} />
            ))}
          </View>
        </View>
      ) : null}

      {typed.size ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Names</Text>
          {[...typed.entries()]
            .filter(([k]) => !isMeAlias(k))
            .map(([k, n]) => {
              const id = nameToId[k];
              const editing = openName === k || !id;
              return (
                <View key={k} style={styles.nameRow}>
                  <Pressable onPress={() => setOpenName(openName === k ? null : k)} style={styles.nameHead}>
                    <Text style={styles.nameTyped}>{n}</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
                    <Text style={[styles.nameMatched, !id && styles.problem]}>
                      {id ? (names[k] === 'new' ? `${capitalize(n)} (new)` : nameOf(id)) : 'Who is this?'}
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
                      <Chip
                        label={`Add "${capitalize(n)}"`}
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
        </View>
      ) : null}

      <SectionLabel>Date</SectionLabel>
      <DateField value={date} onChange={setDate} />
      <SectionLabel>Category</SectionLabel>
      <View style={[styles.chips, styles.gapBelow]}>
        {CATEGORIES.map((c) => (
          <Chip key={c.key} label={c.label} icon={c.icon} selected={category === c.key} onPress={() => setCategory(c.key)} />
        ))}
      </View>

      {rows.length ? (
        <>
          <SectionLabel>
            {plural(rows.length, 'expense')} · tap one to change it
          </SectionLabel>
          {rows.map((r, i) => {
            const key = keys[i];
            const problem = rowProblem(r);
            const open = openRow === key;
            const forText = r.among === null ? 'everyone' : r.among.length ? joinNames(r.among.map(nameOf)) : 'nobody yet';
            return (
              <View key={key} style={[styles.row, problem && styles.rowProblem]}>
                <Pressable onPress={() => setOpenRow(open ? null : key)} style={styles.rowHead}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {r.title}
                    </Text>
                    <Text style={[styles.rowMeta, problem && styles.problem]} numberOfLines={2}>
                      {problem ?? `${nameOf(r.payer!)} paid · for ${forText}`}
                    </Text>
                  </View>
                  <Text style={styles.rowAmount}>{money(r.amount)}</Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
                </Pressable>
                {open ? (
                  <View style={styles.editor}>
                    <Text style={styles.editorLabel}>Paid by</Text>
                    <View style={styles.chips}>
                      {everyone.map((m) => (
                        <Chip key={m.id} label={m.name} selected={r.payer === m.id} onPress={() => fixRow(key, { payer: m.id })} />
                      ))}
                    </View>
                    <Text style={styles.editorLabel}>
                      For{r.needCount ? ` (pick ${r.needCount})` : ''}
                    </Text>
                    <View style={styles.chips}>
                      {!r.needCount ? (
                        <Chip label="Everyone" selected={r.among === null} onPress={() => fixRow(key, { among: null })} />
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

          <View style={styles.summary}>
            <View style={styles.summaryTop}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryTotal}>{money(total)}</Text>
            </View>
            {[...byPayer.entries()].map(([id, amt]) => (
              <View key={id} style={styles.summaryLine}>
                <Text style={styles.summaryName}>{nameOf(id)} paid</Text>
                <Text style={styles.summaryAmt}>{money(amt)}</Text>
              </View>
            ))}
          </View>

          {!ready ? (
            <Text style={styles.blocker}>
              {usesMe && !meId
                ? 'Pick who "me" is above.'
                : unknownNames.length
                  ? `Tell the app who ${joinNames(unknownNames.map(([, n]) => `"${n}"`))} ${unknownNames.length === 1 ? 'is' : 'are'}.`
                  : `${plural(problems, 'expense')} still need${problems === 1 ? 's' : ''} an answer (in red).`}
            </Text>
          ) : null}
          <PrimaryButton
            label={`Add ${plural(rows.length, 'expense')}`}
            onPress={save}
            disabled={!ready}
            style={styles.saveBtn}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  helpHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), marginBottom: spacing(2) },
  link: { color: colors.primary, fontWeight: '700', fontSize: font.sm + 1 },
  help: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing(3.5),
    marginBottom: spacing(3),
    gap: spacing(2),
  },
  helpIntro: { fontSize: font.sm + 1, color: colors.textPrimary, lineHeight: 19 },
  helpRow: { gap: 2 },
  code: {
    fontFamily: 'monospace',
    fontSize: font.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: 4,
  },
  helpText: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 17 },
  exampleBtn: { alignSelf: 'flex-start', marginTop: spacing(1) },
  input: {
    minHeight: 140,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing(3.5),
    fontSize: font.md + 1,
    lineHeight: 22,
    color: colors.textPrimary,
    marginBottom: spacing(3),
  },
  errors: { backgroundColor: colors.dangerBg, borderRadius: radii.md, padding: spacing(3), gap: spacing(1), marginBottom: spacing(3) },
  errorText: { fontSize: font.sm, color: colors.danger },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3.5),
    marginBottom: spacing(4),
  },
  cardAttention: { borderColor: colors.danger },
  cardTitle: { fontSize: font.md, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  gapBelow: { marginBottom: spacing(5) },
  nameRow: { paddingVertical: spacing(2), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: spacing(2) },
  nameHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  nameTyped: { fontSize: font.md, color: colors.textSecondary },
  nameMatched: { fontSize: font.md, fontWeight: '700', color: colors.textPrimary },
  problem: { color: colors.danger },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing(2),
    overflow: 'hidden',
  },
  rowProblem: { borderColor: colors.danger },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5), padding: spacing(3) },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: font.md, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  rowAmount: { fontSize: font.md + 1, fontWeight: '800', color: colors.textPrimary },
  editor: { paddingHorizontal: spacing(3), paddingBottom: spacing(3.5), gap: spacing(2) },
  editorLabel: { fontSize: font.xs + 1, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginTop: spacing(1) },
  summary: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing(4),
    marginTop: spacing(2),
    gap: spacing(1.5),
  },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing(1) },
  summaryLabel: { fontSize: font.md, fontWeight: '700', color: colors.textPrimary },
  summaryTotal: { fontSize: font.xl, fontWeight: '800', color: colors.primary },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryName: { fontSize: font.sm + 1, color: colors.textSecondary },
  summaryAmt: { fontSize: font.sm + 1, fontWeight: '600', color: colors.textPrimary },
  blocker: { fontSize: font.sm + 1, color: colors.danger, fontWeight: '600', marginTop: spacing(3) },
  saveBtn: { marginTop: spacing(3) },
});
