# Operation Vault: setup guide

A timed hacking mission for the Sault College Computer Networking & Cyber Security booth.

- **index.html**: the game. Visitors play it on their phones.
- **board.html**: the big monitor: a live intruder map plus today's leaderboard.
- **leads.html**: staff-only page to download "send me program info" sign-ups for recruitment.
- **config.js**: the only file you edit (padlock combination, event name + Firebase settings).

Setup takes about 20 minutes. Steps 1–5 are a one-time job.

---

## 1. Create a free Firebase project (5 min)

1. Go to <https://console.firebase.google.com> and sign in with a Google account the program can keep long-term. A shared program account is better than a personal one.
2. Click **Create a project** and name it `operation-vault`. Google Analytics is not needed, so you can turn it off.
3. The free **Spark** plan is plenty for a booth.

## 2. Connect the game to Firebase (3 min)

1. On the project home page, click the **web** icon `</>` to add a web app. Name it `Operation Vault`. You don't need Firebase Hosting.
2. Firebase shows a `firebaseConfig` block. Copy its six values into the `firebase:` section of **config.js**, replacing each `PASTE_...` placeholder.
3. In **config.js**, set `vault:` to your padlock's 4-digit combination. The default is `'7319'`.

## 3. Turn on the database (3 min)

1. In the left menu, open **Build → Firestore Database → Create database**.
2. Pick the location **northamerica-northeast1 (Montréal)**, then choose **Start in production mode**.
3. Open the **Rules** tab, replace everything with the contents of **firestore.rules**, and click **Publish**. Step 4 fills in one value later.

## 4. Create the booth staff login (3 min)

This login lets staff remove inappropriate names from the board.

1. Open **Build → Authentication → Get started**. Under **Sign-in method**, enable **Email/Password**.
2. On the **Users** tab, click **Add user** and create one staff login, e.g. `cyberbooth@saultcollege.ca`, with a strong password.
3. Copy that user's **User UID** from the users list.
4. Back in **Firestore → Rules**, put that UID in the `isStaff()` list near the top and click **Publish**.
   To give recruiters their own login, add a user for each one and add their UIDs to the same list, e.g. `['uid1', 'uid2']`.

## 5. Put it on GitHub Pages (5 min)

1. On <https://github.com>, create a new **public** repository, e.g. `operation-vault`.
2. Click **Add file → Upload files** and drag in every file from this folder. Click **Commit changes**.
3. Go to **Settings → Pages**. Under **Build and deployment**, set **Source** to *Deploy from a branch*, **Branch** to `main` and the folder to `/ (root)`, then click **Save**.
4. After a minute your game is live at `https://<your-username>.github.io/operation-vault/`.
   The leaderboard is the same address followed by `board.html`.

Optional: to use a college address like `cyber.saultcollege.ca`, ask IT to add a CNAME record pointing to `<your-username>.github.io`. Then enter it under **Settings → Pages → Custom domain**.

The big-screen QR code points to your site automatically. If you use a custom domain or a URL shortener, put that address in `playUrl` in config.js.

---

## At the booth

| Screen | Open this | Do this |
|---|---|---|
| Big monitor | `.../board.html` | Click **Full screen**, then **Sound on**. Click **Test alarm**: a test intruder runs across the map, then the celebration plays. Only this screen sees it. |
| Booth tablet (optional) | `.../index.html?kiosk` | Same game, but it resets itself after a minute idle on the win screen, or three minutes mid-game. |
| Visitors' phones | Scan the QR code | Nothing to do. Players post their own times. |

**Padlock:** set a resettable 4-digit lock to the combination in config.js. Players see it on the win screen.

**Intruder map:** players type a hacker name before they start (blank gets a codename like `VIPER-42`). Their dot moves along Firewall → Staff login → Server → Inbox → Vault as they clear each defence, and the alert feed calls out each step. A dot disappears 25 seconds after its player opens the vault, when they press **Play again**, or 2 minutes after their phone goes quiet.

