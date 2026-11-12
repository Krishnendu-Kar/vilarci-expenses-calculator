import { dateLocale, translate, type Key } from '../i18n';
import { money } from './money';
import { groupKindOf, type IconName } from '../data/categories';
import { fromISODate } from './format';
import type { GroupKind } from '../types';

// A live group's Activity (onlinedb.md §18): every change, who made it and
// when, written by the server in the same step as the change, so it can't be
// faked or left out. Stored as data (ids, titles, amounts), so each phone
// writes it in its own language.

export interface ActivityEvent {
  id: string;
  type: string;
  /** The account that made the change (a member id); null for the server itself. */
  actor: string | null;
  data: Record<string, unknown>;
  createdAt: number;
  seq: number;
}

export interface ActivityLine {
  icon: IconName;
  text: string;
  /** What changed, when there's more to say ("₹900 → ₹950"). */
  detail?: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' ? v : 0);
const obj = (v: unknown) => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {});

const SETTING_LABELS: Record<string, Key> = {
  add_expenses: 'gsettings.addExpenses',
  add_guests: 'gsettings.addGuests',
  edit_info: 'gsettings.editInfo',
  require_approval: 'gsettings.approval',
  invite_on: 'gsettings.invite',
};

function settingValue(key: string, v: unknown): string {
  if (key === 'require_approval' || key === 'invite_on') return translate(v ? 'gsettings.on' : 'gsettings.off');
  return translate(v === 'admins' ? 'gsettings.admins' : 'gsettings.everyone');
}

/** "12 Oct" for an expense's date, shown when it isn't from the month the change was made in. */
function shortDate(iso: string) {
  return fromISODate(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
}

/**
 * One Activity entry as a sentence. `nameOf` gives a member's name from
 * their id (names change; the ids in the entry don't).
 */
export function describeEvent(e: ActivityEvent, nameOf: (id: string) => string | undefined): ActivityLine {
  const d = e.data;
  const actor = (e.actor && nameOf(e.actor)) || translate('activity.someone');
  const who = (id: unknown, fallback: unknown) => nameOf(str(id)) || str(fallback) || translate('activity.someone');
  const sameMonth = (iso: string) => !iso || iso.slice(0, 7) === new Date(e.createdAt).toISOString().slice(0, 7);
  const dated = (iso: string) => (sameMonth(iso) ? undefined : translate('activity.dated', { date: shortDate(iso) }));

  switch (e.type) {
    case 'group_online':
      return { icon: 'cloud-upload-outline', text: translate('activity.groupOnline', { actor }) };
    case 'member_joined': {
      const name = who(d.id, d.name);
      // Joined by themselves (the link, QR or code), or let in by an admin.
      return e.actor && e.actor !== str(d.id)
        ? { icon: 'person-add-outline', text: translate('activity.letIn', { actor, name }) }
        : { icon: 'enter-outline', text: translate('activity.joinedLink', { name }) };
    }
    case 'member_left':
      return { icon: 'exit-outline', text: translate('activity.left', { name: who(d.id, d.name) }) };
    case 'member_removed':
      return { icon: 'person-remove-outline', text: translate('activity.removed', { actor, name: who(d.id, d.name) }) };
    case 'group_deleted':
      return { icon: 'trash-outline', text: translate('activity.groupDeleted', { actor }) };
    case 'group_restored':
      return { icon: 'refresh-outline', text: translate('activity.groupRestored', { actor }) };
    case 'guest_added':
      return { icon: 'person-add-outline', text: translate('activity.guestAdded', { actor, name: str(d.name) }) };
    case 'guest_renamed':
      return {
        icon: 'create-outline',
        text: translate('activity.guestRenamed', { actor, before: str(d.before), name: str(d.name) }),
      };
    case 'guest_linked':
      return {
        icon: 'link-outline',
        text: translate('activity.guestLinked', { actor, guest: str(d.guest), name: who(d.id, d.name) }),
      };
    case 'role_changed':
      return d.role === 'admin'
        ? { icon: 'shield-checkmark-outline', text: translate('activity.madeAdmin', { actor, name: who(d.id, d.name) }) }
        : { icon: 'remove-circle-outline', text: translate('activity.dismissedAdmin', { actor, name: who(d.id, d.name) }) };
    case 'expense_added':
      return {
        icon: 'add-circle-outline',
        text: translate(d.restored ? 'activity.expenseRestored' : 'activity.expenseAdded', {
          actor,
          title: str(d.title),
          amount: money(num(d.amount)),
        }),
        detail: dated(str(d.date)),
      };
    case 'expense_edited': {
      const b = obj(d.before);
      const title = str(d.title);
      if (d.archived !== b.archived) {
        return {
          icon: 'archive-outline',
          text: translate(d.archived ? 'activity.expenseArchived' : 'activity.expenseUnarchived', { actor, title }),
        };
      }
      const changes = [
        str(b.title) && str(b.title) !== title ? `"${str(b.title)}" → "${title}"` : '',
        num(b.amount) && num(b.amount) !== num(d.amount) ? `${money(num(b.amount))} → ${money(num(d.amount))}` : '',
        str(b.date) && str(b.date) !== str(d.date) ? `${shortDate(str(b.date))} → ${shortDate(str(d.date))}` : '',
      ].filter(Boolean);
      const when = dated(str(d.date));
      return {
        icon: 'create-outline',
        text: translate('activity.expenseEdited', { actor, title }),
        detail: [changes.length ? changes.join(' · ') : translate('activity.splitChanged'), when].filter(Boolean).join(' · '),
      };
    }
    case 'expense_deleted':
      return {
        icon: 'trash-outline',
        text: translate('activity.expenseDeleted', { actor, title: str(d.title), amount: money(num(d.amount)) }),
        detail: dated(str(d.date)),
      };
    case 'payment_added':
    case 'payment_deleted':
      return {
        icon: e.type === 'payment_added' ? 'swap-horizontal-outline' : 'arrow-undo-outline',
        text: translate(e.type === 'payment_added' ? 'activity.paymentAdded' : 'activity.paymentDeleted', {
          actor,
          from: who(d.from_id, ''),
          to: who(d.to_id, ''),
          amount: money(num(d.amount)),
        }),
      };
    case 'group_renamed':
      return {
        icon: 'create-outline',
        text: translate('activity.renamed', { actor, before: str(obj(d.before).name), name: str(d.name) }),
      };
    case 'settings_changed': {
      const b = obj(d.before);
      // Changing the type comes from the group's own edit; the rest from Group settings.
      if (d.kind !== undefined && b.kind !== d.kind) {
        return {
          icon: 'pricetag-outline',
          text: translate('activity.kindChanged', { actor, kind: groupKindOf(str(d.kind) as GroupKind).label }),
        };
      }
      const changes = Object.keys(SETTING_LABELS)
        .filter((k) => k in d && d[k] !== b[k])
        .map((k) => `${translate(SETTING_LABELS[k])}: ${settingValue(k, d[k])}`);
      return { icon: 'options-outline', text: translate('activity.settingsChanged', { actor }), detail: changes.join(' · ') || undefined };
    }
    default:
      return { icon: 'ellipse-outline', text: translate('activity.other', { actor }) };
  }
}
