KT Document: https://balveerchoudhary.github.io/Status/docs/Daily%20Status%20KT.html

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
| Log a task fast | Type description, tap an hours quick-pick (.25 .5 1 2 3 4), tap **Add**. Hours default to 2. A task can go up to 8.5 h, and the page warns when one task is over 4 h. |
| Repeat work | Pick an old sub task (e.g. `AVID-50`) and the last description and hours are filled in. |
| Recurring meetings | **Daily defaults** (e.g. Daily Scrum) are added to every weekday automatically. Each default can be set to *add every weekday* and/or *send to Chat*. |
| Reorder | Drag the ⠿ handle (works by touch and mouse) to reorder tasks within a day. |
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
- **Review before sending:** pressing **Send to Chat** opens a dialog with the exact message. Edit it if you like (edits change only this message, not your saved tasks), then **Send to Chat** (or Ctrl+Enter), or **Cancel**. If today was already sent, the dialog warns that sending again posts a duplicate. The message is limited to 4096 characters.

## Excel Timesheet

- **⬇ Timesheet** exports the month shown in the month picker.
- One row per task, oldest first. Columns: `Date`, `Task context` (the sprint), `Task sub context`, `Description`, `Hours`.
- **Same file every time (Chrome / Edge on a computer):** the first download asks where to save. After that, ⬇ Timesheet rewrites that same file with the full month, including your new entries, instead of creating "(1)" copies. It asks for permission once per browser session. If the file is open in Excel, close it first. If it was moved or deleted, you are asked again. Phones and other browsers fall back to a normal download. The file is regenerated from the page's history, so changes made by hand in Excel are replaced.

## @mentions

Type `@` in any description and pick a teammate (the list comes from `team.json`: id, name, email, uuid). The description gets their **username**, for example `@manu.tyagi`, which is also what Chat and the Timesheet show. Older entries typed as `@Full Name` are converted to the username automatically. (To change the Timesheet format, edit the `mentionMode` value in the Timesheet download code in `index.html`: `'user'`, `'name'` for `@Manu Tyagi`, or `'html'` for Workdiary mention markup.)

When the month has mentions, the workbook gets a second sheet, **Mentions**, listing everyone mentioned with their Id, Name, Email and UUID.

## Adding a new person to the team list

`team.json` is the list behind the `@` picker. Each entry is `{ "id", "name", "email", "uuid" }`. To add someone new, look them up in Workdiary.

### The API

```
GET https://workdiary-services.org40now.com/external_apis/groups_and_employees.json?query=<part before the @ of the email>
```

The page's own request also sends these empty parameters (`group_ids=&meta_group_ids=&user_ids=&author_ids=&quality_categories=&quality_types=&task_categories=&task_types=&misc_log_category_ids=&misc_log_type_ids=&misc_log_types=&misc_log_categories=`). Keep them, as the script does.

Headers:

| Header | Value |
|---|---|
| `accept` / `content-type` | `application/json` |
| `authorization` | your Workdiary session token (see below) |
| `origin` / `referer` | `https://workdiary.org40now.com` (the server only allows that origin) |

Example:

```bash
curl -s -H "accept: application/json" -H "content-type: application/json"      -H "authorization: $WD_TOKEN" -H "origin: https://workdiary.org40now.com"      "https://workdiary-services.org40now.com/external_apis/groups_and_employees.json?query=manu.tyagi"
```

Response (trimmed):

```json
{ "employees": [ { "id": 3067, "full_name": "Manu Tyagi", "email": "manu.tyagi@metacube.com",
                   "uuid": "690987ff-7020-4230-8347-dd62ea4608f0", "type": "User" } ],
  "groups": [] }
```

The search is a loose match, so always pick the employee whose `email` is exactly the one you want.

### Easiest way: the helper script

```bash
WD_TOKEN=<token> node tools/add-person.js new.person            # domain defaults to metacube.com
WD_TOKEN=<token> node tools/add-person.js a.b@metacube.com c.d --dry   # preview only, writes nothing
```

It skips people already listed, adds the exact match, sorts `team.json` by name and tells you what changed. Then commit and push `team.json`.

### Getting the token

Sign in to Workdiary in the browser, open DevTools → Network, click any request to `workdiary-services.org40now.com` and copy the `authorization` request header value.

> **Treat the token like a password.** It is your logged-in session. Never put it in the repo, a chat or a README. It stops working when the session ends, so get a fresh one each time. The script reads it only from the `WD_TOKEN` environment variable.

