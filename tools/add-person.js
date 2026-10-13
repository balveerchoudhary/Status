#!/usr/bin/env node
/*
 * Add people to team.json by looking them up in Workdiary.
 *
 *   WD_TOKEN=<your Workdiary session token> node tools/add-person.js manu.tyagi balveer.choudhary1@metacube.com
 *   WD_TOKEN=... node tools/add-person.js someone.new --dry     (show what would be added, write nothing)
 *
 * Each argument is an email, or just the part before the @ (the domain defaults to metacube.com).
 * The token is read from the environment only. Never write it into a file or commit it.
 */
const fs = require('fs'), path = require('path');

const DOMAIN = 'metacube.com';
const API = 'https://workdiary-services.org40now.com/external_apis/groups_and_employees.json';
const FILE = path.join(__dirname, '..', 'team.json');

const args = process.argv.slice(2), dry = args.includes('--dry');
const emails = args.filter(a => !a.startsWith('--')).map(a => (a.includes('@') ? a : a + '@' + DOMAIN).toLowerCase());
const token = process.env.WD_TOKEN;
if (!token || !emails.length) {
  console.error('Usage: WD_TOKEN=<token> node tools/add-person.js <email-or-username> [...] [--dry]');
  process.exit(1);
}

async function lookup(email) {
  const params = new URLSearchParams({
    group_ids: '', meta_group_ids: '', user_ids: '', author_ids: '', quality_categories: '', quality_types: '', task_categories: '',
    task_types: '', misc_log_category_ids: '', misc_log_type_ids: '', misc_log_types: '', misc_log_categories: '',
    query: email.split('@')[0]
  });
  const res = await fetch(API + '?' + params, {
    headers: { accept: 'application/json', 'content-type': 'application/json', authorization: token,
               origin: 'https://workdiary.org40now.com', referer: 'https://workdiary.org40now.com/' }
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + (res.status === 401 ? ' (token expired or wrong)' : ''));
  const json = await res.json();
  return (json.employees || []).find(e => (e.email || '').toLowerCase() === email);   // exact email only
}

(async () => {
  const team = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let added = 0;
  for (const email of emails) {
    if (team.people.some(p => p.email.toLowerCase() === email)) { console.log('= already listed: ' + email); continue; }
    try {
      const e = await lookup(email);
      if (!e) { console.log('! not found in Workdiary: ' + email); continue; }
      team.people.push({ id: e.id, name: e.full_name, email: e.email, uuid: e.uuid });
      added++; console.log('+ ' + e.full_name + ' (id ' + e.id + ', ' + e.email + ')');
    } catch (err) { console.log('! ' + email + ': ' + err.message); }
  }
  if (!added) return console.log('Nothing to write.');
  team.people.sort((a, b) => a.name.localeCompare(b.name));
  if (dry) return console.log('--dry: team.json not changed.');
  fs.writeFileSync(FILE, JSON.stringify(team, null, 2) + '\n');
  console.log('team.json updated (' + team.people.length + ' people). Commit and push it to publish.');
})();
