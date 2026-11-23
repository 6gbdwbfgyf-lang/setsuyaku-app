'use strict';

/* ===== データ（iPhoneの中に保存） ===== */
const KEY = 'setsuyaku-kakeibo-v1';
const PALETTE = ['#1F7A55', '#3B82C4', '#8A63C9', '#D9822B', '#C94F7C', '#6B7280', '#B08900', '#94A3B8', '#0E8A8A', '#B4443A'];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function defaultData() {
  const c = (name, color, subs) => ({ id: uid(), name, color, subs: subs.map((n) => ({ id: uid(), name: n })) });
  return {
    version: 1,
    categories: [
      c('食費', '#1F7A55', ['朝食', '昼食', '夕食', 'カフェ', '食料品']),
      c('日用品', '#3B82C4', ['消耗品', '衣類', 'その他']),
      c('交通', '#8A63C9', ['電車', 'バス', 'タクシー']),
      c('趣味', '#D9822B', ['本', 'ゲーム', '映画', 'その他']),
      c('交際費', '#C94F7C', ['飲み会', 'プレゼント']),
      c('光熱・通信', '#6B7280', ['電気', 'ガス', '水道', 'スマホ']),
      c('住まい', '#B08900', ['家賃', '家具']),
      c('その他', '#94A3B8', ['その他']),
    ],
    entries: [],
  };
}

let data = null;
try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { data = null; }
if (!isValidData(data)) data = defaultData();

function isValidData(d) {
  return d && Array.isArray(d.categories) && Array.isArray(d.entries);
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch (e) { toast('保存できませんでした'); }
}
// 長く開かなくてもデータが消されにくいようにお願いする
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ===== 便利関数 ===== */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const sum = (list) => list.reduce((a, e) => a + e.amount, 0);
const short = (n) => (n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, '') + '万' : n.toLocaleString('ja-JP'));

function dateLabel(s) {
  const [y, m, d] = s.split('-').map(Number);
  return `${m}月${d}日（${WD[new Date(y, m - 1, d).getDay()]}）`;
}
function findCat(id) {
  return data.categories.find((c) => c.id === id) || { id, name: '（削除したカテゴリ）', color: '#94A3B8', subs: [] };
}
function subName(cat, id) {
  const s = cat.subs.find((x) => x.id === id);
  return s ? s.name : '';
}
function monthEntries(y, m) {
  const p = `${y}-${pad(m)}-`;
  return data.entries.filter((e) => e.date.startsWith(p));
}
function sortEntries(list) {
  return list.slice().sort((a, b) => (a.date === b.date ? (b.created || 0) - (a.created || 0) : a.date < b.date ? 1 : -1));
}

const ICON_PREV = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>';
const ICON_NEXT = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>';
const ICON_DOWN = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
const ICON_UP = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>';

/* ===== 画面の状態 ===== */
function newForm() {
  const c = data.categories[0];
  return { editingId: null, date: ymd(new Date()), amount: '', catId: c ? c.id : null, subId: null, memo: '' };
}
const now = new Date();
const st = {
  tab: 'input',
  form: newForm(),
  y: now.getFullYear(),
  m: now.getMonth() + 1,
  histMode: 'list',
  selDay: ymd(now),
  graphCat: null,
  openCat: null,
};