You can also add a person by hand: copy their `id`, `full_name`, `email` and `uuid` from the response into `team.json`.

## Importing into Gist.ly

The page cannot call Gist.ly itself: its API only answers requests from `https://workdiary.org40now.com`, and your login is a cookie on that site. So the upload runs **inside the Gist.ly tab**, started by a bookmark, and this page only prepares the file.

The file has the columns Gist.ly's importer requires (`Date`, `Description`, `Hours`, `Task context`, `Task sub context`). Gist.ly also needs a **Group** for the rows to be saved as entries (otherwise they become **drafts**). The bookmark finds it for you, so there is nothing to set.

One-time setup, in *Settings → Gist.ly import*: drag **Import Daily Status** to your bookmarks bar.

Each time:

1. Tap **🔗 Gist.ly** (bottom bar). It opens Gist.ly; sign in with Google if asked. The button shows how many entries are waiting.
2. On the Gist.ly tab, click the **Import Daily Status** bookmark.
3. A small window opens, builds a file from the entries not yet imported (dates up to today), uploads it with your **group id** (found from your Gist.ly login), shows the result, marks those entries as imported (green edge), closes, and **reloads the Gist.ly tab** so the new entries show. Your main Daily Status tab updates by itself too: it shows a message and the green edges on the imported entries.

**From Send to Chat:** the review dialog has a tick box "Also open Gist.ly (N entries waiting to import)", on by default. After the Chat message is sent, Gist.ly opens in a new tab and you only click the bookmark there. The tab is opened at the moment you press Send, so pop-up blockers allow it, and it is closed again if the Chat send fails. Untick the box for a Chat-only send; **🔗 Gist.ly** opens Gist.ly on its own.

Details worth knowing:

- Only entries **not yet imported** are sent, so nothing is duplicated. Edits made after importing are not re-sent.
- If Gist.ly rejects any row, nothing is marked as imported and you see the counts.
- Safety: this page answers only messages that come from `https://workdiary.org40now.com`, sends the file only to that origin, and never sees your Gist.ly token. The bookmark reads the token on the Gist.ly page and uses it only for the two Gist.ly API calls.
- The bookmark always opens the published site, `https://balveerchoudhary.github.io/Status/`, and sends the entries saved **in that site** (browser data is per address). A bookmark made earlier from another address must be replaced.
- It needs pop-ups allowed for Gist.ly (the bridge window) and a desktop browser. On a phone, use the normal Timesheet download and upload it by hand.
- If Gist.ly changes its login cookie or API, the bookmark stops working and needs updating.
- **Your group is automatic.** The bookmark asks Gist.ly for your own groups (`GET /external_apis/get_member_groups.json`). It uses the group you belong to, or your primary group. Only if you belong to several and none is primary does it ask you to choose. The result message names the group it used.

### From the command line

```bash
WD_TOKEN=<token> node tools/import-timesheet.js Timesheet_Your_Name_Oct-2026.xlsx
```

Add `--group <groupId>` to force a group; otherwise it looks yours up like the bookmark does. It sends the same request as the Upload button (`POST /entries/timesheet_import.json`, form fields `file` and `group_id`) and then prints how many entries were created, drafted and rejected. Get the token the same way as in *Adding a new person*, and never commit it.

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
| `team.json` | Team directory used by @mentions (id, name, email, uuid) |
| `tools/add-person.js` | Looks people up in Workdiary and adds them to `team.json` |
| `tools/import-timesheet.js` | Uploads a Timesheet .xlsx to Gist.ly from the command line |
| `favicon.svg` | Browser tab icon |

## Deploy on GitHub Pages

Repo **Settings → Pages → Deploy from a branch → `main` / root**. The site is then at `https://<user>.github.io/<repo>/`.

## Known limits

- Data is per browser/device, not shared or synced.
- Delivery to Chat cannot be confirmed from the page.
- The Chat webhook allows about 1 message per second per space; the app sends one message per press.
- A task is capped at 8.5 hours, with a warning above 4 hours.

## 5-minute demo script for the team

1. Open Settings, enter name and webhook, save.
2. Add 3 tasks: tap hours quick-picks, use a sub task like `AVID-50`.
3. Turn one task's Chat icon off and show it gets the amber edge.
4. Drag a task to reorder; delete one and tap **Undo**.
5. Press **Send today to Chat** and show the message in the space.
6. Press **Timesheet** and open the Excel file.
7. Show Daily defaults and the sprint settings.
