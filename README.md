# ⚡ FieldCurrent — Live from the field

Live customer portal for **Tradelec LLC**. Field crews post photos, written
reports, and status changes from the job site — customers see them **instantly**,
no waiting until end of day.

Built on the same stack as your other apps: **React/Vite + Supabase + Vercel**.

---

## What's inside

**Field console (you & your techs)** — `/admin`
- PIN-protected sign-in
- Add customers — each one gets an auto-generated access code (e.g. `ACME-4821`)
- One-tap "Copy invite link" to text/email a customer their portal
- Create jobs per customer (title, site, job #, scope)
- Post updates: photos (camera **or** camera roll, multiple at once), written reports, quick notes
- Set job status: Scheduled / In progress / On hold / Complete

**Customer portal** — `/c/THEIR-CODE`
- Sees only their own jobs
- **Live timeline** — new updates appear in real time without refreshing
- Tools: photo gallery view, reports-only filter, save/print the full job report as PDF, call/email Tradelec

---

## Setup (about 15 minutes)

### 1. Supabase
1. Go to supabase.com → New project (free tier is fine)
2. Open **SQL Editor** → New query → paste the entire contents of `supabase-schema.sql` → **Run**
3. Go to **Project Settings → API** and copy:
   - Project URL
   - `anon` public key

### 2. GitHub
1. Create a new repo (e.g. `fieldcurrent`)
2. Upload all files from this folder (drag-and-drop works: Add file → Upload files)
3. Commit

### 3. Vercel
1. vercel.com → Add New → Project → import the `fieldcurrent` repo
2. Framework preset: **Vite** (it should auto-detect)
3. Add **Environment Variables**:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |
| `VITE_ADMIN_PIN` | any PIN you want for the team (e.g. `4482`) |

4. Deploy. Done — every future GitHub edit auto-deploys, same as your other projects.

### 4. First run
1. Open your Vercel URL → **Open the field console** → enter your PIN
2. Add a customer → tap into them → create a job → post a photo update
3. Tap **Copy invite link** and text it to the customer — they're live.

---

## Daily flow (from your phone)

1. Open `/admin` → customer → job
2. **Post an update** → tap the photo field → choose **camera or camera roll** → add notes → Post
3. Customer's screen updates within ~1 second, with a "New update from the field" toast.

---

## Notes & next steps

- **Security level (v1):** access is gated by the team PIN + per-customer codes.
  Good for launch; when you're ready, we can upgrade to full Supabase Auth logins
  per customer and lock the database policies down to match.
- **Photos** are stored in the Supabase `job-photos` bucket (public URLs).
- Easy future add-ons: email/SMS notifications on each post, PDF report branding
  with the Tradelec logo, e-signature on completed reports, Spanish toggle.
