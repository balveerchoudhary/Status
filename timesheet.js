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

  const BLUE = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

  // Flat layout: Date | Task context | Task sub context | Description | Hours  (one row per task, sorted by date)
  function buildWorkbook(ExcelJS, o) {
    const { tasks, days, ym } = o;
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
      put(n, 1, fmtDate(r.date)); put(n, 2, r.ctx); put(n, 3, r.sub); put(n, 4, r.desc); put(n, 5, r.hrs, { h: 'center' });
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    return wb;
  }

  const api = { DAYN, MON, pad, round2, isoLocal, utc, fromUtc, dow, fmtDate, mondayOf, parseDate, sprintFor, sprintNumber, setSprintConfig, getSprintConfig, nextSprintStart, buildWorkbook };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Timesheet = api;
})(typeof window !== 'undefined' ? window : globalThis);
