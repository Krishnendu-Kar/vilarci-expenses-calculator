# Vilarci E-Split — Features

Vilarci E-Split helps a group of people share costs fairly: friends on a trip, students sharing a hostel mess, flatmates splitting groceries. Everyone logs what they paid for, and the app works out who owes whom and the fewest payments needed to even things out.

**Version 1:** everything is stored on the phone, in a small database (from 1.2). No account, no internet, no server.

The app has a bar at the bottom with three pages: **Home** (your groups), **Balances** (where you stand, with **People** and **Groups** tabs) and **Profile** (you).

---

## 1. Groups

A group is a set of people who share costs, such as "Goa trip" or "Room 204 mess".

| Feature | Details |
|---|---|
| Create a group | Give it a name and a type: **Trip**, **Hostel / Flat**, or **Other**. The type sets the group's icon, and Hostel / Flat groups work month by month (section 4). |
| Managing people | The group form lists who's in (the first 5, then **Show all**), each with a **⋮**: **Rename** and **Remove** (in a live group: rename guests, and admins remove someone settled, through the server). **Add people** opens a popup with the add box at the top, **From contacts**, "Me" when you're not in yet, and your people from other groups. People already in the group aren't listed there; the ones you add in that go show under **Adding N people**, with × to take someone back out. |
| Add yourself | A new group starts with **you** in it once the app knows your name. If it doesn't yet, tap **Me**, type your name once, and you're added; the name is saved to your Profile for next time. |
| Add people from your other groups | In the popup, **From your other groups** lists everyone you've added before, with the groups they're in. Tap someone to add them. Typing filters the list, so you can find a friend quickly. |
| Add people from contacts | In the popup, **From contacts** shows your phone's contacts by name (search, tick several, **Add N people**). They join as **guests**; a name already in your People is that same person, not a new one, and anyone already in the group is greyed out. Only names are read, only when you open it, and only the ones you add are saved, on the phone. The first time, the phone asks for permission. Not on the web build. |
| Add someone new | Type a name and tap **+** (or press Enter). This always makes a new person. Typing someone already in the group says so. A group needs at least 2 people. |
| Same person everywhere | People are saved by a unique id, not by their name. A friend you add from another group is the same person in both, so the app knows they're one person. |
| Rename people | **⋮ → Rename** on a name in the group form. **The new name shows everywhere**: in every group, every expense, the People page and reports (the rename popup says so when they're in other groups; live groups keep the names their members gave themselves). People are told apart by id, so the same name in different groups is fine; only one group's own list can't have the same name twice. |
| Remove people | Allowed only if the person isn't in any expense, payment or monthly repeat yet. Otherwise the app explains what to change first, so totals never break. |
| Edit a group | Use the group's **⋮** menu (top right): **Edit group**, **Share group link** (live groups), **Share report**, **Manage access** (live groups, admins). In Edit group, change what you need and tap **Save** at the top right; the **trash icon** next to it moves the group to the Bin (a live group you are still in: leave it first). On a live group, the **QR** button beside "People" opens its invite (QR, code, link). |

### Home list

| Feature | Details |
|---|---|
| Top of Home | No plain header bar. A dark maroon top with a **swinging, glowing pendulum** (the Vilarci buyer app's idea) that moves like a real one: slow at the ends, fastest through the bottom, with a soft glow that fades out evenly (white-hot in the middle), **slowly changes colour** (yellow, coral, pink, violet, sky blue, mint, and round again) and grows brighter the faster it goes. Every 15 seconds or so a **firecracker** goes up behind it and bursts into coloured sparks. **Touch the light to catch it**, drag and let go to throw it, or flick across the top to push it; it settles back into its usual swing (and hangs still, settling after a push, if the phone asks for less motion). Over it: the logo, **Scan** and **Settings** buttons, and right under them a frosted-glass **search** bar (like the buttons, so the light shows through); the light swings just above it. (Your balance across groups is on Profile.) |
| Search | The search bar opens a page that finds **groups** and **people** by name (every word typed must match). Tap one to open it. A locked group's total stays hidden. |
| Scan a group QR | The **camera** button, or **pulling right on All** (a camera circle follows your finger; let go once it's full size), opens the camera. It reads Vilarci invite links (`esplit.vilarci.in/join/<code>`) and opens **Join** for that code. Asks for the camera once; after a "never", offers Settings. Nothing is recorded. |
| Group cards | Newest activity first, as **compact rows** (like a chat list, in the app's own style). Each row has an icon tile in its type's colour (trip indigo, hostel teal, other orange), the name, then one line with up to three members' initials and "+N" and the number of expenses. On the right: the total spent and under it a small dot with **"N to settle"** (red) or **"All settled"** (green). |
| Filter bar | A WhatsApp-style row: **All · Trip · Hostel · Other · Most visited · Archived** (the chosen one is filled). Tap one, or **swipe left/right** on the list. **Archived** only appears once something is archived. |
| Most visited | Groups you open most often, most opened first. The open counts stay on this phone. |
| Group menu | Tap **⋮** on a card (or long-press it): a small menu opens right at the dots (or under your finger), WhatsApp style, with **Pin to top**, **Archive**, **Lock group** (on phones) and **Move to bin**. Tap outside or press Back to close it. |
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

### Group lock

- ⋮ on a group → **Lock group**. Opening it then asks for your **fingerprint, face or the phone's screen lock** (PIN, pattern or password). The app keeps no PIN of its own.
- Once opened, it stays open until the app has been away for a minute.
- **Locked groups are hidden**, like WhatsApp's locked chats: they leave Home (every filter) and search. **Pull the Home list down** and a **Locked groups (n)** row appears at the top (the pull also syncs). Tap it, pass the fingerprint, face or screen lock once, and the **Locked groups** page lists them; open any of them without being asked again. **Leaving that page locks them all again**, and the row disappears until the next pull.
- Their money isn't counted on the People, person or Profile pages while they're shut (Balances and a person's page always show "Locked groups aren't counted here.", with no count, so nobody can tell whether any groups are locked).
- **Remove lock**: ⋮ on a group in the Locked groups page (asks first); it goes back to Home. Locks are for this phone only: never in backups or shared files.
- Needs a phone screen lock; without one, the app says how to set it up. Not on the web version.

---

## 2. Expenses

| Feature | Details |
|---|---|
| Look | One page. The top is maroon like the header: the amount in large serif type with a gold ₹, and **What was it for?** under it with the category's icon. Below come cards with an icon each: Paste from chat (new expenses), Category, Details, Paid by, Split. |
| Amount | Enter it in rupees, with up to 2 decimals (₹1,200.50). Amounts are stored as whole paise, so totals never drift. You don't need to know the total: type a sum like `48+80+64` or `180x3` and the app shows **= ₹192**. A **+** button adds the plus sign, since phone number keyboards don't have one. |
| Title | Optional. "Boat ride", "Rice", "Ice cream". If left blank, the category name is used. |
| Date | Defaults to today. Tap to pick any date. |
| Category | Food, Travel, Stay, Groceries, Fun, Shopping or Other, as round icon tiles (four to a row). The Stats tab uses them. |
| Note | Optional, up to 200 characters, e.g. a bill number. A note icon shows on the expense in the list. |
| Edit | Tap any expense to change it. The button says **Update changes** and only lights up once you've changed something. |
| Delete, with undo | Deleting asks first, then shows **"Expense deleted · Undo"** for a few seconds. |
| ⋮ menu on every expense | In the group's Expenses list, tap **⋮** (or long-press) for a small menu at the dots with **Pin to top**, **Archive** and **Delete** (with undo). |
| Pin an expense | Pinned expenses show in a **Pinned** section at the top of the list. |
| Archive an expense | Kept as a record but **left out of every calculation**: totals, balances, settle-up, stats and shared reports. Archived expenses sit in a folded **"Archived (N) · not counted"** section at the bottom (dimmed, amount struck through). **Unarchive** counts it again. |
| Drafts | If you leave Add expense without adding, what you typed is saved for that group and restored next time, with a **Discard** option. |

### Paste from chat (many at once)

Add expense has a **Paste from chat** box under the amount, styled like a chat message. Paste a message from WhatsApp (or type one line per person) and tap **Convert**: the app reads every amount and shows a preview with the count and total on top (like the website's), in place of the one-expense form. Nothing is added until you tap **Add N expenses**.

- On a phone, **Paste** fills the box from the clipboard and converts in one tap. **?** shows how to write it, with **Try an example**.
- After converting, changing the text updates the preview. **Clear** (or emptying the box) goes back to the one-expense form.
- If nothing can be read: "No amounts found to add", with the line that failed. The page stays on the form.
- One date and category for all of them, under the preview.
- (Until 1.3 this was a separate **Many at once** tab.)

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

- **One person paid** (tap their name, shown with their initial), or **more than one person paid** (amounts must add up to the total).
- **Equally**, **₹ Exact**, **Shares** or **%**. Swipe left/right on the split area to switch. Live numbers show the result as you type.
- **Equally** lists everyone with a tick: tap to leave someone out. Each ticked person shows exactly what they'll be charged (e.g. ₹33.34, ₹33.33, ₹33.33).
- **Fair rounding:** leftover paise go one at a time to the first people, so the parts always add up exactly.

---

## 3. Group screen

A group opens at once: the header, name and tabs show first and the numbers and lists fill in right after (the other tabs are built a moment later), so opening never waits for the maths.

The maroon header carries on into the top of the page: **Total spent** (or "Spent in November 2026" when filtered, with **‹ ›** on either side to step a month back or ahead: back to the group's first month, ahead up to 12 months) in large type, then "₹6,200 per person · 4 people", then four underlined tabs. Pull the total up (or tap the little handle under it) and it folds away for more room, leaving only the handle; pull it down to bring it back. It's open each time you open the group. Tap one or **swipe left/right**:

### Expenses
- Grouped by day with each day's total. Each row shows the title, category icon, who paid and how it was split.
- **Search** at the top: type a title, note, category, a person's name or an amount ("120" finds ₹120 and ₹1,200). Every word must match. Search also finds archived expenses (tagged "Archived").
- **⋮** on each row: Pin to top, Archive, Delete. Pinned expenses come first; archived ones fold away at the bottom and aren't counted.
- **Filter** (the funnel next to search): pick a **month** (a grid by year, months with expenses have a dot) and one or more **categories**. Chips under the search show what's on; tap one to take it off. The total at the top and the Stats tab follow the filter; Members and Settle always count everything. Search looks inside the filter, and offers **Search all expenses** when nothing matches.
- An expense counted in another month than its date shows a tag like **For October 2026**.

### Members
- **Search** members by name.
- One row per person: **Paid**, **Share**, any settle-up money **Sent** or **Got**, and **"gets back ₹X"** (green), **"owes ₹X"** (red) or **"settled"**.
- **Your row is marked "You"** and outlined.

### Settle up
- The **fewest payments** that make everyone even, in one card: each row shows who pays (avatar and name, "You" for you), "pays Rahul" / "pays you" under it, and the amount on the right (red when you pay, green when you get it).
- Tap the small **Paid** pill once the money has been sent. An undo bar appears straight away in case it was a mistake. In a live group only the payer, the receiver or an admin sees Paid (and the undo arrow under Payments recorded).
- Where the money goes, under the names: your **UPI ids** on the first row paid to you (no UPI id yet? a hint points to Profile), or in live groups the other person's from their account. Tap one to copy it.
- On your own rows (phones): a **Pay** pill opens your UPI app with the amount filled in (when they have several UPI ids, it first asks which one, with each id's label); back in the app it asks **"Did you pay Rahul ₹450?"** with **Mark as paid**. Some UPI apps refuse links to personal ids, so Copy stays.
- **Send to the group** (a slim button) shares the PDF or message.
- **Payments recorded** lists everything marked as paid; each can be undone (with its own undo bar).
### Stats
- Biggest expense, average per day, spending by category, who paid, and day by day.
- Follows the Expenses filter, with the same chips at the top.

### Live groups (online)
- **⋮** at the top also has **Leave group**, and for admins **Delete for everyone** (or **Restore group** within 30 days). Leaving needs you settled (under ₹1), out of every monthly repeat, and not the only admin; otherwise it says why ("You owe ₹450 here. Settle up first."). Nobody else with an account? Delete the group instead.
- After leaving, being removed, or a delete for everyone, a line at the top says the copy is **read-only** and why.
- **Members ⋮** (admins): **Remove from group**, for anyone settled who isn't the creator and is in no repeat. Their name stays on old expenses but can't be put on new ones.
- The **bell** opens Activity; a **gold dot** on it means someone else changed something since you last looked.
- A small **cloud** in the header while changes wait to go up (tap to try now); the Home row's cloud turns into an upload cloud too.
- Changes from other phones show **at once** while the app is open (the server pokes it); otherwise on opening the app or coming back to it.
- Joins and leaves show as small grey notes under the day in the Expenses list ("Rahul joined with the invite link", "Neha left"), like WhatsApp's.
- **New group: On this device or Online.** The New group form asks where to keep it: **On this device** (the default; no account needed, put it online later from ⋮) or **Online** (friends join with a link; you can start alone). Choosing Online while signed out asks you to sign in and brings you back to the form with everything you typed. Creating an online group opens its **Invite** right away.
- **Unfinished New group is kept:** leave the form and come back, and it says "Your unfinished group is back" with **Discard**.
- **No internet? It waits.** Putting a group online (from the form or ⋮) with no internet says "No internet. "Goa" goes online by itself when you're back online", shows an upload cloud on it, and goes up by itself once there's internet: nothing to tap.
- **Connection bar:** a narrow yellow bar at the very bottom (under the bottom nav bar on Home, Balances and Profile) says **No internet** or **Slow internet** (our server taking 5 s or more, or a 2G network).
- **Saved names, like WhatsApp contacts:** someone with an account shows as **~Sayan Sen** (the name they gave themselves) until you save a name for them. Open their page (tap them in Members or Balances) → **Save name**. From then on they show as your name everywhere on your phone: expenses, Members, Settle, Stats, Activity, Add expense, Balances, search. Their page shows your name big with **~Sayan Sen** under it, plus **Remove saved name**. The saved name is yours: it stays on this phone and in your own backups (Export, Google Drive), and never goes to the group. Guests and you show as you are. Reports (PDF, WhatsApp text) and the Pay button use the names everyone in the group knows.

---

## 4. Hostel / Flat groups: month by month

Hostel and flat groups run for months, so they work a little differently from trips.

| Feature | Details |
|---|---|
| Opens on this month | The Expenses list, the total at the top and Stats open on the current month (a **November 2026** chip). Tap × on the chip, or use the filter, for another month or all of them. |
| Totals | **Members and Settle are always all-time:** what each person paid, their share, and the fewest payments to settle everything. |
| Counts for | Each expense has a **Counts for** month, the month of its date unless you pick another: past months, or up to 12 months ahead. For a bill you forgot last month, set its date (the month follows), or keep today's date and pick the month, e.g. next month's gas bought early. |
| No monthly repeats | Removed in the next version (2026-11-12): add rent, Wi-Fi or the cook each month like any expense. Expenses a repeat already added stay as they were, and old repeats are cleared by themselves. |
| No locked months | From 1.3 nothing is locked: old expenses can be fixed any time. Months closed in an older version simply open up. |

---

## 5. Balances (People and Groups)

| Feature | Details |
|---|---|
| Balances page | Two tabs under the title and search, **People** and **Groups** (tap or swipe); the search box and the count follow the open tab. Opens straight away (the stars join a moment later). A compact night-sky top (violet into wine, softly twinkling stars; no plain header bar) that stays put while the list scrolls: the title, the count and the People / Groups tabs, a small handle under them, then the search box. **Pull the top down (or tap the handle) to open a drawer** with **your people in orbit**; push it back up or tap again to close it. It is closed every time you come in. In the drawer: you in the middle with a gold "You" tag, everyone else on two slow tilted rings, the ones with money open nearest. Each face's ring shows their balance: **green gets back, red owes, grey settled**, explained by three chips with counts. Nearer faces are bigger and brighter. **Swipe across it to spin it** (a finger stops it, a flick keeps it turning and it slows down by itself); **tap a face**: it lifts, glows in its colour and shows the name, then that person opens (holding a finger on it shows the same and pauses the orbit). Below, everyone from all your groups, once, you first. Each card matches the orbit: the same coloured ring round their face, your gold "You" tag, their groups as small chips in the group type's colour (two, then "+N"), the amount in large type with GETS BACK / OWES under it (or "settled"), and an arrow. **Search** by name. |
| Guest tag | Everyone without an account shows **Guest** (for now that's everyone, as live groups aren't here yet). You show **Account** once you sign in. |
| Groups tab | One line per group (locked ones left out) with "+₹X" or "−₹Y" (or Settled); tap a line to open the group. **Search** by group name. |
| Who you are in a group | Each line on the Groups tab shows "You: Krish · change" for groups only on your phone (it only sets whose side the numbers are shown from). Where the app can't tell, it asks "Who are you here?" and you pick the member once. In a **live group** you are your account: it shows "You: Krish" with nothing to change. The same choice is used for "me" in Paste from chat. |
| A person's page | Their balance in each group (tap to open the group), totals for "Gets back" and "Owes", their **UPI ids** (people with an account in one of your live groups, from their account; kept on the phone for offline; tap to copy; yours on your own page), **Rename** (changes the name in every group; for someone with an account it's **Save name**, kept on this phone only, with their own **~name** shown under yours), and **This is me** to link yourself (only while the app doesn't know who you are: signed out with no name linked yet). Someone who's in no group can be removed. |

---

## 6. Profile

| Feature | Details |
|---|---|
| Look | Quiet and simple: a settings button top right, your initial in a circle with a thin bright ring, your name (tap it or ✎ to edit, in a small popup), and your email with a tick when it's verified, or "Guest · saved on this phone only". Then plain lists with room between them. No cards inside cards, no header bar. |
| Sign in | For guests, one slim row: **Sign in / Create account**, with a line on what an account keeps. |
| Your name | Saved on this phone only. It tells the app which member is you in each group, and lets you add yourself to new groups in one tap. Renaming yourself renames your person everywhere. |
| Your balance | **Across all your groups:** "You get back ₹X" and "You owe ₹Y" in large type (or "You're all settled"). |
| UPI ids | Up to 3 (name@bank, e.g. krish@okaxis), each with an optional label like GPay, with **Copy** and **Remove** (with undo). They show in Settle and in the reports you send. The **?** by the heading says what they're for; trying to add a 4th says only 3 fit. |
| Account (optional) | Signed out: **Continue with Google** (one tap, in the Play Store app), or **Sign in** / **Create account** (creating one emails a **6-digit code** from Vilarci; type it in and you're signed in, with "Send a new code" after a minute; signing in before confirming sends a fresh code) with email and password; **Forgot password?** sends a link to set a new one. Signed in, your name and UPI ids are kept with the account (a new phone gets them back). Signed in, **Log out** and **Delete account** are in Settings → Account. **Log out** keeps groups that aren't live on the phone; **Delete account** first checks you could leave every live group and lists what's in the way ("Goa: you owe ₹450 here. Settle up first."); then it leaves them all and removes the account, name and UPI ids from the server. Without an account the app works exactly as before. |
| Settings | A Settings row at the bottom (also the gear on Home). |

---

## 7. Sending details to people who don't have the app

Tap the **share icon** at the top of a group, or **Send to the group** on the Settle tab:

| Option | What the other person gets |
|---|---|
| **PDF report** | Group name, dates, totals, who pays whom, balances, spending by category, every expense and payments made. Opens on any phone. Written in the app's language. |
| **Message (WhatsApp, SMS)** | The same summary as a text message with WhatsApp bold. Written in the app's language. |
| UPI line | When someone owes you and you've saved a UPI id, both reports add **💳 Pay Krish by UPI: krish@okaxis**. |
| **Group file for the app** | A `.vilarci.json` file friends with the app can import. (Once live groups arrive, those are shared by invite link instead; Import stays.) |

---

## 8. Settings

Open with the gear on Home, or from Profile. A menu; each option opens its own page:

| Option | What it does |
|---|---|
| **Google Drive backup** | Your groups in a hidden folder of your Google Drive that only this app can read (the newest two kept). **Back up now**, **Automatic backup** (off / daily / weekly, run when the app opens and one is due), and **Restore**: pick a backup, then the usual Import preview. Counts as a backup for Home's reminder. Needs the Play Store app (not Expo Go). |
| **Export data** | Saves all groups into one file (`vilarci-e-split-backup-2026-10-27.json`) through the share menu. Shows the last export date, red if it's over 2 weeks old. A home banner reminds you after 2 weeks. |
| **Import data** | Pick a backup or a group file. A preview shows each group as **New** or **Updates your copy** before anything changes. Broken files are explained, never half-loaded. Files made by older versions still work and update the right group. |
| **Bin** | Deleted groups, kept 30 days (section 1). |
| **Appearance** | **Same as phone**, **Light** or **Dark**. Dark mode covers every screen; shared PDFs stay light. |
| **Language** | **English, हिन्दी (Hindi), বাংলা (Bengali), தமிழ் (Tamil).** The whole app switches at once, including dates, reports and messages you share. |
| **How to use** | The welcome pages again: what the app does and how to use it, in five swipeable pages. They also show once on the first start (Skip or Get started). |
| **About** | Logo, name, version, what the app does, "Made by Vilarci" and a link to **dev.vilarci.in**. |
| **Account** (signed in) | **Log out** (with the email you're signed in as) asks "Do you really want to log out?" first (or warns that changes not uploaded yet would be lost). **Delete account** (in red): a warning first, then the check for groups you can't leave yet, then "Delete for good? This can't be undone." |

The app version is shown at the bottom of Settings.

---

## 9. Undo and safety

- **Undo bar:** after deleting or archiving an expense, moving a group to the bin, archiving a group, removing or marking a payment, or stopping a repeat, a bar at the bottom offers **Undo** for 6 seconds.
- **Error screen instead of a crash:** if something goes wrong, the app shows "Something went wrong" with **Try again**, **Export my data** (straight from storage, so your data can always be saved), and **Send error details**.
- Money is kept in **whole paise**, so every total, split and balance is exact.

---

## 10. Data and privacy

- **Stored on the device only**, in a database on the phone (from 1.2). No account, no server, no tracking.
- **Quick saving:** only what you changed is saved, so a group with hundreds of expenses saves as fast as a new one.
- Data only leaves the phone when **you** share a report or export a backup.
- Your profile, UPI ids, the People directory, pins, archive, group locks, the Bin, open counts and app settings stay on this phone and are never put in backups or shared files. (UPI ids only leave the phone inside a report you choose to send.)
- **Automatic upgrades:** data from older versions of the app is upgraded the next time it opens. Updating to 1.2 moves everything into the new database by itself: groups, people, pins, the Bin, unsaved drafts and settings all come along, and nothing is lost.

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

## 13. Versions

| Version | What's new |
|---|---|
| **1.0.0** (Play Store, October 2026) | Groups, expenses with dates, notes, several payers and 4 ways to split; settle up with the fewest payments; Stats; PDF and WhatsApp reports; group files; Export / Import; Many at once; sums in the amount box; drafts; swiping between tabs and filters. |
| **1.1.0** | Bottom bar with **People** and **Profile**; add people from other groups and rename them everywhere; pin and archive groups and expenses; the **Bin**; search; undo bar; error screen; hostel months and monthly repeats; **dark mode**; **Hindi, Bengali and Tamil**; small WhatsApp-style ⋮ menus. |
| **1.2.0** (built, not released yet) | Your data moves to a faster database on the phone, by itself and with nothing lost. Old backups and group files still import into the right group. |
| **1.4.0** (in progress) | Optional **accounts** (email and password): name and UPI ids kept with the account, log out, delete account. Continue with Google and Google Drive backup come next. |
| **1.3.0** (in progress) | Hostel groups open on this month with **all-time** Members and Settle; a **filter** for month and category (Stats follows it); **Counts for** month on each expense; no more locked months; **group lock** with fingerprint or screen lock; **UPI ids** in Profile, Settle and reports; **‹ ›** to step months on the group page; a one-page, redesigned **Add expense** with **Paste from chat** and **Convert** (no more tabs). |

---

## 14. Coming next

- **Continue with Google** for accounts.
- **Google Drive backup:** to your own Drive, like WhatsApp. Export and Import stay too.
- **Live groups** (being built, in test builds): signed in, **⋮ → Put online** (on the group's Home card or at the top of the group itself) puts it on the server; you become its creator and the others are guests. The app asks "Which one is you?" when it doesn't know. Live groups show a small cloud next to their name, stay the same on every phone signed in to your account, and keep working offline: changes upload by themselves a couple of seconds later, or when the app next opens. If someone changed the same thing later, or you're no longer allowed to, the app puts the group's version back and says so. Logging out takes live groups off the phone (they come back when you sign in; you're warned if changes haven't uploaded). **Invite** (the person icon on a live group): a QR code, an 8-letter code and a link to copy or share; admins can reset it. **Join**: scan the QR (or type the code); you see the group's name and size, can say which guest you are ("Are you one of these?") so your past expenses become yours, and join, or ask to join when admins approve new members. Admins see who's asking (and who they say they are) and let them in or decline. **Members** shows Creator, Admin and Guest tags (Guest: no account, just added for the sums); tap someone with an account to open their page; admins can make or dismiss admins and link a guest to a member (their expenses and payments move over). **Group settings** (admins): approval for new members; who can add and edit expenses, add guests, change the name and type; the invite link on or off. Where only admins may add expenses, the list stays readable and says so. **Activity** (the bell next to the ⋮ on a live group): every change in the group, newest first, grouped by day with the time on this phone: who joined (with the link, or let in by an admin), who added, edited (and what changed), archived or deleted which expense, payments recorded or undone, renames, new admins and settings. The server writes each line as the change is saved, so nobody can fake or hide one. **Invite links** tapped in WhatsApp or anywhere else open the app straight on Join (from the next store build; signed out, it asks you to sign in first and then carries on); the website's **Open in the app** button does the same. Leaving, removing, deleting, the unread dot, live updates and Pay are described under the group screen (§3, Live groups) and Settle.
- **Quick updates:** small fixes reach your phone without waiting for a Play Store update.
- Later: notifications, WhatsApp OTP login, receipt photos, a "Rate the app" prompt, foreign currencies, itemised bills.
