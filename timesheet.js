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

  // Sprints start on Tuesday. Sprint-153 started Tue 06-Oct-2026.
  const sprintFor = iso => 'Sprint-' + (153 + Math.floor((utc(iso) - Date.UTC(2026, 9, 6)) / DAY_MS / 7));

  const GREEN = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB7F0D1' } };
  const YELLOW = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } };

  function buildWorkbook(ExcelJS, o) {
    const { tasks, days, name, empId, ym } = o;
    const [Y, M] = ym.split('-').map(Number);
    const dim = new Date(Date.UTC(Y, M, 0)).getUTCDate();
    const dates = Array.from({ length: dim }, (_, i) => `${Y}-${pad(M)}-${pad(i + 1)}`);
    const byDate = {};
    tasks.forEach(t => { if (t.date.startsWith(ym + '-')) (byDate[t.date] || (byDate[t.date] = [])).push(t); });
    const dayHrs = d => round2((byDate[d] || []).reduce((a, t) => a + (+t.hrs || 0), 0));

    const mondays = [...new Set(dates.map(mondayOf))].sort();
    const weekHrs = mondays.map(() => 0);
    dates.forEach(d => { weekHrs[mondays.indexOf(mondayOf(d))] += dayHrs(d); });
    const grand = round2(weekHrs.reduce((a, b) => a + b, 0));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Timesheet');
    [6, 13, 22, 28, 13, 16, 62, 11, 11].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    const edge = { style: 'thin', color: { argb: 'FFBFBFBF' } };
    const border = { top: edge, left: edge, bottom: edge, right: edge };
    const paint = (cell, o2) => {
      o2 = o2 || {};
      cell.font = { name: 'Arial', size: 10, bold: !!o2.bold };
      cell.border = border;
      cell.alignment = { vertical: 'top', horizontal: o2.h || 'left', wrapText: true };
      if (o2.fill) cell.fill = o2.fill;
    };
    const put = (r, c, v, o2) => { const cell = ws.getCell(r, c); cell.value = v; paint(cell, o2); };

    put(1, 2, 'Employee Id', { bold: true }); put(1, 3, empId || '');
    put(1, 4, 'Name', { bold: true }); put(1, 5, name || '');
    mondays.forEach((_, i) => { put(2, 2 + i, 'Week' + (i + 1), { bold: true }); put(3, 2 + i, round2(weekHrs[i])); });
    put(2, 2 + mondays.length, 'Total', { bold: true }); put(3, 2 + mondays.length, grand);

    ['Day', 'Date', 'Task category', 'Task type', 'Task context', 'Task sub context', 'Task Detail', 'Hours spent', 'Total hours']
      .forEach((h, i) => put(4, i + 1, h, { bold: true }));

    let r = 5;
    for (const d of dates) {
      const list = byDate[d] || [];
      const w = dow(d), mark = days[d];
      const fill = mark === 'leave' ? YELLOW : (mark === 'off' || w === 0 || w === 6) ? GREEN : null;
      const start = r;
      for (let k = 0; k < Math.max(list.length, 1); k++, r++) {
        const t = list[k];
        const vals = [k === 0 ? DAYN[w] : '', k === 0 ? fmtDate(d) : '', t ? t.cat : '', t ? t.type : '',
          t ? t.ctx : '', t ? t.sub : '', t ? t.desc : '', t ? +t.hrs : null, k === 0 && list.length ? dayHrs(d) : null];
        vals.forEach((v, i) => put(r, i + 1, v, { fill, h: i >= 7 ? 'center' : 'left' }));
      }
      if (r - start > 1) [1, 2, 9].forEach(c => ws.mergeCells(start, c, r - 1, c));
    }
    put(r, 1, 'Total', { bold: true }); put(r, 2, '', { bold: true });
    for (let c = 3; c <= 7; c++) put(r, c, '');
    ws.mergeCells(r, 1, r, 2);
    put(r, 8, grand, { bold: true, h: 'center' }); put(r, 9, grand, { bold: true, h: 'center' });
    ws.views = [{ state: 'frozen', ySplit: 4 }];
    return wb;
  }

  const val = c => {
    let v = c.value;
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if (v.richText) v = v.richText.map(x => x.text).join('');
      else if ('result' in v) v = v.result;
      else if (v.text) v = v.text;
    }
    return v == null ? '' : v;
  };
  function fillKind(cell) {
    const a = cell.fill && cell.fill.fgColor && cell.fill.fgColor.argb;
    if (!a || a.length < 6) return '';
    const h = a.slice(-6);
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    if (r > 200 && g > 200 && b < 190) return 'leave';
    if (g > 200 && g >= r + 15 && g >= b) return 'off';
    return '';
  }

  async function parseWorkbook(ExcelJS, buf) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error('No sheet found');
    let hdr = 0;
    for (let r = 1; r <= Math.min(ws.rowCount, 20); r++) {
      if (String(val(ws.getCell(r, 1))).trim() === 'Day') { hdr = r; break; }
    }
    if (!hdr) throw new Error('Header row ("Day, Date, Task category…") not found');
    const out = { empId: String(val(ws.getCell(1, 3))).trim(), name: String(val(ws.getCell(1, 5))).trim(), tasks: [], days: {} };
    let last = '';
    for (let r = hdr + 1; r <= ws.rowCount; r++) {
      if (/^total$/i.test(String(val(ws.getCell(r, 1))).trim()) || /^total$/i.test(String(val(ws.getCell(r, 2))).trim())) break;
      const dv = val(ws.getCell(r, 2));
      const d = dv instanceof Date ? fromUtc(dv.getTime()) : (dv ? parseDate(dv) : null);
      if (d) last = d;
      if (!last) continue;
      const desc = String(val(ws.getCell(r, 7))).trim();
      if (!desc) {
        const k = fillKind(ws.getCell(r, 2));
        if (k && d) out.days[last] = (k === 'off' && [0, 6].includes(dow(last))) ? undefined : k;
        if (out.days[last] === undefined) delete out.days[last];
        continue;
      }
      out.tasks.push({
        date: last, cat: String(val(ws.getCell(r, 3))).trim(), type: String(val(ws.getCell(r, 4))).trim(),
        ctx: String(val(ws.getCell(r, 5))).trim() || sprintFor(last), sub: String(val(ws.getCell(r, 6))).trim(),
        desc, hrs: parseFloat(val(ws.getCell(r, 8))) || 0
      });
    }
    return out;
  }

  const api = { DAYN, MON, pad, round2, isoLocal, utc, fromUtc, dow, fmtDate, mondayOf, parseDate, sprintFor, buildWorkbook, parseWorkbook };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Timesheet = api;
})(typeof window !== 'undefined' ? window : globalThis);
