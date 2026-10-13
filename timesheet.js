/* Timesheet helpers: dates, sprint calculation, Excel build/parse. Works in browser and Node. */
(function (root) {
  'use strict';

  const DAYN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAY_MS = 864e5;
  const pad = n => String(n).padStart(2, '0');
  const round2 = n => Math.round(n * 100) / 100;

  const isoLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const utc = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const fromUtc = ms => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  const dow = iso => new Date(utc(iso)).getUTCDay();
  const fmtDate = iso => { const [y, m, d] = iso.split('-'); return `${d}-${MON[+m - 1]}-${y}`; };
  const mondayOf = iso => fromUtc(utc(iso) - ((dow(iso) + 6) % 7) * DAY_MS);

  function parseDate(s) {
    s = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3})[a-z]*[-\/ ](\d{4})$/);
    if (m) {
      const i = MON.findIndex(x => x.toLowerCase() === m[2].toLowerCase());
      if (i >= 0) return `${m[3]}-${pad(i + 1)}-${pad(+m[1])}`;
    }
    return null;
  }

  // Sprint config: name prefix, the sprint number that applied on `anchor`, and the weekday (0=Sun..6=Sat) a new sprint starts.
  // Default: Sprint-153 started Tue 06-Oct-2026, so Sprint-154 starts Tue 13-Oct-2026.
  let sprintCfg = { prefix: 'Sprint-', num: 153, day: 2, anchor: '2026-10-06' };
  const setSprintConfig = c => { sprintCfg = Object.assign({}, sprintCfg, c); };
  const getSprintConfig = () => Object.assign({}, sprintCfg);
  const sprintNumber = iso => {
    const a = sprintCfg.anchor;
    const startMs = utc(a) - ((dow(a) - sprintCfg.day + 7) % 7) * DAY_MS;      // last sprint-start weekday on/before anchor
    return sprintCfg.num + Math.floor((utc(iso) - startMs) / DAY_MS / 7);
  };
  const sprintFor = iso => sprintCfg.prefix + sprintNumber(iso);
  const nextSprintStart = iso => fromUtc(utc(iso) + (((sprintCfg.day - dow(iso) + 7) % 7) || 7) * DAY_MS);

  // ---- @mentions: stored in descriptions as "@username" (e.g. @manu.tyagi); "@Full Name" is understood too ----
  const userOf = p => p.email.split('@')[0];
  const escRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentionRe = people => people.length
    ? new RegExp('@(' + people.flatMap(p => [p.name, userOf(p)]).sort((a, b) => b.length - a.length).map(escRe).join('|') + ')(?!\\w)', 'gi') : null;
  const escHtml = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const findPerson = (people, key) => { const k = String(key).toLowerCase(); return people.find(p => p.name.toLowerCase() === k || userOf(p).toLowerCase() === k); };
  function mentionHtml(p, i) {      // same markup the Workdiary editor (Quill mention) produces
    const n = escHtml(p.name), e = escHtml(p.email);
    return '<span class="mention" data-index="' + i + '" data-denotation-char="" data-id="' + p.id + '" data-email="' + e + '" data-display_name="' + n +
      '" data-value="&lt;span title=' + e + '&gt;' + n + '&lt;/span&gt;" data-type="User">﻿<span contenteditable="false"><span class="ql-mention-denotation-char"></span><span title="' + e + '">' + n + '</span></span>﻿</span>';
  }
  // mode: 'user' (default) -> @manu.tyagi | 'name' -> @Full Name | 'html' -> Workdiary mention markup
  function convertMentions(text, people, mode) {
    text = String(text);
    const re = mentionRe(people || []); if (!re) return text;
    if (mode !== 'html') return text.replace(re, (m, n) => { const p = findPerson(people, n); return !p ? m : mode === 'name' ? '@' + p.name : '@' + userOf(p); });
    let out = '', last = 0, i = 0, m;
    while ((m = re.exec(text))) {
      const p = findPerson(people, m[1]); if (!p) continue;
      out += escHtml(text.slice(last, m.index)) + mentionHtml(p, i++); last = m.index + m[0].length;
    }
    return i ? '<p>' + out + escHtml(text.slice(last)) + '</p>' : text;
  }
  function findMentions(text, people) {
    const re = mentionRe(people || []), out = []; if (!re) return out;
    String(text).replace(re, (m, n) => { const p = findPerson(people, n); if (p && !out.includes(p)) out.push(p); return m; });
    return out;
  }

  const BLUE = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

  // Flat layout: Date | Task context | Task sub context | Description | Hours  (one row per task, sorted by date)
  function buildWorkbook(ExcelJS, o) {
    const { tasks, days, ym } = o, people = o.people || [], mode = o.mentionMode || 'user';
    const rows = tasks.filter(t => t.date.startsWith(ym + '-'))
      .map((t, i) => ({ date: t.date, ctx: t.ctx || sprintFor(t.date), sub: t.sub || '', desc: t.desc, hrs: +t.hrs || 0, i }));
    Object.keys(days || {}).forEach(d => {
      if (days[d] === 'leave' && d.startsWith(ym + '-') && !rows.some(r => r.date === d))
        rows.push({ date: d, ctx: sprintFor(d), sub: '', desc: 'Leave', hrs: 0, i: -1 });
    });
    rows.sort((x, y) => x.date.localeCompare(y.date) || x.i - y.i);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Timesheet');
    [14, 14, 18, 80, 9].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    const edge = { style: 'thin', color: { argb: 'FFBFBFBF' } };
    const border = { top: edge, left: edge, bottom: edge, right: edge };
    const put = (r, c, v, o2) => {
      o2 = o2 || {};
      const cell = ws.getCell(r, c);
      cell.value = v;
      cell.font = { name: 'Times New Roman', size: o2.head ? 12 : 11, bold: !!o2.head, color: o2.head ? { argb: 'FFFFFFFF' } : undefined };
      cell.border = border;
      cell.alignment = { vertical: 'middle', horizontal: o2.h || 'left', wrapText: true };
      if (o2.head) cell.fill = BLUE;
    };
    ['Date', 'Task context', 'Task sub context', 'Description', 'Hours'].forEach((h, i) => put(1, i + 1, h, { head: true, h: 'center' }));
    rows.forEach((r, k) => {
      const n = k + 2;
      put(n, 1, fmtDate(r.date)); put(n, 2, r.ctx); put(n, 3, r.sub); put(n, 4, convertMentions(r.desc, people, mode)); put(n, 5, r.hrs, { h: 'center' });
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    // Second sheet: everyone @mentioned this month, with their ids, so an import can match users reliably.
    const used = [];
    rows.forEach(r => findMentions(r.desc, people).forEach(p => { if (!used.includes(p)) used.push(p); }));
    if (used.length) {
      const us = wb.addWorksheet('Mentions');
      [10, 28, 38, 40].forEach((w, i) => { us.getColumn(i + 1).width = w; });
      ['Id', 'Name', 'Email', 'UUID'].forEach((h, i) => { const c = us.getCell(1, i + 1); c.value = h; c.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = BLUE; c.border = border; c.alignment = { horizontal: 'center' }; });
      used.forEach((p, k) => [p.id, p.name, p.email, p.uuid].forEach((v, i) => { const c = us.getCell(k + 2, i + 1); c.value = v; c.font = { name: 'Times New Roman', size: 11 }; c.border = border; }));
    }
    return wb;
  }

  const api = { DAYN, MON, pad, round2, isoLocal, utc, fromUtc, dow, fmtDate, mondayOf, parseDate, sprintFor, sprintNumber, setSprintConfig, getSprintConfig, nextSprintStart, buildWorkbook, convertMentions, findMentions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Timesheet = api;
})(typeof window !== 'undefined' ? window : globalThis);
