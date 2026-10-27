# Vilarci Split

Split shared expenses in a group (trip friends, hostel mess, flatmates) and see who pays whom at the end.

## Features

- **Groups** for trips, hostels and flats. Add, rename or remove people.
- **Expenses** with a date, category and optional note.
  - **More than one payer:** "A paid ₹2000 and B paid ₹1000 for dinner".
  - **Split equally** among everyone or only some people (a ₹4000 boat ride for 3 of the 6).
  - **Split by exact amounts, shares** (2 shares for someone who ate double) **or percentages.**
- **Balances:** what each person paid, their fair share, and whether they get money back or owe.
- **Settle up:** the fewest payments that even everyone out. Tap **Paid** when the money has been sent (it can be undone).
- **Stats:** spending by category, by person, and day by day.
- **Send to someone without the app:** a PDF report, a WhatsApp-ready message, or a group file for friends who have the app.
- **Backup & restore:** export all data to a `.json` file, and import it later with a preview of what will change. A reminder appears if you haven't backed up in 2 weeks.

v1 stores everything on the device (AsyncStorage). v2 will add a database: swap out `src/lib/storage.ts`.

## Run

```bash
npm install
npm start          # scan the QR code with Expo Go (SDK 57)
npm run web        # or open it in the browser
npm test           # unit tests for the money maths, migration, backup and reports
npm run typecheck
```

## Layout

```
App.tsx                         providers + navigator
src/types.ts                    Group / Member / Expense / Payment (money in paise)
src/lib/split.ts                shares, balances, settle-up, stats
src/lib/migrate.ts              validates + upgrades stored and imported data
src/lib/backup.ts               backup file format, import preview and merge
src/lib/report.ts               text and PDF (HTML) reports
src/lib/files.ts                share sheet, PDF, file picker (native + web)
src/lib/storage.ts              AsyncStorage persistence (v2: DB goes here)
src/context/GroupsContext.tsx   state + actions, saves on every change
src/screens/                    Groups, GroupForm, GroupDetail (+ group/ tabs), ExpenseForm, Backup
src/components/                 shared UI
```

## Notes

- Money is stored as whole paise, so splits always add up exactly. Leftover paise go to the first people in the list, and balances under ₹1 count as settled.
- A backup file can be imported into a newer version of the app. Anything broken in a file is skipped and reported, never half-loaded.