/* ===== 入力画面 ===== */
function renderInput() {
  const f = st.form;
  const cat = data.categories.find((c) => c.id === f.catId);
  const amountText = f.amount ? Number(f.amount).toLocaleString('ja-JP') : '';
  return `
  <header class="top">
    <h1>${f.editingId ? '記録を修正' : '支出を記録'}</h1>
    <label class="datechip"><span id="datelabel">${dateLabel(f.date)}</span><input type="date" id="f-date" value="${f.date}" aria-label="日付"></label>
  </header>
  <label class="amount"><span>¥</span><input id="f-amount" inputmode="numeric" placeholder="0" value="${amountText}" autocomplete="off" aria-label="金額"></label>
  <p class="label">大カテゴリ</p>
  <div class="catgrid">
    ${data.categories.map((c) => `<button class="cat ${c.id === f.catId ? 'on' : ''}" data-act="pick-cat" data-id="${c.id}" style="--c:${c.color}"><i></i>${esc(c.name)}</button>`).join('')}
  </div>
  ${cat && cat.subs.length ? `
  <p class="label">小カテゴリ（${esc(cat.name)}）</p>
  <div class="chips">
    ${cat.subs.map((s) => `<button class="chip ${s.id === f.subId ? 'on' : ''}" data-act="pick-sub" data-id="${s.id}">${esc(s.name)}</button>`).join('')}
  </div>` : ''}
  <label class="label" for="f-memo">メモ（なくてもOK）</label>
  <input id="f-memo" class="text" value="${esc(f.memo)}" maxlength="60" autocomplete="off">
  <div class="actions">
    ${f.editingId ? '<button class="btn danger" data-act="delete-entry">削除</button><button class="btn ghost" data-act="cancel-edit">やめる</button>' : ''}
    <button class="btn primary" data-act="save-entry">${f.editingId ? '保存する' : '記録する'}</button>
  </div>`;
}

/* ===== 履歴画面 ===== */
function monthNav(suffix) {
  return `<header class="monthnav">
    <button class="icon" data-act="prev-month" aria-label="前の月">${ICON_PREV}</button>
    <h1>${st.y}年${st.m}月${suffix || ''}</h1>
    <button class="icon" data-act="next-month" aria-label="次の月">${ICON_NEXT}</button>
  </header>`;
}
function entryRow(e) {
  const c = findCat(e.catId);
  const sub = subName(c, e.subId);
  return `<button class="row" data-act="edit-entry" data-id="${e.id}">
    <i style="background:${c.color}"></i>
    <span class="rowmain"><span>${esc(c.name)}${sub ? ' · ' + esc(sub) : ''}</span>${e.memo ? `<small>${esc(e.memo)}</small>` : ''}</span>
    <b>${yen(e.amount)}</b></button>`;
}
function renderHistory() {
  const es = sortEntries(monthEntries(st.y, st.m));
  let h = monthNav();
  h += `<div class="seg" role="tablist">
    <button class="${st.histMode === 'list' ? 'on' : ''}" data-act="hist-mode" data-mode="list" role="tab" aria-selected="${st.histMode === 'list'}">リスト</button>
    <button class="${st.histMode === 'cal' ? 'on' : ''}" data-act="hist-mode" data-mode="cal" role="tab" aria-selected="${st.histMode === 'cal'}">カレンダー</button>
  </div>`;
  h += `<div class="totalcard"><span>この月の支出</span><b>${yen(sum(es))}</b></div>`;

  if (st.histMode === 'list') {
    if (!es.length) return h + '<p class="empty">この月の記録はまだありません。<br>「入力」から記録してみましょう。</p>';
    const days = [];
    es.forEach((e) => {
      const last = days[days.length - 1];
      if (last && last.date === e.date) last.items.push(e);
      else days.push({ date: e.date, items: [e] });
    });
    days.forEach((d) => {
      h += `<p class="dayhead"><span>${dateLabel(d.date)}</span><span>${yen(sum(d.items))}</span></p>`;
      h += `<div class="card list">${d.items.map(entryRow).join('')}</div>`;
    });
    h += '<p class="note" style="text-align:center">項目をタップすると修正・削除できます</p>';
    return h;
  }

  // カレンダー
  const first = new Date(st.y, st.m - 1, 1).getDay();
  const days = new Date(st.y, st.m, 0).getDate();
  const byDay = {};
  es.forEach((e) => { byDay[e.date] = (byDay[e.date] || 0) + e.amount; });
  const today = ymd(new Date());
  let cells = WD.map((w, i) => `<div class="wd ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</div>`).join('');
  for (let i = 0; i < first; i++) cells += '<div class="day blank"></div>';
  for (let d = 1; d <= days; d++) {
    const ds = `${st.y}-${pad(st.m)}-${pad(d)}`;
    const col = (first + d - 1) % 7;
    const cls = ['day', col === 0 ? 'sun' : '', col === 6 ? 'sat' : '', ds === st.selDay ? 'sel' : '', ds === today ? 'today' : ''].join(' ');
    const amt = byDay[ds] ? short(byDay[ds]) : '';
    cells += `<button class="${cls}" data-act="sel-day" data-date="${ds}" aria-label="${dateLabel(ds)} ${byDay[ds] ? yen(byDay[ds]) : '記録なし'}"><span class="dn">${d}</span><span class="da">${amt}</span></button>`;
  }
  h += `<div class="card cal"><div class="calgrid">${cells}</div></div>`;

  const dayItems = es.filter((e) => e.date === st.selDay);
  if (st.selDay.startsWith(`${st.y}-${pad(st.m)}-`)) {
    h += `<p class="dayhead"><span>${dateLabel(st.selDay)}の支出</span><span>${yen(sum(dayItems))}</span></p>`;
    h += dayItems.length
      ? `<div class="card list">${dayItems.map(entryRow).join('')}</div>`
      : '<p class="empty" style="padding:12px">この日の記録はありません</p>';
    h += '<button class="btn dashed" data-act="add-on-day">＋ この日の支出を記録</button>';
  }
  return h;
}

