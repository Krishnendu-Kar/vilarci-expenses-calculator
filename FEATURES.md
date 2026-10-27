# Vilarci Split — Features

Vilarci Split helps a group of people share costs fairly: friends on a trip, students sharing a hostel mess, flatmates splitting groceries. Everyone logs what they paid for, and the app works out who owes whom and the fewest payments needed to even things out.

**Version 1:** everything is stored on the phone. No account, no internet, no server.

---

## 1. Groups

A group is a set of people who share costs, such as "Goa trip" or "Room 204 mess".

| Feature | Details |
|---|---|
| Create a group | Give it a name and a type: **Trip**, **Hostel / Flat**, or **Other**. The type sets the group's icon. |
| Add people | Type a name and tap add (or press Enter). A group needs at least 2 people. |
| Rename people | Tap any name in the group's edit screen and change it. All expenses update automatically. |
| Remove people | Allowed only if the person isn't in any expense or payment yet. Otherwise the app explains what to change first, so totals never break. |
| Duplicate names blocked | Two people can't have the same name (ignoring case), so nobody gets mixed up. |
| Edit or delete a group | Use the pencil icon in the group's header. Deleting asks for confirmation first. |
| Group list | Groups are listed with the most recently used first. Each card shows the number of people and expenses, the total spent, and a badge: **"N payments to settle"** or **"All settled"**. |
| Filter bar | A WhatsApp-style row of filters above the list: **All · Trip · Hostel · Other · Most visited**. Tap one, or **swipe left/right** on the list to move between them. |
| Most visited | Groups you open most often, most opened first. Each card shows how many times it was opened. The open counts stay on this phone and are never put in backups or shared files. |
| New group from a filter | Tapping **New group** while Trip, Hostel or Other is selected starts the new group with that type. |

---

## 2. Expenses

| Feature | Details |
|---|---|
| Amount | Enter it in rupees, with up to 2 decimals (₹1,200.50). Amounts are stored as whole paise, so totals never drift. |
| Title | Optional. "Boat ride", "Rice", "Ice cream". If left blank, the category name is used. |
| Date | Defaults to today. Tap to pick any date (the calendar on a phone, a date input on the web). |
| Category | Food, Travel, Stay, Groceries, Fun, Shopping or Other. Each has an icon, and the Stats tab uses them. |
| Note | Optional, up to 200 characters, e.g. a bill number or who it was really for. A note icon shows on the expense in the list. |
| Edit / delete | Tap any expense to change or delete it. |

### Who paid

- **One person paid:** tap their name.
- **More than one person paid:** tap *"More than one person paid?"* and enter how much each person put in (e.g. A ₹2,000 + B ₹1,000 for a ₹3,000 dinner). The app shows how much is still left to assign and won't save until the amounts add up to the total.

### How it's split

| Mode | When to use it | Example |
|---|---|---|
| **Equally** | Everyone pays the same. Pick everyone, or only the people it was for. | ₹4,000 boat ride for 3 of the 6 friends → ₹1,333.33 each |
| **₹ Exact** | You know each person's exact amount. Must add up to the total. A *Fill evenly* button gives everyone the same amount to start from. | Cab ₹900: A ₹600, B ₹300 |
| **Shares** | Some people had bigger portions. Everyone starts with 1 share. | Dinner ₹3,000, A ate double (2 shares) → A ₹857.15, others ₹428.57 |
| **%** | Split by percentage. Must add up to 100%. *Fill evenly* is available here too. | Rent: A 50%, B 25%, C 25% |

**Swipe left/right** on the split area to switch between Equally, ₹ Exact, Shares and %.

As you type, the form shows the result live: the amount per person, what each share works out to in rupees, and how much is left (or how much too much) has been assigned.

**Fair rounding:** when an amount doesn't divide evenly (₹100 ÷ 3), the leftover paise go one at a time to the first people, so the parts always add up to exactly the total.

---

## 3. Group screen

The top of the screen always shows the **total spent** and the **average per person**. Below that are four tabs. Tap one, or **swipe left/right** to move between them:

### Expenses
- Grouped by day (**Today**, **Yesterday**, **Sun, 25 Oct**…) with each day's total.
- Each row shows the title, category icon, who paid (*"Person A & Person B paid"*), how it was split (*"split with everyone"*, *"split 3 ways"*, *"by shares"*…) and the amount.
- An **Add expense** button floats at the bottom.

### Members
- One row per person: **Paid** (what they spent for the group), **Share** (their fair part), plus any settle-up money they've **Sent** or **Got**.
- The result is shown as **"gets back ₹X"** (green), **"owes ₹X"** (red), or **"settled"**.

