# Vilarci E-Split — Features

Vilarci E-Split helps a group of people share costs fairly: friends on a trip, students sharing a hostel mess, flatmates splitting groceries. Everyone logs what they paid for, and the app works out who owes whom and the fewest payments needed to even things out.

**Version 1:** everything is stored on the phone. No account, no internet, no server.

The app has a bar at the bottom with three pages: **Home** (your groups), **People** (everyone from all your groups) and **Profile** (you).

---

## 1. Groups

A group is a set of people who share costs, such as "Goa trip" or "Room 204 mess".

| Feature | Details |
|---|---|
| Create a group | Give it a name and a type: **Trip**, **Hostel / Flat**, or **Other**. The type sets the group's icon, and Hostel / Flat groups work month by month (section 4). |
| Add yourself | A new group starts with **you** in it once the app knows your name. If it doesn't yet, tap **Me**, type your name once, and you're added; the name is saved to your Profile for next time. |
| Add people from your other groups | Under the name box, **From your other groups** lists everyone you've added before, with the groups they're in. Tap someone to add them. Typing filters the list, so you can find a friend quickly. |
| Add someone new | Type a name and tap **+** (or press Enter). This always makes a new person. A group needs at least 2 people. |
| Same person everywhere | People are saved by an id, not by their name. A friend you add from another group is the same person in both, so the app knows they're one person. |
| Rename people | Tap any name in the group's edit screen and change it. **The new name shows everywhere**: in every group, every expense, the People page and reports. Two people in the same group can't end up with the same name. |
| Remove people | Allowed only if the person isn't in any expense, payment or monthly repeat yet. Otherwise the app explains what to change first, so totals never break. |
| Edit a group | Use the pencil icon in the group's header. |

### Home list

| Feature | Details |
|---|---|
| Group cards | Newest activity first. Each card shows the number of people and expenses, the total spent, and a badge: **"N payments to settle"** or **"All settled"**. |
| Filter bar | A WhatsApp-style row: **All · Trip · Hostel · Other · Most visited · Archived**. Tap one, or **swipe left/right** on the list. **Archived** only appears once something is archived. |
| Most visited | Groups you open most often, most opened first. The open counts stay on this phone. |
| Group menu | Tap **⋮** on a card (or long-press it): a small menu opens right at the dots (or under your finger), WhatsApp style, with **Pin to top**, **Archive** and **Move to bin**. Tap outside or press Back to close it. |
| Pin to top | **Pin to top** turns the same small menu into **Always**, **1 day**, **7 days**, **15 days** or **Custom** (← goes back). Custom asks for any number of days, 1–365. Pinned groups stay first in their lists with a pin and "Pinned · 6 days left". A timed pin ends by itself. |
| Archive | Hides a finished group from the lists. It waits under **Archived**, opens normally, and shows an **Unarchive** button inside. |
| New group from a filter | Tapping **New group** while Trip, Hostel or Other is selected starts the new group with that type. |

### Bin

| Feature | Details |
|---|---|
| Move to bin | Deleting a group (from its menu, or **Move to bin** in its edit screen) puts it in the **Bin** instead of deleting it straight away. An undo bar appears too. |
| 30 days | A group stays in the Bin for 30 days, then it's **deleted for good** automatically. |
| Bin page | **Settings → Bin** lists binned groups with "Deleted for good in N days". **Restore** puts a group back exactly as it was; **Delete now** removes it for good (after a confirmation). |

---

## 2. Expenses

| Feature | Details |
|---|---|
| Amount | Enter it in rupees, with up to 2 decimals (₹1,200.50). Amounts are stored as whole paise, so totals never drift. You don't need to know the total: type a sum like `48+80+64` or `180x3` and the app shows **= ₹192**. A **+** button adds the plus sign, since phone number keyboards don't have one. |
| Title | Optional. "Boat ride", "Rice", "Ice cream". If left blank, the category name is used. |
| Date | Defaults to today. Tap to pick any date. |
| Category | Food, Travel, Stay, Groceries, Fun, Shopping or Other. Each has an icon, and the Stats tab uses them. |
| Note | Optional, up to 200 characters, e.g. a bill number. A note icon shows on the expense in the list. |
| Edit | Tap any expense to change it. The button says **Update changes** and only lights up once you've changed something. |
| Delete, with undo | Deleting asks first, then shows **"Expense deleted · Undo"** for a few seconds. |
| ⋮ menu on every expense | In the group's Expenses list, tap **⋮** (or long-press) for a small menu at the dots with **Pin to top**, **Archive** and **Delete** (with undo). |
| Pin an expense | Pinned expenses show in a **Pinned** section at the top of the list. |
| Archive an expense | Kept as a record but **left out of every calculation**: totals, balances, settle-up, stats and shared reports. Archived expenses sit in a folded **"Archived (N) · not counted"** section at the bottom (dimmed, amount struck through). **Unarchive** counts it again. In a closed month, archiving or deleting is blocked until the month is reopened. |
| Drafts | If you leave Add expense without adding, what you typed is saved for that group and restored next time, with a **Discard** option. |

