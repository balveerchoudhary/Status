// ==UserScript==
// @name         Daily Status to Gist.ly import
// @namespace    https://balveerchoudhary.github.io/Status/
// @version      1.0.0
// @description  Click "Gist.ly" in Daily Status: Gist.ly opens, your new entries are imported, Gist.ly closes, and Daily Status shows the result.
// @match        https://workdiary.org40now.com/*
// @match        https://balveerchoudhary.github.io/Status/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_openInTab
// @run-at       document-idle
// @updateURL    https://balveerchoudhary.github.io/Status/gistly-import.user.js
// @downloadURL  https://balveerchoudhary.github.io/Status/gistly-import.user.js
// ==/UserScript==

/*
 * How it works (two halves of one script, joined through the script manager's private storage):
 *
 *   Daily Status tab                         Gist.ly tab
 *   ----------------                         -----------
 *   page builds the file, posts it    --->   (script finds the job in storage)
 *   to this script (same window)             waits until you are signed in (cookie access_token)
 *   script stores the job, opens      --->   finds your group, uploads the file, reads the result
 *   Gist.ly in a new tab                     stores the result, closes itself
 *   script receives the result       <---
 *   tells the page, closes Gist.ly
 *
 * The Gist.ly login token is read only on the Gist.ly tab and used only for Gist.ly's own API calls.
 * Daily Status never sees it. The Daily Status half answers only messages from its own window.
 */
