# Operation Vault: setup guide

A timed hacking mission for the Sault College Computer Networking & Cyber Security booth.

- **index.html**: the game. Visitors play it on their phones.
- **board.html**: the live leaderboard for the big monitor.
- **config.js**: the only file you edit (padlock combination + Firebase settings).

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
4. Back in **Firestore → Rules**, replace `PASTE_STAFF_UID` with that UID and click **Publish**.

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
| Big monitor | `.../board.html` | Click **Full screen**, then **Sound on**. Click **Test alarm** to try the celebration. |
| Booth tablet (optional) | `.../index.html?kiosk` | Same game, but it resets itself after a minute idle on the win screen, or three minutes mid-game. |
| Visitors' phones | Scan the QR code | Nothing to do. Players post their own times. |

**Padlock:** set a resettable 4-digit lock to the combination in config.js. Players see it on the win screen.

**Removing a name:** on the board, click **Staff sign-in**, log in, click **Manage**, then click ✕ next to the entry.

**New day:** the board shows only today's runs, so it resets at midnight on its own. Older runs stay in Firestore if you ever want them.

## Good to know

- The game still works if Firebase isn't set up or the Wi-Fi drops. Players just can't post a time.
- The Firestore rules accept only a name (1–16 characters) and a time between 25 seconds and an hour, and posted times can't be edited. A determined visitor with developer tools could still post a fake time, which is the trade-off for no sign-in. Staff can delete it.
- Firebase's free tier allows tens of thousands of reads and writes a day, far more than a booth needs.
- To change the cipher, profile, log or phishing messages, edit `game.js`. Each challenge is clearly labelled.