### Many at once (paste from your group chat)

At the top of Add expense, switch **One expense / Many at once**. Paste a message from WhatsApp (or type one line per person) and the app reads every amount, totals it, and shows a preview before adding anything.

| You type | The app reads it as |
|---|---|
| `Krish - 48,80,64,180(3),120` | Krish paid each amount for everyone. `(3)` = only 3 people shared it; the preview asks which 3. |
| `Tamal 290` | Tamal paid ₹290 for everyone. |
| `Krish 50+50+sayak60` | Krish paid 50 and 50, Sayak paid 60. A name switches who paid. |
| `Krish+tamal khabr 50 ami diyachi` | **I** paid ₹50 (title "khabr") for Krish and Tamal only. |
| `Sayak roll 40 and krish 24 ami pabo` | I'm owed: ₹40 roll for Sayak, ₹24 for Krish. |
| `Krish owes me 50` · `Tamal paid 90 for Sayak` · `paid by Om 20` | The same ideas in English. |

- **"Me"** is you: the app already knows from your Profile (or from your last pick in this group), and you can change it in the preview.
- **Names** are matched to group members even with a short form or a one-letter typo. A name that isn't in the group can be matched to a member, linked to **someone from your other groups**, or **added as a new person**.
- **Preview:** tap any row to change the payer or the people. Rows that need an answer are red.
- Each amount is saved as its own expense.

### Who paid and how it's split

- **One person paid**, or **more than one person paid** (amounts must add up to the total).
- **Equally**, **₹ Exact**, **Shares** or **%**. Swipe left/right on the split area to switch. Live numbers show the result as you type.
- **Fair rounding:** leftover paise go one at a time to the first people, so the parts always add up exactly.

---

## 3. Group screen

The top shows the **total spent** and the **average per person**. Four tabs below; tap one or **swipe left/right**:

### Expenses
- Grouped by day with each day's total. Each row shows the title, category icon, who paid and how it was split.
- **Search** at the top: type a title, note, category, a person's name or an amount ("120" finds ₹120 and ₹1,200). Every word must match. Search also finds archived expenses (tagged "Archived").
- **⋮** on each row: Pin to top, Archive, Delete. Pinned expenses come first; archived ones fold away at the bottom and aren't counted.
- A repeat icon marks expenses added by a monthly repeat.

### Members
- **Search** members by name.
- One row per person: **Paid**, **Share**, any settle-up money **Sent** or **Got**, and **"gets back ₹X"** (green), **"owes ₹X"** (red) or **"settled"**.
- **Your row is marked "You"** and outlined.

### Settle up
- The **fewest payments** that make everyone even.
- Tap **Paid** once the money has been sent. An undo bar appears straight away in case it was a mistake.
- Rows involving you read "Krish (you) pays Rahul".
- **Payments recorded** lists everything marked as paid; each can be undone (with its own undo bar).

### Stats
- Biggest expense, average per day, spending by category, who paid, and day by day.

---

## 4. Hostel / Flat groups: month by month

Hostel and flat groups run for months, so they work differently from trips.