(function () {
  'use strict';

  var GISTLY = 'https://workdiary.org40now.com';
  var API = 'https://workdiary-services.org40now.com';
  var APP = 'https://balveerchoudhary.github.io';
  var VERSION = '1.0.0';
  var XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  var JOB_MAX_AGE = 15 * 60 * 1000;          // a job older than this is ignored
  var LOGIN_WAIT = 10 * 60 * 1000;           // how long Gist.ly waits for you to sign in

  if (location.origin === APP && location.pathname.indexOf('/Status/') === 0) pagesSide();
  else if (location.origin === GISTLY) gistlySide();

  // ---------------------------------------------------------------- Daily Status tab
  function pagesSide() {
    var tab = null, timer = null;
    var say = function (m) { window.postMessage(Object.assign({ type: 'ds-ext-status' }, m), location.origin); };
    var hello = function () { window.postMessage({ type: 'ds-ext-hello', version: VERSION }, location.origin); };

    window.addEventListener('message', function (e) {
      if (e.source !== window || e.origin !== location.origin || !e.data || typeof e.data.type !== 'string') return;
      if (e.data.type === 'ds-ext-ping') hello();
      if (e.data.type === 'ds-ext-start') start(e.data);
    });
    hello();

    function start(d) {
      if (!d.b64 || !d.ids || !d.ids.length) { say({ stage: 'error', message: 'Nothing to import.' }); return; }
      GM_deleteValue('ds_result'); GM_deleteValue('ds_upload');
      GM_setValue('ds_job', { id: String(Date.now()), name: d.name, ids: d.ids, count: d.count, file: d.b64, t: Date.now() });
      try { tab = GM_openInTab(GISTLY + '/#ds-import', { active: true, insert: true, setParent: true }); }
      catch (err) { say({ stage: 'error', message: 'Could not open Gist.ly: ' + err.message }); return; }
      say({ stage: 'opened', message: 'Opening Gist.ly…' });
      clearTimeout(timer);
      timer = setTimeout(function () {
        GM_deleteValue('ds_job');
        say({ stage: 'error', message: 'Timed out waiting for Gist.ly. Sign in there and try again.' });
      }, LOGIN_WAIT + 2 * 60 * 1000);
    }

    GM_addValueChangeListener('ds_status', function (name, oldV, newV, remote) { if (remote && newV) say(newV); });
    GM_addValueChangeListener('ds_result', function (name, oldV, newV, remote) {
      if (!remote || !newV) return;
      clearTimeout(timer);
      window.postMessage({ type: 'ds-ext-done', ids: newV.ids || [], summary: newV.summary || null, group: newV.group || '', error: newV.error || '' }, location.origin);
      try { if (tab) tab.close(); } catch (err) { /* the Gist.ly tab also closes itself */ }
    });
  }

  // ---------------------------------------------------------------- Gist.ly tab
  function gistlySide() {
    var job = GM_getValue('ds_job', null);
    if (!job || !job.id || Date.now() - job.t > JOB_MAX_AGE) return;

    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;background:#1f2937;color:#fff;padding:10px 14px;' +
      'border-radius:10px;font:14px system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35);max-width:320px';
    var show = function (m) { box.textContent = '🔗 Daily Status: ' + m; if (!box.isConnected) document.documentElement.appendChild(box); };
    var status = function (stage, message) { GM_setValue('ds_status', { stage: stage, message: message, at: Date.now() }); show(message); };
    var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var readToken = function () { var m = document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/); return m ? decodeURIComponent(m[1]) : ''; };

    function finish(r) {
      GM_setValue('ds_result', Object.assign({ jobId: job.id, at: Date.now() }, r));
      GM_deleteValue('ds_job'); GM_deleteValue('ds_upload');
      show(r.error ? 'could not import: ' + r.error : 'done. Closing…');
      setTimeout(function () { try { window.close(); } catch (e) { /* Daily Status closes this tab too */ } }, 1200);
    }

    (async function () {
      status('login', 'waiting for you to sign in to Gist.ly…');
      var token = '', waited = 0;
      while (!(token = readToken()) && waited < LOGIN_WAIT) { await sleep(1000); waited += 1000; }
      if (!token) return finish({ error: 'gave up waiting for the Gist.ly sign-in.' });

      var cur = GM_getValue('ds_job', null);                       // another Gist.ly tab may have finished this job already
      if (!cur || cur.id !== job.id) return;
      var claim = GM_getValue('ds_upload', null);
      if (claim && claim.id === job.id && Date.now() - claim.at < 120000) return;
      GM_setValue('ds_upload', { id: job.id, at: Date.now() });

      var hdr = { accept: 'application/json', authorization: token };
      try {
        status('upload', 'importing ' + job.count + ' ' + (job.count === 1 ? 'entry' : 'entries') + '…');

        // your group, from your own Gist.ly login: the one you belong to, or your primary one
        var gid = '', gname = '';
        try {
          var gs = (await (await fetch(API + '/external_apis/get_member_groups.json', { headers: hdr })).json()).groups || [];
          var pick = gs.filter(function (g) { return g.primary; })[0] || (gs.length === 1 ? gs[0] : null);
          if (!pick && gs.length > 1) {
            var ans = prompt('Which group are these entries for?\n' + gs.map(function (g, i) { return (i + 1) + '. ' + g.display_name; }).join('\n'), '1');
            pick = gs[(parseInt(ans, 10) || 1) - 1];
          }
          if (pick) { gid = pick.id; gname = pick.display_name; }
        } catch (e) { /* no group found: Gist.ly will save drafts, like a manual upload without a group */ }

        var bin = atob(job.file), bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        var fd = new FormData();
        fd.append('file', new Blob([bytes], { type: XLSX }), job.name);
        if (gid) fd.append('group_id', gid);

        var t0 = Date.now() - 60000;
        var r = await fetch(API + '/entries/timesheet_import.json', { method: 'POST', headers: hdr, body: fd });
        if (!r.ok) return finish({ error: 'Gist.ly rejected the upload (HTTP ' + r.status + ')' + (r.status === 401 ? '. Sign in again and retry.' : '.') });

        var res = null;
        for (var n = 0; n < 12 && !res; n++) {
          await sleep(1500);
          var list = await (await fetch(API + '/timesheet_uploads/imported_timesheets.json', { headers: hdr })).json();
          var last = list.filter(function (x) { return x.filename === job.name && Date.parse(x.created_at) >= t0; }).pop();
          if (last && last.status === 'Completed') res = last.status_data || {};
        }
        finish({ ids: (!res || !res.rejected) ? job.ids : [], summary: res, group: gname });
      } catch (err) {
        finish({ error: err.message });
      }
    })();
  }
})();
