# Vilarci E-Split

Split shared expenses in a group (trip friends, hostel mess, flatmates) and see who pays whom at the end.
Android app on Google Play (`in.vilarci.expensesplit`, version **2.3.0** / versionCode 8 live).
Website: https://esplit.vilarci.in (separate repo, `vilarci-expenses-calculator-web`).

## Features

- **Groups** for trips, hostels and flats, kept **on this phone** or put **online** (a live group: everyone in it sees the same expenses on their own phone). Invite by link, QR code or an 8-letter code; admins, roles, approval for new members, and an **Activity** log of who changed what.
- **Accounts** (email or Google) for live groups. Groups on this phone need no account.
- **Expenses** with a date, category and optional note.
  - **More than one payer:** "A paid ₹2000 and B paid ₹1000 for dinner"; the total adds itself up.
  - **Split equally** among everyone or only some people, or **by exact amounts, shares or percentages.**
  - **Nobody is picked as the payer** until you choose, so nobody gets charged by mistake.
  - **Paste from chat:** paste a group-chat message, tap Convert, and every amount is read and previewed.
  - **Every expense has its own page** with who paid and each person's part. Everyone in the group can read it; the pencil at the top right edits it, when you may.
  - **Share an expense** (⋮ → Share) as a chat message. From a live group it carries a link (`esplit.vilarci.in/e/…`) that opens the expense in the app for people in the group.
- **Hostel / Flat groups:** open on this month with all-time balances, a month and category filter, and a "counts for" month on each expense.
- **Members, Settle up and Stats:** balances, the fewest payments that even everyone out (tap **Paid**, with undo), **Pay by UPI**, **Remind** a friend who owes you, and where the money went.
- **Push notifications** for live groups (expenses with your share, payments, reminders, members, join requests, updates from Vilarci), each kind on or off, mute a group.
- **Group lock** with the phone's fingerprint or screen lock (locked groups stay off Home), and **UPI ids** in your Profile.
- **Search** expenses (by item, person or amount), members and people.
- **Home:** filters, pin a group, archive finished groups, and a **Bin** that keeps deleted groups for 30 days.
- **Balances and Profile:** everyone from all your groups (saved names like WhatsApp's `~Name`), and your own balance across every group.
- **Send to someone without the app:** a PDF report, a WhatsApp-ready message, or a group file (groups on this phone).
- **Backup & restore:** Google Drive (now, daily or weekly; a new phone offers to restore), and Export / Import a `.json` file with a preview.
- **Dark mode** and **English, हिन्दी, বাংলা, தமிழ்**. **Undo** after deletes. Old versions are told to update.

Everything is stored on the phone in SQLite (`expo-sqlite`, tables in `src/lib/db/schema.ts`), with UUIDs for every id, so the app works offline.
Live groups sync through Supabase (Postgres with row-level security): changes wait in an outbox while offline and go up when the phone is back online.

## Run

```bash
npm install
npm start          # scan the QR code with Expo Go (SDK 58)
npm run web        # or open it in the browser
npm test           # unit tests: money maths, split, sync, permissions, links, reports, migration, backup, translations…
npm run typecheck
```

Push notifications, Google sign-in, Drive and App Links need a store or dev build (not Expo Go).
A store build: `npx expo prebuild -p android --clean` when native settings change (then put the `android`/`ios`
npm scripts back to `expo start --android/--ios`), then `gradlew bundleRelease` in `android/`, signed by
`plugins/withReleaseSigning.js`.

## Layout

```
App.tsx                         providers (theme, language, update gate, data, lock, auth, undo, sync, news, push, menus) + navigator
app.json / app.config.js        Expo config (version, App Links for /join/ and /e/); adds google-services.json when present
plugins/                        release signing, optional hardware features (more devices on Play)
src/types.ts                    Group / Member / Expense / Payment (money in paise)
src/lib/split.ts                shares, balances, settle-up, stats
src/lib/permissions.ts          who may do what in a live group (same rules as the server)
src/lib/sync/                   the sync engine: outbox, push + pull, merge
src/lib/api/                    Supabase calls: accounts, groups, sync, push, news, release, UPI
src/lib/invite.ts               invite links and codes (esplit.vilarci.in/join/CODE)
src/lib/expenseLink.ts          shared expense links (esplit.vilarci.in/e/<group>/<expense>)
src/lib/people.ts               the People directory and the names this phone shows
src/lib/months.ts               expense month, month/category filter
src/lib/report.ts               text and PDF (HTML) reports, one expense as a message
src/lib/files.ts                share sheet, PDF, file picker (native + web)
src/lib/backup.ts, drive.ts     backup file format, import preview and merge; Google Drive
src/lib/migrate.ts              validates + upgrades stored and imported data
src/lib/storage.ts, db/         saving and loading: SQLite tables, groups ↔ rows
src/context/                    Groups, Sync, Auth, Push, News, Lock, Menu, Undo
src/navigation/                 stack + bottom tabs, deep links (join and shared expenses)
src/i18n/                       translations (en, hi, bn, ta)
src/theme/                      light/dark palettes and makeStyles
src/screens/                    Home, Balances, Profile, groups, expenses, settings pages
src/components/                 shared UI
```

## Notes

- Money is stored as whole paise, so splits always add up exactly. Leftover paise go to the first people in the list, and balances under ₹1 count as settled.
- A backup file can be imported into a newer version of the app. Anything broken in a file is skipped and reported, never half-loaded.
- The server's source (`supabase/`) and the working notes (`PIPELINE.md`, `WORKFLOW.md`, `CONTEXT.md`, `onlinedb.md`) are kept out of git.