| Feature | Details |
|---|---|
| Month view | A bar at the top: **‹ October 2026 ›**. The total, Expenses and Stats show only that month. It opens on the current month. |
| Carried over | The Members tab shows the month's own Paid and Share plus **"From earlier months: owes ₹X"**. The balance on the right is where each person stands at the end of the month, so anything unpaid carries into the next month. |
| Settle up | Always covers everything up to now, not just the month showing. |
| All months | Tap the month name, then **Show all months** for everything together (and **Back to this month** to return). |
| Close a month | From the month menu: **Close October 2026**. Its expenses are locked (they can't be added to, edited or deleted) and the month shows a lock. **Reopen** it from the same menu. |
| Repeat every month | When adding an expense like rent, Wi-Fi or a cook, switch on **Repeat every month**. It's then added by itself on the same day each month (the 31st becomes the last day of short months). Months missed while the app was closed are caught up; closed months are skipped. |
| Change a repeat | Edit any of its expenses with the switch on, and the next months use the new numbers. Switch it off to stop repeating. |
| Repeating expenses page | From the month menu: every repeat with its day, payer and amount, **Open the latest one**, and **Stop** (with undo). |

---

## 5. People

| Feature | Details |
|---|---|
| People page | Everyone from all your groups, once, even if they're in several. You come first. Each row shows their groups and their total across them. **Search** by name. |
| A person's page | Their balance in each group (tap to open the group), totals for "Gets back" and "Owes", **Rename** (changes the name in every group), and **This is me** to link yourself. Someone who's in no group can be removed. |

---

## 6. Profile

| Feature | Details |
|---|---|
| Your name | Saved on this phone only. It tells the app which member is you in each group, and lets you add yourself to new groups in one tap. Renaming yourself renames your person everywhere. |
| Your balance | **Across all your groups:** "You get back ₹X" and "You owe ₹Y" (or "You're all settled"), then one line per group. |
| Who you are in a group | Each group line shows "You: Krish · change". Where the app can't tell, it asks "Who are you here?" and you pick the member once. The same choice is used for "me" in Many at once. |
| Settings | A Settings row at the bottom (also the gear on Home). |

---

## 7. Sending details to people who don't have the app

Tap the **share icon** at the top of a group, or **Send to the group** on the Settle tab:

| Option | What the other person gets |
|---|---|
| **PDF report** | Group name, dates, totals, who pays whom, balances, spending by category, every expense and payments made. Opens on any phone. Written in the app's language. |
| **Message (WhatsApp, SMS)** | The same summary as a text message with WhatsApp bold. Written in the app's language. |
| **Group file for the app** | A `.vilarci.json` file friends with the app can import. (This and Import will be replaced by live sharing in a future update.) |

---

## 8. Settings

Open with the gear on Home, or from Profile. A menu; each option opens its own page:

| Option | What it does |
|---|---|
| **Export data** | Saves all groups into one file (`vilarci-e-split-backup-2026-10-27.json`) through the share menu. Shows the last export date, red if it's over 2 weeks old. A home banner reminds you after 2 weeks. |
| **Import data** | Pick a backup or a group file. A preview shows each group as **New** or **Updates your copy** before anything changes. Broken files are explained, never half-loaded. |
| **Bin** | Deleted groups, kept 30 days (section 1). |
| **Appearance** | **Same as phone**, **Light** or **Dark**. Dark mode covers every screen; shared PDFs stay light. |
| **Language** | **English, हिन्दी (Hindi), বাংলা (Bengali), தமிழ் (Tamil).** The whole app switches at once, including dates, reports and messages you share. |
| **About** | Logo, name, version, what the app does, and "Made by Vilarci". |

The app version is shown at the bottom of Settings.

---

## 9. Undo and safety

- **Undo bar:** after deleting or archiving an expense, moving a group to the bin, archiving a group, removing or marking a payment, or stopping a repeat, a bar at the bottom offers **Undo** for 6 seconds.
- **Error screen instead of a crash:** if something goes wrong, the app shows "Something went wrong" with **Try again**, **Export my data** (straight from storage, so your data can always be saved), and **Send error details**.
- Money is kept in **whole paise**, so every total, split and balance is exact.

---

## 10. Data and privacy

- **Stored on the device only.** No account, no server, no tracking.
- Data only leaves the phone when **you** share a report or export a backup.
- Your profile, the People directory, pins, archive, the Bin, open counts and app settings stay on this phone and are never put in backups or shared files.
- **Automatic upgrades:** data from older versions of the app is upgraded the next time it opens.

---

## 11. Branding

- The **Vilarci logo** is the app icon (including Android's adaptive and themed icons), the splash screen, the home header and the PDF header. It's bundled, so it shows offline.

---

## 12. Platforms

| Platform | Status |
|---|---|
| Android (Expo Go, SDK 58; Play Store build) | Supported |
| iOS (Expo Go, SDK 58) | Supported |
| Web browser (`npm run web`) | Supported. Sharing falls back to download, print and clipboard. |

---

## 13. Coming next

- **Live sharing with a database:** the whole group sees the same data, and it replaces Import and group files. Export stays as an offline copy.
- Later: receipt photos, a "Rate the app" prompt, foreign currencies, itemised bills, fingerprint lock.
