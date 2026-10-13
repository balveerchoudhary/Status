#!/usr/bin/env node
/*
 * Upload a Timesheet .xlsx to Gist.ly (Workdiary) from the command line.
 *
 *   WD_TOKEN=<token> node tools/import-timesheet.js <file.xlsx> --group <groupId>
 *
 * Why a script and not a button in the page: the Workdiary API only allows browser calls from
 * https://workdiary.org40now.com, and it needs your logged-in session token. A script on your computer
 * has neither problem. The token is read from the environment only. Never write it into a file.
 *
 * What it sends (same as the Upload button on the Gist.ly import page):
 *   POST /entries/timesheet_import.json   multipart form: file=<xlsx>, group_id=<id>
 * Without group_id Gist.ly saves the rows as DRAFT entries; with it they are saved as entries.
 * The importer needs exactly these headers: Date, Description, Hours, Task context, Task sub context.
 */
const fs = require('fs'), path = require('path');

const API = 'https://workdiary-services.org40now.com';
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--') && a !== args[args.indexOf('--group') + 1]);
const gi = args.indexOf('--group'), group = gi >= 0 ? args[gi + 1] : process.env.WD_GROUP_ID;
const token = process.env.WD_TOKEN;

if (!token || !file || !fs.existsSync(file)) {
  console.error('Usage: WD_TOKEN=<token> node tools/import-timesheet.js <file.xlsx> --group <groupId>');
  process.exit(1);
}
if (!group) console.error('Note: no --group given, so Gist.ly will save the rows as drafts.');

const headers = { accept: 'application/json', authorization: token, origin: 'https://workdiary.org40now.com', referer: 'https://workdiary.org40now.com/' };

(async () => {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), path.basename(file));
  if (group) form.append('group_id', String(group));

  const res = await fetch(API + '/entries/timesheet_import.json', { method: 'POST', headers, body: form });
  const body = await res.text();
  console.log('Upload: HTTP ' + res.status + ' ' + body.slice(0, 300));
  if (!res.ok) process.exit(2);

  // The import is processed in the background; read the newest record of your upload history.
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const list = await (await fetch(API + '/timesheet_uploads/imported_timesheets.json', { headers })).json();
    const last = list.filter(x => x.filename === path.basename(file)).pop() || list[list.length - 1];
    if (last && last.status && last.status !== 'Processing' && last.status !== 'Pending') {
      const d = last.status_data || {};
      console.log('Result: ' + last.status + ' | created ' + d.created + ', drafted ' + d.drafted + ', rejected ' + d.rejected);
      return;
    }
  }
  console.log('Still processing. Check the "Imported Timesheets" list on the Gist.ly import page.');
})().catch(e => { console.error(e.message); process.exit(3); });