**School battle:** players pick their school on the start screen (the list is `schools:` in config.js; "Just visiting" is always there). Each school gets its own colour on the map, the leaderboard and the celebration. The big screen ranks schools by the **average of their 5 best times**, so a bigger group can't win on numbers alone; schools with fewer than 5 finishers show "n/5 to qualify" below the rest. The alert feed calls out every lead change.

**Beat the instructor:** play a run yourself and put your name and time in `instructor:` in config.js, e.g. `{ name: 'Mr. Laitinen', time: '2:41' }`. A dashed "line to beat" appears in the leaderboard, and anyone faster gets a badge and a mention on the big screen.

**Ranks and badges:** every finish gets a rank (Script Kiddie up to Red Team Lead) and badges such as Flawless, Phish spotter, Under 1:00, On a roll and Hash cracker. They show on the win screen and the poster.

**New puzzles every game:** the cipher note and key, the person whose password you guess (four to choose from), and the server log all change each game, and the inbox picks 3 of 20 messages. Students can't pass answers down the line. In the inbox, spotting a phish unlocks a 6-second bonus: tap the exact red flag (a fake domain, a request for a code) for 5 seconds off.

**Bonus round:** after winning, players can try "Crack the hash", a dictionary attack against a stolen SHA-256 hash with its own timer. Cracking it adds a ★ next to their name on the board.

**Booth PCs:** open `.../index.html?kiosk` on shared computers. It resets itself when idle, forgets the school pick between players and hides the poster (so selfies don't stay on the PC).

**Wanted poster:** winners can tap **Make my poster** for a mugshot-style WANTED poster with their name and time, plus a QR code to the program page. They can add a selfie or a photo from their gallery, then share or download it. A ready-made caption with the program link is there to copy. Everything is drawn on their phone and photos are never uploaded. The poster is hidden on the booth tablet (`?kiosk`) so selfies don't pile up on a shared device.

**Program info sign-ups:** the win screen has an unticked "Send me program info" box. Ticking it asks for a first name, an email or mobile number, and an optional "I am…". Before each event, set `event:` in config.js (e.g. `'Fall Open House 2026'`) so recruitment can tell events apart.

**Exporting sign-ups:** open `.../leads.html` on a staff laptop (not the big screen) and sign in with a staff login. It shows a count per event; pick an event or *All events* and click **Download CSV**. Visitors can add sign-ups but can never read them back.

**Removing a name:** on the board, click **Staff sign-in**, log in, click **Manage**, then click ✕ next to the entry.

**New day:** the board shows only today's runs, so it resets at midnight on its own. Older runs stay in Firestore if you ever want them.

## Good to know

- The game still works if Firebase isn't set up or the Wi-Fi drops. Players just can't post a time or show up on the map.
- **Before a school visit:** publish the latest **firestore.rules**, set `event:` (e.g. `'High School Visit Oct 2026'`) and your `instructor:` time in config.js, then play one test game on a phone and watch it appear on the board.
- **Updating from an older version?** Each new feature needs the latest rules. Paste **firestore.rules** into **Firestore → Rules** (keep your staff UID in it) and click **Publish**. Without that, sign-ups fail with "Couldn’t send that".
- **Privacy:** sign-ups are personal information. Before the first event, have the college's privacy office check the wording on the win screen and how long you'll keep the exports. To clear old sign-ups, delete them in **Firestore → Data → leads**.
- **Live map:** Paste the new **firestore.rules** into **Firestore → Rules** (keep your staff UID in it) and click **Publish**. Without that, the intruder map stays empty and the board says so.
- Like posted times, map dots come from visitors' phones with no sign-in, so someone with developer tools could add or remove dots. They're temporary and vanish on their own.
- The Firestore rules accept only a name (1–16 characters) and a time between 25 seconds and an hour, and posted times can't be edited. A determined visitor with developer tools could still post a fake time, which is the trade-off for no sign-in. Staff can delete it.
- Firebase's free tier allows tens of thousands of reads and writes a day, far more than a booth needs.
- To change the cipher, profile, log or phishing messages, edit `game.js`. Each challenge is clearly labelled.
