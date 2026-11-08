# Vilarci E-Split

Split shared expenses in a group (trip friends, hostel mess, flatmates) and see who pays whom at the end.

## Features

- **Groups** for trips, hostels and flats. People are shared across groups: add someone from your other groups (or yourself) in one tap, and a rename shows up everywhere.
- **Expenses** with a date, category and optional note.
  - **More than one payer:** "A paid ₹2000 and B paid ₹1000 for dinner".
  - **Split equally** among everyone or only some people, or **by exact amounts, shares or percentages.**
  - **Many at once:** paste a group-chat message and every amount is read and previewed.
- **Hostel / Flat groups go month by month:** one month at a time, unpaid amounts carry over, months can be closed, and rent or Wi-Fi can repeat every month.
- **Members, Settle up and Stats:** balances, the fewest payments that even everyone out (tap **Paid**, with undo), and where the money went.
- **Search** expenses (by item, person or amount), members and people.
- **Home:** filters, pin a group (for good or for some days), archive finished groups, and a **Bin** that keeps deleted groups for 30 days.
- **People and Profile pages:** everyone from all your groups, and your own balance across every group.
- **Send to someone without the app:** a PDF report, a WhatsApp-ready message, or a group file for friends who have the app.
- **Backup & restore:** export all data to a `.json` file and import it later with a preview.
- **Dark mode** and **English, हिन्दी, বাংলা, தமிழ்**.
- **Undo** after deletes, and a friendly error screen (with "Export my data") instead of a crash.

v1 stores everything on the device in SQLite (`expo-sqlite`, tables in `src/lib/db/schema.ts`), with UUIDs for every id. v2 will add a server database: swap out `src/lib/storage.ts`.

## Run

```bash
npm install
npm start          # scan the QR code with Expo Go (SDK 58)
npm run web        # or open it in the browser
npm test           # unit tests: money maths, migration, backup, reports, people, months, search, bin, translations
npm run typecheck
```

## Layout

```
App.tsx                         providers (theme, language, error screen, data, undo) + navigator
src/types.ts                    Group / Member / Expense / Payment / Recurring (money in paise)
src/lib/split.ts                shares, balances, settle-up, stats
src/lib/people.ts               the People directory (same person in every group)
src/lib/months.ts               hostel month view, carried balances, monthly repeats
src/lib/migrate.ts              validates + upgrades stored and imported data
src/lib/backup.ts               backup file format, import preview and merge
src/lib/report.ts               text and PDF (HTML) reports
src/lib/files.ts                share sheet, PDF, file picker (native + web)
src/lib/storage.ts              saving and loading (v2: the server goes here)
src/lib/db/                     SQLite tables, groups ↔ rows, upgrade from AsyncStorage
src/context/                    GroupsContext (state + actions), UndoContext (undo bar)
src/i18n/                       translations (en, hi, bn, ta)
src/theme/                      light/dark palettes and makeStyles
src/screens/                    Home, People, Profile, groups, expenses, settings pages
src/components/                 shared UI
```

## Notes

- Money is stored as whole paise, so splits always add up exactly. Leftover paise go to the first people in the list, and balances under ₹1 count as settled.
- A backup file can be imported into a newer version of the app. Anything broken in a file is skipped and reported, never half-loaded.
