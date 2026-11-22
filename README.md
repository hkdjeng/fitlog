# FitLog: free fitness and calorie tracker for your phone

A web app you install from your phone's browser ("Add to Home Screen"). It works offline,
costs nothing, and keeps your data on your phone, with backups to your own Google Drive.

**Tracks:** gym sessions (exercises, sets, reps, kg, with "last time" hints and personal bests),
running (distance, time, pace), badminton, trekking (distance, elevation), food calories,
body weight with a target-weight progress bar, body measurements (waist, hips, chest, arm, thigh, body fat %),
a daily protein goal (1.2 / 1.6 / 2.0 g per kg, set in Settings), and a daily calorie balance.

Files: `index.html`, `styles.css`, `app.js`, `sw.js` (offline support), `manifest.json`, `icons/`.

---

## Step 1: Put it online for free (GitHub Pages, about 5 minutes)

Your phone needs a web address to open the app. GitHub Pages gives you one for free.

1. Create a free account at https://github.com (skip if you have one).
2. Top right **+** → **New repository**. Name it `fitlog`. Choose **Public** (Pages is free only
   for public repos; your *data* is never in the repo, only the app's code). Click **Create repository**.
3. On the new repo page click **uploading an existing file**, drag in **all** the files from this
   folder (including the `icons` folder), then **Commit changes**.
4. Go to **Settings → Pages**. Under "Branch" pick `main` and `/ (root)`, click **Save**.
5. Wait about a minute. Your app is at `https://YOUR-USERNAME.github.io/fitlog/`.

(Or tell Claude in this project and it can do these steps with you.)

## Step 2: Install on your phone

- **Android (Chrome):** open the link → ⋮ menu → **Add to Home screen** / **Install app**.
- **iPhone (Safari):** open the link → Share button → **Add to Home Screen**.

Then open **Settings** in the app and fill in your age, height, weight and goal.

## Step 3 (optional): Google Drive backup, about 10 minutes

Without this you can still back up with **Settings → Save backup file**, which opens your
phone's share sheet so you can save the file to Google Drive by hand.

For one-tap (and automatic) Drive backups, create a free Google "OAuth Client ID":

1. Go to https://console.cloud.google.com/ and sign in with the Google account you want to back up to.
2. Top bar project picker → **New project** → name it `FitLog` → **Create**, then select it.
3. Menu → **APIs & Services → Library** → search **Google Drive API** → **Enable**.
4. Menu → **APIs & Services → OAuth consent screen** (may be called **Google Auth Platform**):
   - App name `FitLog`, your email as support and developer contact.
   - Audience / User type: **External**.
   - Under **Test users**, add your own Gmail address. (Leaving the app in "Testing" is fine for personal use.)
5. Menu → **APIs & Services → Credentials** (or **Clients**) → **Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins:** add `https://YOUR-USERNAME.github.io`
     (no `/fitlog`, no trailing slash).
   - Leave redirect URIs empty. Click **Create**.
6. Copy the **Client ID** (ends in `.apps.googleusercontent.com`).
7. In the app: **Settings → Google Client ID** → paste → **Save** → **Back up to Drive**.
   Google will warn "Google hasn't verified this app". That's expected for your own private app:
   tap **Continue**.

The app only asks for the `drive.file` permission, which means it can see **only the files it
created** (one file named `FitLog backup.json`), not the rest of your Drive. Drive keeps older
versions of that file automatically (right-click → Manage versions).

On a new phone: install the app, paste the same Client ID, tap **Restore from Drive**.

## Step 4 (optional): Food photo estimates with Gemini AI, about 3 minutes

In **Add food** tap **📷 Estimate from a photo**, take or pick a picture of your meal, and the app
fills in the name, calories, protein, carbs and fat. You can add a note ("half the rice left")
and re-estimate. Always check the numbers before saving: portions from a photo are guesses.

To turn it on you need a free Gemini API key:

1. Go to https://aistudio.google.com/ and sign in with your Google account.
2. Click **Get API key** → **Create API key** (let it create a project if it asks).
3. Copy the key.
4. In the app: **Settings → Food photo estimates** → paste → **Save**.

Notes:
- The key is saved only on your phone. It is **not** in the app's code and **not** in your backups,
  so the code can be public without exposing it. On a new phone, paste it again.
- The app picks the newest Gemini "Flash" model your key can use, and falls back to an older
  or "Flash-Lite" model if the free daily limit is hit. You can type a specific model ID under
  *Advanced* in Settings.
- Free-tier limits: a set number of requests per day. If you hit the limit, type calories by hand
  until it resets.
- **Privacy:** on Google's free tier, photos and text you send may be used by Google to improve its
  products and may be read by human reviewers. Don't photograph anything private. (Paid keys
  aren't used this way.)
- Photos are not stored in the app, only the numbers.

## How calories are estimated (these are guesses, not lab numbers)

- **Resting burn (BMR):** Mifflin-St Jeor formula from your sex, age, height and latest weight.
- **Daily life:** BMR × your activity level (1.2 / 1.375 / 1.55). This does *not* include logged workouts.
- **Workouts:** (MET − 1) × weight kg × hours, so resting calories aren't counted twice.
  MET values from the Compendium of Physical Activities:
  - Gym: 3.5 / 5.0 / 6.0 (light / moderate / hard)
  - Running: from your pace when distance is given (e.g. 6:00 /km ≈ 9.8 MET), otherwise 7.0 / 9.8 / 11.5
  - Badminton: 4.5 / 5.5 / 7.0
  - Trekking: 4.5 / 6.0 / 7.8
- If your watch gives a calorie number, type it in "Calories from your watch" and it's used instead.
- **Target** = total burn + goal adjustment (−500 ≈ lose 0.5 kg/week).
- Food calories are what you type, or the photo estimate after you check it. The app remembers foods you've logged so you can re-add them with one tap.

## Updating the app later

Change the files, bump `VERSION` in `sw.js` (e.g. `fitlog-v2`), upload again. Phones pick up
the new version the next time the app opens online. Your data is not affected.

## Privacy

Everything stays in your phone's browser storage, and in your own Google Drive if you turn that on.
No server, no account with anyone but Google. Clearing your browser's site data deletes the
on-phone copy, so keep backups.