### Settle up
- The **fewest payments** that make everyone even. A group of N people never needs more than N − 1 payments.
- Each row reads *"E pays A ₹2,066.66"* and has a **Paid** button. Tap it once the money has actually been sent (by UPI, cash, etc.).
- **Payments recorded** lists everything marked as paid, and each one can be undone.
- Anything under ₹1 counts as settled, so nobody is ever asked to send ₹0.01.

### Stats
- **Biggest expense**, plus the **average per day** for groups that span several days.
- **Where the money went:** each category's total and percentage, with bars.
- **Who paid:** how much each person paid, with their fair share underneath.
- **Day by day:** spending per day (shown when there's more than one day).

---

## 4. Sending details to people who don't have the app

Tap the **share icon** at the top of a group, or **Send to the group** on the Settle tab, and choose one of three options:

| Option | What the other person gets | Best for |
|---|---|---|
| **PDF report** | A clean document with the group name, dates, totals, **who pays whom**, a balances table, spending by category, every expense (date, item, note, who paid, how it was split) and payments already made. | Anyone. Opens on any phone or computer, no app needed. |
| **Message (WhatsApp, SMS)** | The same summary as a text message, formatted with WhatsApp bold and emoji, ready to paste in the group chat. | A quick update in the group chat. |
| **Group file for the app** | A `.vilarci.json` file containing the whole group. | Friends who have Vilarci Split. They import it and see everything. |

On a phone these open the normal share menu (WhatsApp, Gmail, Drive, Bluetooth…). In a web browser, the PDF opens the print dialog (choose *Save as PDF*), the message is copied to the clipboard if the browser can't share, and the group file is downloaded.

---

## 5. Settings: export, import and about

Open **Settings** with the gear icon at the top right of the home screen. It's a simple menu: each option opens its own page, and the **app version** is shown at the very bottom.

| Option | What it does |
|---|---|
| **Export data** | Opens the export page. |
| **Import data** | Opens the import page. |
| **About** | App logo, name, version, what the app does, and a link to vilarci.in. |

Version 1 keeps data only on the phone, so if the app is uninstalled or you change phones, the data is gone. Export and Import fix that:

| Feature | Details |
|---|---|
| **Export** | Saves *all* groups into one file named like `vilarci-split-backup-2026-10-27.json` and opens the share menu, so you can keep it in Google Drive, email it, or send it to yourself on WhatsApp. |
| **Last export date** | Shown on the Export page. It turns red if you've never backed up or the last backup is more than 2 weeks old. |
| **Reminder** | A banner on the home screen appears once you have a few expenses and haven't backed up in 2 weeks. Tap it to go straight to Export. |
| **Import** | Pick a backup or a group file a friend sent. Nothing changes until you confirm. |
| **Import preview** | Lists each group in the file as **New** (it will be added) or **Updates your copy** (it will replace the group already on your phone). If your copy was changed *more recently* than the file, you get a warning. |
| **Safe with bad files** | Picking the wrong file shows a clear message ("This isn't a Vilarci Split backup…"). Broken entries inside a file are skipped and counted, never loaded halfway. Files from a newer app version ask you to update first. |
| **New phone** | When there are no groups, the home screen offers *"Have a backup or a group file? Import it"*. |

---

## 6. Data and privacy

- **Stored on the device only** (AsyncStorage). No account, no server, no tracking.
- Data only leaves the phone when **you** share a report or export a backup.
- **Automatic upgrades:** data saved by an older version of the app is upgraded the next time it opens. Data from the first v1 build (single payer, no dates) was migrated and tested.
- Money is kept in **whole paise**, so every total, split and balance is exact.

---

## 7. Branding

- The **Vilarci logo** (from `https://officialpic.vilarci.in/Icons/web-icon.png`) is used as the app icon, the Android adaptive and themed (monochrome) icons, the splash screen, and the browser tab icon.
- The home screen header shows the logo next to **Vilarci Split**.
- Every **PDF report** carries the logo in its header.
- The logo is bundled with the app, so it shows even with no internet.

---

## 8. Platforms

| Platform | Status |
|---|---|
| Android (Expo Go, SDK 57) | Supported |
| iOS (Expo Go, SDK 57) | Supported |
| Web browser (`npm run web`) | Supported. Sharing falls back to download, print and clipboard as described above. |

---

## 9. Coming in v2

- Cloud database and accounts, so the whole group sees the same data live without passing files around.
- Exporting a backup file will keep working as an offline copy.