/* ===== グラフ画面 ===== */
function renderGraph() {
  const es = monthEntries(st.y, st.m);
  const total = sum(es);
  const byCat = {};
  es.forEach((e) => { byCat[e.catId] = (byCat[e.catId] || 0) + e.amount; });
  const rows = Object.keys(byCat).map((id) => ({ cat: findCat(id), amount: byCat[id] })).sort((a, b) => b.amount - a.amount);
  if (!rows.find((r) => r.cat.id === st.graphCat)) st.graphCat = rows.length ? rows[0].cat.id : null;

  let h = monthNav('の内訳');
  const R = 58, C = 2 * Math.PI * R;
  let off = 0;
  const arcs = rows.map((r) => {
    const len = (r.amount / total) * C;
    const s = `<circle cx="68" cy="68" r="${R}" stroke="${r.cat.color}" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
    off += len;
    return s;
  }).join('');
  h += `<div class="card donutcard">
    <div class="donut">
      <svg role="img" aria-label="カテゴリ別の割合" width="136" height="136" viewBox="0 0 136 136">
        <g transform="rotate(-90 68 68)" fill="none" stroke-width="18">
          <circle cx="68" cy="68" r="${R}" stroke="var(--line2)"/>${arcs}
        </g>
      </svg>
      <div class="center"><small>合計</small><b>${yen(total)}</b></div>
    </div>
    <div class="legend">
      ${rows.length ? rows.map((r) => `<button class="leg ${r.cat.id === st.graphCat ? 'on' : ''}" data-act="graph-cat" data-id="${r.cat.id}"><i style="background:${r.cat.color}"></i><span>${esc(r.cat.name)}</span>${yen(r.amount)}</button>`).join('')
        : '<p class="note">この月の記録はまだありません</p>'}
    </div>
  </div>`;

  if (st.graphCat) {
    const cat = findCat(st.graphCat);
    const ce = es.filter((e) => e.catId === st.graphCat);
    const bySub = {};
    ce.forEach((e) => { const n = subName(cat, e.subId) || '指定なし'; bySub[n] = (bySub[n] || 0) + e.amount; });
    const subs = Object.keys(bySub).map((n) => ({ n, a: bySub[n] })).sort((a, b) => b.a - a.a);
    const max = subs.length ? subs[0].a : 1;
    const catTotal = sum(ce);
    h += `<div class="card subcard">
      <div class="head"><h2>${esc(cat.name)}の内訳</h2><small>${Math.round((catTotal / total) * 100)}% · 上の一覧をタップで切替</small></div>
      ${subs.map((s) => `<div class="sbrow"><p><span>${esc(s.n)}</span><span>${yen(s.a)}</span></p><div class="bar"><div style="width:${((s.a / max) * 100).toFixed(1)}%;background:${cat.color}"></div></div></div>`).join('')}
    </div>`;
  }

  // 過去6か月
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(st.y, st.m - 1 - i, 1);
    const y = d.getFullYear(), m = d.getMonth() + 1;
    months.push({ y, m, t: sum(monthEntries(y, m)) });
  }
  const mmax = Math.max(1, ...months.map((x) => x.t));
  h += `<div class="card subcard">
    <h2>月ごとの支出</h2>
    <div class="months">
      ${months.map((x, i) => `<button class="mbar ${i === 5 ? 'on' : ''}" data-act="goto-month" data-y="${x.y}" data-m="${x.m}" aria-label="${x.y}年${x.m}月 ${yen(x.t)}"><span>${x.t ? short(x.t) : ''}</span><div style="height:${Math.round((x.t / mmax) * 96)}px"></div></button>`).join('')}
    </div>
    <div class="mlabels">${months.map((x, i) => `<span style="${i === 5 ? 'color:var(--ink);font-weight:700' : ''}">${x.m}月</span>`).join('')}</div>
  </div>`;
  return h;
}

/* ===== 設定画面 ===== */
function renderSettings() {
  let h = '<h1>設定</h1><h2 style="margin-top:6px">カテゴリ編集</h2><div class="card list">';
  data.categories.forEach((c, i) => {
    const open = st.openCat === c.id;
    h += `<div class="catrow ${open ? 'open' : ''}">
      <button class="catrow-main" data-act="toggle-cat" data-id="${c.id}" aria-expanded="${open}">
        <i style="background:${c.color}"></i><span>${esc(c.name)}</span><small>${c.subs.length}件</small>${open ? ICON_UP : ICON_DOWN}
      </button>`;
    if (open) {
      h += `<div class="subarea">
        <div class="chips">
          ${c.subs.map((s) => `<button class="chip" data-act="edit-sub" data-cat="${c.id}" data-id="${s.id}">${esc(s.name)}</button>`).join('')}
          <button class="chip add" data-act="add-sub" data-cat="${c.id}">＋ 小カテゴリ</button>
        </div>
        <div class="catops">
          <button data-act="edit-cat" data-id="${c.id}">名前・色を変更</button>
          <button data-act="move-cat" data-id="${c.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>↑ 上へ</button>
          <button data-act="move-cat" data-id="${c.id}" data-dir="1" ${i === data.categories.length - 1 ? 'disabled' : ''}>↓ 下へ</button>
        </div>
        <p class="note">小カテゴリをタップすると名前の変更・並び替え・削除ができます。</p>
      </div>`;
    }
    h += '</div>';
  });
  h += `</div>
  <button class="btn dashed" data-act="add-cat">＋ 大カテゴリを追加</button>
  <h2 style="margin-top:10px">データのバックアップ</h2>
  <div class="grid2">
    <button class="btn" data-act="export">書き出す</button>
    <button class="btn" data-act="import">読み込む</button>
  </div>
  <p class="note">データはこのiPhoneの中だけに保存されています。月に1回くらい「書き出す」で「ファイル」アプリに保存しておくと、機種変更のときも安心です。</p>
  <p class="note">記録件数：${data.entries.length}件</p>`;
  return h;
}

/* ===== 描画 ===== */
const screen = $('#screen');
function render() {
  const fn = { input: renderInput, history: renderHistory, graph: renderGraph, settings: renderSettings }[st.tab];
  screen.innerHTML = fn();
  document.querySelectorAll('#tabs button').forEach((b) => {
    const on = b.dataset.tab === st.tab;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}
function go(tab) {
  st.tab = tab;
  render();
  window.scrollTo(0, 0);
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
}

/* ===== 編集シート ===== */
function openSheet(o) {
  const m = $('#modal');
  let color = o.color;
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="m-title">
    <h2 id="m-title">${esc(o.title)}</h2>
    <label class="label" for="m-name">名前</label>
    <input id="m-name" class="text" value="${esc(o.value || '')}" maxlength="20" autocomplete="off">
    ${o.color ? `<p class="label">色</p><div class="swatches">${PALETTE.map((p) => `<button class="sw ${p === o.color ? 'on' : ''}" data-color="${p}" style="background:${p}" aria-label="この色にする"></button>`).join('')}</div>` : ''}
    ${o.extra || ''}
    <div class="actions">
      ${o.onDelete ? '<button class="btn danger" data-m="delete">削除</button>' : ''}
      <button class="btn ghost" data-m="cancel">キャンセル</button>
      <button class="btn primary" data-m="save">保存</button>
    </div>
  </div>`;
  m.hidden = false;
  m.onclick = (ev) => {
    if (ev.target === m) return closeSheet();
    const sw = ev.target.closest('[data-color]');
    if (sw) {
      color = sw.dataset.color;
      m.querySelectorAll('.sw').forEach((b) => b.classList.toggle('on', b === sw));
      return;
    }
    const b = ev.target.closest('[data-m]');
    if (!b) return;
    const a = b.dataset.m;
    if (a === 'cancel') closeSheet();
    else if (a === 'save') {
      const name = $('#m-name').value.trim();
      if (!name) return toast('名前を入力してください');
      o.onSave(name, color);
      closeSheet();
    } else if (a === 'delete') {
      if (o.onDelete()) closeSheet();
    } else if (o.onExtra) {
      o.onExtra(a);
      closeSheet();
    }
  };
}
function closeSheet() {
  const m = $('#modal');
  m.hidden = true;
  m.innerHTML = '';
  render();
}

/* ===== 操作 ===== */
function shiftMonth(delta) {
  const d = new Date(st.y, st.m - 1 + delta, 1);
  st.y = d.getFullYear();
  st.m = d.getMonth() + 1;
  const t = new Date();
  st.selDay = st.y === t.getFullYear() && st.m === t.getMonth() + 1 ? ymd(t) : `${st.y}-${pad(st.m)}-01`;
  render();
}

const actions = {
  'pick-cat'(t) { st.form.catId = t.dataset.id; st.form.subId = null; render(); },
  'pick-sub'(t) { st.form.subId = st.form.subId === t.dataset.id ? null : t.dataset.id; render(); },
  'save-entry'() {
    const f = st.form;
    const amount = parseInt(f.amount, 10);
    if (!amount || amount <= 0) return toast('金額を入力してください');
    if (!f.catId) return toast('カテゴリを選んでください');
    if (f.editingId) {
      const e = data.entries.find((x) => x.id === f.editingId);
      if (e) Object.assign(e, { date: f.date, amount, catId: f.catId, subId: f.subId, memo: f.memo.trim() });
      save();
      toast('保存しました');
      st.form = newForm();
      go('history');
    } else {
      data.entries.push({ id: uid(), date: f.date, amount, catId: f.catId, subId: f.subId, memo: f.memo.trim(), created: Date.now() });
      save();
      toast(`${yen(amount)} を記録しました`);
      Object.assign(f, { amount: '', subId: null, memo: '' });
      render();
    }
  },
  'delete-entry'() {
    if (!confirm('この記録を削除しますか？')) return;
    data.entries = data.entries.filter((x) => x.id !== st.form.editingId);
    save();
    toast('削除しました');
    st.form = newForm();
    go('history');
  },
  'cancel-edit'() { st.form = newForm(); go('history'); },
  'edit-entry'(t) {
    const e = data.entries.find((x) => x.id === t.dataset.id);
    if (!e) return;
    st.form = { editingId: e.id, date: e.date, amount: String(e.amount), catId: e.catId, subId: e.subId, memo: e.memo || '' };
    go('input');
  },
  'prev-month'() { shiftMonth(-1); },
  'next-month'() { shiftMonth(1); },
  'hist-mode'(t) { st.histMode = t.dataset.mode; render(); },
  'sel-day'(t) { st.selDay = t.dataset.date; render(); },
  'add-on-day'() { st.form = newForm(); st.form.date = st.selDay; go('input'); },
  'graph-cat'(t) { st.graphCat = t.dataset.id; render(); },
  'goto-month'(t) { st.y = Number(t.dataset.y); st.m = Number(t.dataset.m); shiftMonth(0); },
  'toggle-cat'(t) { st.openCat = st.openCat === t.dataset.id ? null : t.dataset.id; render(); },
  'edit-cat'(t) {
    const c = findCat(t.dataset.id);
    openSheet({
      title: '大カテゴリを編集', value: c.name, color: c.color,
      onSave(name, color) { c.name = name; c.color = color; save(); },
      onDelete() {
        const used = data.entries.filter((e) => e.catId === c.id).length;
        const msg = used
          ? `「${c.name}」を削除しますか？\nこれまでの記録（${used}件）は残り、「（削除したカテゴリ）」と表示されます。`
          : `「${c.name}」を削除しますか？`;
        if (!confirm(msg)) return false;
        data.categories = data.categories.filter((x) => x.id !== c.id);
        if (st.form.catId === c.id) st.form = newForm();
        save();
        return true;
      },
    });
  },
  'move-cat'(t) {
    const i = data.categories.findIndex((c) => c.id === t.dataset.id);
    const j = i + Number(t.dataset.dir);
    if (i < 0 || j < 0 || j >= data.categories.length) return;
    const list = data.categories;
    [list[i], list[j]] = [list[j], list[i]];
    save();
    render();
  },
  'add-cat'() {
    const used = data.categories.map((c) => c.color);
    const color = PALETTE.find((p) => !used.includes(p)) || PALETTE[0];
    openSheet({
      title: '大カテゴリを追加', value: '', color,
      onSave(name, col) {
        const c = { id: uid(), name, color: col, subs: [] };
        data.categories.push(c);
        st.openCat = c.id;
        save();
      },
    });
    setTimeout(() => { const el = $('#m-name'); if (el) el.focus(); }, 50);
  },
  'add-sub'(t) {
    const c = findCat(t.dataset.cat);
    openSheet({
      title: `「${c.name}」に小カテゴリを追加`, value: '',
      onSave(name) { c.subs.push({ id: uid(), name }); save(); },
    });
    setTimeout(() => { const el = $('#m-name'); if (el) el.focus(); }, 50);
  },
  'edit-sub'(t) {
    const c = findCat(t.dataset.cat);
    const s = c.subs.find((x) => x.id === t.dataset.id);
    if (!s) return;
    const idx = c.subs.indexOf(s);
    openSheet({
      title: '小カテゴリを編集', value: s.name,
      extra: `<p class="label">並び替え</p><div class="minirow">
        <button data-m="left" ${idx === 0 ? 'disabled' : ''}>← 前へ</button>
        <button data-m="right" ${idx === c.subs.length - 1 ? 'disabled' : ''}>次へ →</button></div>`,
      onExtra(a) {
        const j = idx + (a === 'left' ? -1 : 1);
        if (j < 0 || j >= c.subs.length) return;
        [c.subs[idx], c.subs[j]] = [c.subs[j], c.subs[idx]];
        save();
      },
      onSave(name) { s.name = name; save(); },
      onDelete() {
        if (!confirm(`「${s.name}」を削除しますか？\nこれまでの記録は大カテゴリだけで残ります。`)) return false;
        c.subs = c.subs.filter((x) => x.id !== s.id);
        save();
        return true;
      },
    });
  },
  async export() {
    const name = `setsuyaku-backup-${ymd(new Date())}.json`;
    const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  },
  import() { $('#importfile').click(); },
};

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-act],[data-tab]');
  if (!t || t.closest('#modal')) return;
  if (t.dataset.tab) {
    if (t.dataset.tab === 'input' && st.tab !== 'input' && st.form.editingId) st.form = newForm();
    return go(t.dataset.tab);
  }
  const fn = actions[t.dataset.act];
  if (fn) fn(t);
});

screen.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.id === 'f-amount') {
    const digits = el.value.replace(/[^0-9]/g, '').replace(/^0+/, '').slice(0, 9);
    st.form.amount = digits;
    el.value = digits ? Number(digits).toLocaleString('ja-JP') : '';
  } else if (el.id === 'f-memo') {
    st.form.memo = el.value;
  }
});
screen.addEventListener('change', (ev) => {
  if (ev.target.id === 'f-date' && ev.target.value) {
    st.form.date = ev.target.value;
    $('#datelabel').textContent = dateLabel(st.form.date);
  }
});

$('#importfile').addEventListener('change', async (ev) => {
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!isValidData(d)) throw new Error('bad');
    if (!confirm(`バックアップ（記録${d.entries.length}件）を読み込みますか？\n今のデータは置き換わります。`)) return;
    data = d;
    save();
    st.form = newForm();
    st.openCat = null;
    render();
    toast('読み込みました');
  } catch (e) {
    toast('このファイルは読み込めませんでした');
  }
});

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
