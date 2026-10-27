# Vilarci Split

Split shared expenses in a group (trip friends, hostel mess, flatmates) and see who pays whom at the end.

- Make a group and add everyone in it.
- Log each expense: who paid, how much, and who it was for. The cost can go to everyone, to just a few people (for example a ₹4000 boat ride for 3 of the 6), or be split by exact amounts.
- **Balances** shows what each person paid, their fair share, and whether they get money back or owe.
- **Settle up** lists the fewest payments that even everyone out. Tap **Paid** once the money is sent, or share the summary on WhatsApp.

v1 stores everything on the device with AsyncStorage. v2 will add a database: swap out `src/lib/storage.ts`.

## Run

```bash
npm install
npm start          # scan the QR code with Expo Go (SDK 57)
npm run web        # or open it in the browser
npm run typecheck
```

## Layout

```
App.tsx                      providers + navigator
src/types.ts                 Group / Member / Expense / Payment (money in paise)
src/lib/split.ts             shares, balances, settle-up suggestions
src/lib/storage.ts           AsyncStorage persistence (v2: DB goes here)
src/context/GroupsContext.tsx state + actions, saves on every change
src/screens/                 Groups, GroupForm, GroupDetail, ExpenseForm
src/components/              shared UI
src/theme/                   colours and spacing tokens
```
