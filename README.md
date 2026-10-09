# Daily Status

A small, mobile-first web page for logging your daily work once and using it twice:

1. **Post today's tasks to a Google Chat space** as one clean message (descriptions only).
2. **Download a monthly Timesheet in Excel** (`Date | Task context | Task sub context | Description | Hours`).

No backend and no database. It is plain HTML/JS hosted on GitHub Pages. Everything you type is stored in **your own browser**.

---

## How it works (the 60-second version)

```
 You type a task ──► saved in your browser (localStorage)
                          │
          ┌───────────────┴────────────────┐
          ▼                                ▼
  "Send today to Chat"             "Download Timesheet"
  (only today's tasks              (every task of the chosen month,
   with the Chat icon ON)           sorted by date, as .xlsx)
          │
          ▼
  HTTPS POST to a Google Chat webhook ──► message appears in the space
```

## Why it is quick to use

| Need | What the page does |
|---|---|
| Log a task fast | Type description, tap an hours quick-pick (.25 .5 1 2 3 4), tap **Add**. Hours default to 2 and are capped at 4 per task. |
| Repeat work | Pick an old sub task (e.g. `AVID-50`) and the last description and hours are filled in. |
| Recurring meetings | **Daily defaults** (e.g. Daily Scrum) are added to every weekday automatically. Each default can be set to *add every weekday* and/or *send to Chat*. |
| Reorder | Drag the ⠿ handle (works by touch and mouse) to reorder tasks within a day. |
| Leave | Settings → *Add leave day(s)* creates a `Leave` entry with 0 hours (a date range skips weekends). |
| Sprint name | Calculated from the date. Settings lets you set the name, today's number and the weekday it changes. |
| Mistakes | Deleting a task shows an **Undo** for 5 seconds. Entries are editable in place. |

## What gets sent to Chat

Only the **description** of each task for **today**, under the person's name and date:

```
*Your Name* — 09-Oct-2026
• First task description
• Second task description
```

- A task is sent only if its **Google Chat icon is ON**. Tasks with it OFF show an amber edge and still go to the Timesheet. This is how private or internal items stay out of Chat.
- Hours, sprint and sub task are **not** sent.
- Pressing Send twice on the same day asks you to tap again, so you do not post duplicates by accident.

## Excel Timesheet

- **⬇ Timesheet** exports the month shown in the month picker.
- One row per task, oldest first. Columns: `Date`, `Task context` (the sprint), `Task sub context`, `Description`, `Hours`.
- Days marked **Leave** appear as a `Leave` row with 0 hours.

## Sprint calculation

A sprint number goes up by 1 every week on the chosen weekday. You give the app one fact ("today is Sprint-153, and the number changes on Tuesday") and every date is derived from it. Past and future dates therefore get the right sprint automatically, and *Apply sprint settings* re-labels existing entries.

## Setup (one time per person)

1. Open the page and scroll to **Settings** at the bottom.
2. Enter your **name** and the Chat **webhook URL**, then **Save settings**.
3. (Optional) set the sprint name/number/weekday and your daily defaults.

To get a webhook URL: in Google Chat open the space → **Apps & integrations** → **Webhooks** → add one → copy the URL.

## Design decisions worth explaining

- **No server.** A static page is free to host and has nothing to maintain. The browser calls Google Chat directly.
- **Browser-only storage.** There is nothing to log in to. Trade-off: data lives only in that browser, so clearing site data erases it and a second device starts empty. Download the Timesheet regularly as a backup.
- **Webhook call without a preflight.** The browser sends the message as a "simple" cross-origin request (`Content-Type: text/plain`, `no-cors`) so it is not blocked by CORS. Google Chat still reads the JSON body. Trade-off: the browser hides Chat's reply, so the page can only say "sent"; confirm in the space.
- **Excel is built in the browser** with ExcelJS (loaded from cdnjs). Downloading needs internet the first time.
- **Plain, separable logic.** Date, sprint and Excel code is in `timesheet.js` so it can be tested without a browser.

## Security notes

- The Chat webhook URL contains a secret token. Anyone who has it can post to the space. Keep the repository **private** and do not paste the URL in public places.
- The URL is stored in the browser and, as shipped, also appears as the default value in `index.html`. If the team grows or the repo becomes broader, remove the default from the code and let each person paste it in Settings, and rotate the webhook if it was ever exposed.
- GitHub Pages for a private repository needs a paid GitHub plan, and viewers need access to the repository.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app: UI, storage, Chat sending, drag and drop |
| `timesheet.js` | Date helpers, sprint calculation, Excel workbook builder |
| `favicon.svg` | Browser tab icon |

## Deploy on GitHub Pages

Repo **Settings → Pages → Deploy from a branch → `main` / root**. The site is then at `https://<user>.github.io/<repo>/`.

## Known limits

- Data is per browser/device, not shared or synced.
- Delivery to Chat cannot be confirmed from the page.
- The Chat webhook allows about 1 message per second per space; the app sends one message per press.
- A task is capped at 4 hours.

## 5-minute demo script for the team

1. Open Settings, enter name and webhook, save.
2. Add 3 tasks: tap hours quick-picks, use a sub task like `AVID-50`.
3. Turn one task's Chat icon off and show it gets the amber edge.
4. Drag a task to reorder; delete one and tap **Undo**.
5. Press **Send today to Chat** and show the message in the space.
6. Press **Timesheet** and open the Excel file.
7. Show Daily defaults, Add leave day(s) and the sprint settings.
