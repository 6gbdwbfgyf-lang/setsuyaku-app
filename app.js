'use strict';

/* ===== データ（iPhoneの中に保存） ===== */
const KEY = 'setsuyaku-kakeibo-v1';
const PALETTE = ['#3E7D5A', '#3D6FA8', '#7A5BA8', '#C27A2C', '#B24C72', '#5F6B7A', '#9C7F1E', '#8A94A6', '#2E7F86', '#B03A28'];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function defaultData() {
  const c = (name, color, subs) => ({ id: uid(), name, color, subs: subs.map((n) => ({ id: uid(), name: n })) });
  return {
    version: 1,
    categories: [
      c('食費', '#3E7D5A', ['朝食', '昼食', '夕食', 'カフェ', '食料品']),
      c('日用品', '#3D6FA8', ['消耗品', '衣類', 'その他']),
      c('交通', '#7A5BA8', ['電車', 'バス', 'タクシー']),
      c('趣味', '#C27A2C', ['本', 'ゲーム', '映画', 'その他']),
      c('交際費', '#B24C72', ['飲み会', 'プレゼント']),
      c('光熱・通信', '#5F6B7A', ['電気', 'ガス', '水道', 'スマホ']),
      c('住まい', '#9C7F1E', ['家賃', '家具']),
      c('その他', '#8A94A6', ['その他']),
    ],
    entries: [],
  };
}

let data = null;
try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { data = null; }
if (!isValidData(data)) data = defaultData();
if (!Array.isArray(data.fixed)) data.fixed = [];
// 前のデザインの色を新しい落ち着いた色に置き換える
const OLD_COLORS = {"#1F7A55": "#3E7D5A", "#3B82C4": "#3D6FA8", "#8A63C9": "#7A5BA8", "#D9822B": "#C27A2C", "#C94F7C": "#B24C72", "#6B7280": "#5F6B7A", "#B08900": "#9C7F1E", "#94A3B8": "#8A94A6"};
data.categories.forEach((c) => { if (OLD_COLORS[c.color]) c.color = OLD_COLORS[c.color]; });

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
  return data.categories.find((c) => c.id === id) || { id, name: '（削除したカテゴリ）', color: '#8A94A6', subs: [] };
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

/* ===== 固定費（毎月決まった日に自動で記録） ===== */
const ym = (y, m) => `${y}-${pad(m)}`;
function nextYm(s) {
  const [y, m] = s.split('-').map(Number);
  const d = new Date(y, m, 1);
  return ym(d.getFullYear(), d.getMonth() + 1);
}
// 登録した日から見て、最初に記録する月（今月の日付が過ぎていれば来月から）
function firstYmFor(day) {
  const t = new Date();
  const thisDay = Math.min(day, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate());
  if (thisDay >= t.getDate()) return ym(t.getFullYear(), t.getMonth() + 1);
  const d = new Date(t.getFullYear(), t.getMonth() + 1, 1);
  return ym(d.getFullYear(), d.getMonth() + 1);
}
// アプリを開いたときに、日付を過ぎた分をまとめて記録する
function applyFixed() {
  const t = new Date();
  const cur = ym(t.getFullYear(), t.getMonth() + 1);
  let added = 0;
  data.fixed.forEach((f) => {
    let guard = 0;
    while (f.next <= cur && guard++ < 120) {
      const [y, m] = f.next.split('-').map(Number);
      const day = Math.min(f.day, new Date(y, m, 0).getDate());
      if (f.next === cur && day > t.getDate()) break;
      data.entries.push({ id: uid(), date: `${f.next}-${pad(day)}`, amount: f.amount, catId: f.catId, subId: f.subId, memo: f.name, created: Date.now(), fixedId: f.id });
      added++;
      f.next = nextYm(f.next);
    }
  });
  if (added) save();
  return added;
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
  const sub = cat ? subName(cat, f.subId) : '';
  const t = new Date();
  const monthSum = sum(monthEntries(t.getFullYear(), t.getMonth() + 1));
  const amountText = f.amount ? Number(f.amount).toLocaleString('ja-JP') : '0';
  const key = (k) => `<button class="key num" data-act="key" data-k="${k}">${k}</button>`;
  return `
  <header class="top">
    <label class="datechip"><span id="datelabel">${dateLabel(f.date)}</span><input type="date" id="f-date" value="${f.date}" aria-label="日付を変える"></label>
    ${f.editingId ? '<span class="editing">記録を修正中</span>' : `<span class="monthsum">今月 <b class="num">${yen(monthSum)}</b></span>`}
  </header>
  <div class="slip" id="slip">
    <div class="slip-main">
      <span class="slip-cat">${cat ? `<i style="background:${cat.color}"></i>${esc(cat.name)}${sub ? '／' + esc(sub) : ''}` : 'カテゴリを選ぶ'}</span>
      <span class="slip-amt num${f.amount ? '' : ' zero'}" id="amt" aria-live="polite">¥${amountText}</span>
    </div>
    <input id="f-memo" class="slip-memo" value="${esc(f.memo)}" maxlength="60" placeholder="メモ（なくてもOK）" autocomplete="off" aria-label="メモ">
  </div>
  <div class="ctabs">
    ${data.categories.map((c) => `<button class="ctab${c.id === f.catId ? ' on' : ''}" data-act="pick-cat" data-id="${c.id}" style="--c:${c.color}">${esc(c.name)}</button>`).join('')}
  </div>
  ${cat && cat.subs.length ? `<div class="subrow">
    ${cat.subs.map((s) => `<button class="chip${s.id === f.subId ? ' on' : ''}" data-act="pick-sub" data-id="${s.id}">${esc(s.name)}</button>`).join('')}
  </div>` : ''}
  <div class="pad">
    ${key(7)}${key(8)}${key(9)}<button class="key fn" data-act="key" data-k="del" aria-label="1文字消す">消す</button>
    ${key(4)}${key(5)}${key(6)}<button class="key fn" data-act="key" data-k="clr" aria-label="金額をクリア">クリア</button>
    ${key(1)}${key(2)}${key(3)}
    <button class="stamp" data-act="save-entry" aria-label="${f.editingId ? '保存する' : '記録する'}"><span>${f.editingId ? '保存' : '記録'}</span></button>
    ${key(0)}${key('00')}${key('000')}
  </div>
  ${f.editingId ? `<div class="actions">
    <button class="btn danger" data-act="delete-entry">この記録を削除</button>
    <button class="btn ghost" data-act="cancel-edit">修正をやめる</button>
  </div>` : ''}`;
}
function stampSlip() {
  const slip = $('#slip');
  if (!slip) return;
  const mark = document.createElement('span');
  mark.className = 'sealmark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = '済';
  slip.appendChild(mark);
  setTimeout(() => mark.remove(), 1100);
}

/* ===== 履歴画面 ===== */
function monthNav(title) {
  return `<header class="monthnav">
    <button class="icon" data-act="prev-month" aria-label="前の月">${ICON_PREV}</button>
    <h1>${title || `${st.y}年${st.m}月`}</h1>
    <button class="icon" data-act="next-month" aria-label="次の月">${ICON_NEXT}</button>
  </header>`;
}
function grandTotal(amount, label) {
  return `<div class="grand"><span>${label || 'この月の支出'}</span><b class="num">${yen(amount)}</b></div>`;
}
function entryLine(e) {
  const c = findCat(e.catId);
  const sub = subName(c, e.subId);
  return `<button class="line" data-act="edit-entry" data-id="${e.id}" aria-label="${esc(c.name)}${sub ? ' ' + esc(sub) : ''} ${yen(e.amount)} を修正">
    <i style="background:${c.color}"></i><span class="ln-name">${esc(sub || c.name)}</span>${e.memo ? `<span class="ln-memo">${esc(e.memo)}</span>` : ''}${e.fixedId ? '<em class="badge">固定</em>' : ''}<span class="dots"></span><span class="num">${yen(e.amount)}</span></button>`;
}
function receipt(date, items) {
  return `<div class="receipt">
    <div class="rc-head"><b>${dateLabel(date)}</b><span>${items.length}件</span></div>
    ${items.map(entryLine).join('')}
    <div class="rc-foot"><span>小計</span><span class="num">${yen(sum(items))}</span></div>
  </div>`;
}
function renderHistory() {
  const es = sortEntries(monthEntries(st.y, st.m));
  let h = monthNav();
  h += grandTotal(sum(es));
  h += `<div class="seg" role="tablist">
    <button class="${st.histMode === 'list' ? 'on' : ''}" data-act="hist-mode" data-mode="list" role="tab" aria-selected="${st.histMode === 'list'}">リスト</button>
    <button class="${st.histMode === 'cal' ? 'on' : ''}" data-act="hist-mode" data-mode="cal" role="tab" aria-selected="${st.histMode === 'cal'}">カレンダー</button>
  </div>`;

  if (st.histMode === 'list') {
    if (!es.length) return h + '<p class="empty">この月の記録はまだありません。<br>「つける」から記録してみましょう。</p>';
    const days = [];
    es.forEach((e) => {
      const last = days[days.length - 1];
      if (last && last.date === e.date) last.items.push(e);
      else days.push({ date: e.date, items: [e] });
    });
    h += days.map((d) => receipt(d.date, d.items)).join('');
    h += '<p class="note center">項目をタップすると修正・削除できます</p>';
    return h;
  }

  // 方眼カレンダー（使った額が多い日ほど濃く）
  const first = new Date(st.y, st.m - 1, 1).getDay();
  const days = new Date(st.y, st.m, 0).getDate();
  const byDay = {};
  es.forEach((e) => { byDay[e.date] = (byDay[e.date] || 0) + e.amount; });
  const max = Math.max(1, ...Object.values(byDay));
  const today = ymd(new Date());
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<div class="day blank"></div>';
  for (let d = 1; d <= days; d++) {
    const ds = `${st.y}-${pad(st.m)}-${pad(d)}`;
    const col = (first + d - 1) % 7;
    const v = byDay[ds] || 0;
    const lv = v ? Math.max(1, Math.ceil((v / max) * 4)) : 0;
    const cls = ['day', `lv${lv}`, col === 0 ? 'sun' : '', col === 6 ? 'sat' : '', ds === st.selDay ? 'sel' : '', ds === today ? 'today' : '', ds > today ? 'future' : ''].join(' ');
    cells += `<button class="${cls}" data-act="sel-day" data-date="${ds}" aria-label="${dateLabel(ds)} ${v ? yen(v) : '記録なし'}"><span class="dn">${d}</span><span class="da num">${v ? short(v) : ''}</span></button>`;
  }
  const rest = (7 - ((first + days) % 7)) % 7;
  for (let i = 0; i < rest; i++) cells += '<div class="day blank"></div>';
  h += `<div class="cal">
    <div class="wds">${WD.map((w, i) => `<span class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</span>`).join('')}</div>
    <div class="calgrid">${cells}</div>
  </div>
  <div class="legend-lv" aria-hidden="true"><span>少</span><i class="lv0"></i><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i><span>多</span></div>`;

  if (st.selDay.startsWith(`${st.y}-${pad(st.m)}-`)) {
    const dayItems = es.filter((e) => e.date === st.selDay);
    h += dayItems.length ? receipt(st.selDay, dayItems) : `<p class="empty small">${dateLabel(st.selDay)}の記録はありません</p>`;
    h += '<button class="btn dashed" data-act="add-on-day">＋ この日の支出をつける</button>';
  }
  return h;
}

/* ===== グラフ画面 ===== */
function pctOf(a, t) {
  const p = (a / t) * 100;
  return (p > 0 && p < 1 ? '1%未満' : Math.round(p) + '%');
}
// ドーナツ型の円グラフ（SVG）
function donut(items, total, title, subtitle) {
  const R = 100, r = 58, C = 120;
  const pt = (rad, ang) => `${(C + rad * Math.sin(ang)).toFixed(2)} ${(C - rad * Math.cos(ang)).toFixed(2)}`;
  let a0 = 0, paths = '';
  items.forEach((it) => {
    const frac = it.amount / total;
    const attrs = `fill="${it.color}" fill-opacity="${it.op}" ${it.act ? ` data-act="${it.act}"` : ''}${it.id ? ` data-id="${it.id}"` : ''} aria-label="${esc(it.label)} ${yen(it.amount)} ${pctOf(it.amount, total)}"`;
    if (frac >= 0.9999) {
      paths += `<path ${attrs} fill-rule="evenodd" d="M${pt(R, 0)}A${R} ${R} 0 1 1 ${pt(R, Math.PI)}A${R} ${R} 0 1 1 ${pt(R, 0)}ZM${pt(r, 0)}A${r} ${r} 0 1 0 ${pt(r, Math.PI)}A${r} ${r} 0 1 0 ${pt(r, 0)}Z"/>`;
    } else {
      const a1 = a0 + frac * 2 * Math.PI;
      const big = a1 - a0 > Math.PI ? 1 : 0;
      paths += `<path ${attrs} d="M${pt(R, a0)}A${R} ${R} 0 ${big} 1 ${pt(R, a1)}L${pt(r, a1)}A${r} ${r} 0 ${big} 0 ${pt(r, a0)}Z"/>`;
      a0 = a1;
    }
  });
  return `<div class="donut">
    <svg viewBox="0 0 240 240" role="img" aria-label="${esc(title)}の内訳">${paths}</svg>
    <div class="donut-c"><span>${esc(title)}</span><b class="num">${yen(total)}</b>${subtitle ? `<small>${subtitle}</small>` : ''}</div>
  </div>`;
}
function legend(items, total, tappable) {
  return '<div class="rank">' + items.map((it) => {
    const inner = `<i style="background:${it.color};opacity:${it.op}"></i><span>${esc(it.label)}</span><span class="dots"></span><span class="num">${yen(it.amount)}</span><span class="pct">${pctOf(it.amount, total)}</span>`;
    return tappable
      ? `<button class="rrow" data-act="${it.act}" data-id="${it.id}">${inner}<span class="chev">${ICON_NEXT}</span></button>`
      : `<div class="rrow">${inner}</div>`;
  }).join('') + '</div>';
}
function renderGraph() {
  const es = monthEntries(st.y, st.m);
  const total = sum(es);
  const byCat = {};
  es.forEach((e) => { byCat[e.catId] = (byCat[e.catId] || 0) + e.amount; });
  const rows = Object.keys(byCat).map((id) => ({ cat: findCat(id), amount: byCat[id] })).sort((a, b) => b.amount - a.amount);
  const cur = st.graphCat && rows.find((r) => r.cat.id === st.graphCat);
  if (!cur) st.graphCat = null;

  let h = monthNav(`${st.y}年${st.m}月は何に使った？`);
  h += '<div class="sheetcard">';
  if (!rows.length) {
    h += grandTotal(total, '合計');
    h += '<p class="empty small">この月の記録はまだありません</p>';
  } else if (!cur) {
    // 大カテゴリの円グラフ
    const items = rows.map((r) => ({ label: r.cat.name, amount: r.amount, color: r.cat.color, op: 1, act: 'graph-cat', id: r.cat.id }));
    h += donut(items, total, '合計');
    h += '<p class="note center">タップすると小カテゴリの内訳が見られます</p>';
    h += legend(items, total, true);
  } else {
    // 小カテゴリの円グラフ
    const bySub = {};
    es.filter((e) => e.catId === cur.cat.id).forEach((e) => {
      const n = subName(cur.cat, e.subId) || '指定なし';
      bySub[n] = (bySub[n] || 0) + e.amount;
    });
    const OPS = [1, 0.72, 0.5, 0.34, 0.22];
    const items = Object.keys(bySub).map((n) => ({ label: n, amount: bySub[n] })).sort((a, b) => b.amount - a.amount)
      .map((x, i) => ({ ...x, color: cur.cat.color, op: OPS[i % OPS.length] }));
    h += `<button class="backlink" data-act="graph-back">${ICON_PREV}<span>全体のグラフに戻る</span></button>`;
    h += donut(items, cur.amount, cur.cat.name, `全体の${pctOf(cur.amount, total)}`);
    h += legend(items, cur.amount, false);
  }
  h += '</div>';

  // 過去6か月
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(st.y, st.m - 1 - i, 1);
    const y = d.getFullYear(), m = d.getMonth() + 1;
    months.push({ y, m, t: sum(monthEntries(y, m)) });
  }
  const mmax = Math.max(1, ...months.map((x) => x.t));
  h += `<div class="sheetcard">
    <h2>月ごとの支出</h2>
    <div class="months">
      ${months.map((x, i) => `<button class="mbar${i === 5 ? ' on' : ''}" data-act="goto-month" data-y="${x.y}" data-m="${x.m}" aria-label="${x.y}年${x.m}月 ${yen(x.t)}"><span class="num">${x.t ? short(x.t) : ''}</span><div style="height:${Math.round((x.t / mmax) * 72)}px"></div></button>`).join('')}
    </div>
    <div class="mlabels">${months.map((x, i) => `<span class="${i === 5 ? 'on' : ''}">${x.m}月</span>`).join('')}</div>
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
  `;
  h += renderFixedSection();
  h += `
  <h2 style="margin-top:10px">データのバックアップ</h2>
  <div class="grid2">
    <button class="btn" data-act="export">書き出す</button>
    <button class="btn" data-act="import">読み込む</button>
  </div>
  <p class="note">データはこのiPhoneの中だけに保存されています。月に1回くらい「書き出す」で「ファイル」アプリに保存しておくと、機種変更のときも安心です。</p>
  <p class="note">記録件数：${data.entries.length}件</p>`;
  return h;
}

function renderFixedSection() {
  let h = '<h2 style="margin-top:10px">固定費（毎月自動で記録）</h2>';
  if (data.fixed.length) {
    const list = data.fixed.slice().sort((a, b) => a.day - b.day);
    h += `<div class="card list">${list.map((f) => {
      const c = findCat(f.catId);
      const sub = subName(c, f.subId);
      return `<button class="row" data-act="edit-fixed" data-id="${f.id}"><i style="background:${c.color}"></i>
        <span class="rowmain"><span>${esc(f.name)}</span><small>毎月${f.day}日 · ${esc(c.name)}${sub ? ' · ' + esc(sub) : ''}</small></span>
        <b>${yen(f.amount)}</b></button>`;
    }).join('')}</div>`;
    const monthly = data.fixed.reduce((a, f) => a + f.amount, 0);
    h += `<p class="note">固定費の合計：毎月 ${yen(monthly)}</p>`;
  } else {
    h += '<p class="note">家賃やスマホ代など、毎月決まった支出を登録しておくと、その日に自動で記録されます。</p>';
  }
  h += '<button class="btn dashed" data-act="add-fixed">＋ 固定費を追加</button>';
  h += '<p class="note">アプリを開いたときに、日付を過ぎた分がまとめて記録されます（しばらく開かなくても抜けません）。</p>';
  return h;
}

function openFixedSheet(f) {
  const isNew = !f;
  const first = data.categories[0];
  const v = f || { name: '', amount: '', day: new Date().getDate(), catId: first ? first.id : '', subId: null };
  const subOpts = (catId, subId) => {
    const c = data.categories.find((x) => x.id === catId);
    return '<option value="">（なし）</option>' + (c ? c.subs.map((s) => `<option value="${s.id}" ${s.id === subId ? 'selected' : ''}>${esc(s.name)}</option>`).join('') : '');
  };
  const m = $('#modal');
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="m-title">
    <h2 id="m-title">${isNew ? '固定費を追加' : '固定費を編集'}</h2>
    <label class="label" for="x-name">名前</label>
    <input id="x-name" class="text" value="${esc(v.name)}" maxlength="20" placeholder="例：家賃、スマホ代" autocomplete="off">
    <div class="grid2">
      <div class="field"><label class="label" for="x-amount">金額（円）</label>
        <input id="x-amount" class="text" inputmode="numeric" value="${v.amount ? Number(v.amount).toLocaleString('ja-JP') : ''}" autocomplete="off"></div>
      <div class="field"><label class="label" for="x-day">毎月の日付</label>
        <select id="x-day" class="text">${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${i + 1 === v.day ? 'selected' : ''}>${i + 1}日</option>`).join('')}</select></div>
    </div>
    <div class="grid2">
      <div class="field"><label class="label" for="x-cat">大カテゴリ</label>
        <select id="x-cat" class="text">${data.categories.map((c) => `<option value="${c.id}" ${c.id === v.catId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label class="label" for="x-sub">小カテゴリ</label>
        <select id="x-sub" class="text">${subOpts(v.catId, v.subId)}</select></div>
    </div>
    <p class="note">${isNew ? '今月の日付がもう過ぎている場合は、来月から記録されます。29〜31日にした場合、その日がない月は月末に記録されます。' : '変更はこれから記録される分に反映されます（これまでの記録はそのままです）。'}</p>
    <div class="actions">
      ${isNew ? '' : '<button class="btn danger" data-m="delete">削除</button>'}
      <button class="btn ghost" data-m="cancel">キャンセル</button>
      <button class="btn primary" data-m="save">保存</button>
    </div>
  </div>`;
  m.hidden = false;
  $('#x-cat').onchange = (e) => { $('#x-sub').innerHTML = subOpts(e.target.value, null); };
  $('#x-amount').oninput = (e) => {
    const d = e.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '').slice(0, 9);
    e.target.value = d ? Number(d).toLocaleString('ja-JP') : '';
  };
  m.onclick = (ev) => {
    if (ev.target === m) return closeSheet();
    const b = ev.target.closest('[data-m]');
    if (!b) return;
    const a = b.dataset.m;
    if (a === 'cancel') return closeSheet();
    if (a === 'delete') {
      if (!confirm(`固定費「${f.name}」を削除しますか？\nこれまでに記録された分は残ります。`)) return;
      data.fixed = data.fixed.filter((x) => x.id !== f.id);
      save();
      closeSheet();
      return toast('削除しました');
    }
    const name = $('#x-name').value.trim();
    const amount = parseInt($('#x-amount').value.replace(/[^0-9]/g, ''), 10);
    const day = Number($('#x-day').value);
    const catId = $('#x-cat').value;
    const subId = $('#x-sub').value || null;
    if (!name) return toast('名前を入力してください');
    if (!amount) return toast('金額を入力してください');
    if (!catId) return toast('カテゴリを選んでください');
    if (isNew) data.fixed.push({ id: uid(), name, amount, day, catId, subId, next: firstYmFor(day) });
    else Object.assign(f, { name, amount, day, catId, subId });
    save();
    const n = applyFixed();
    closeSheet();
    toast(n ? `保存して、${n}件記録しました` : '保存しました');
  };
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
  key(t) {
    const k = t.dataset.k;
    let a = st.form.amount;
    if (k === 'del') a = a.slice(0, -1);
    else if (k === 'clr') a = '';
    else {
      a = (a + k).replace(/^0+/, '');
      if (a.length > 9) return;
    }
    st.form.amount = a;
    const el = $('#amt');
    el.textContent = '¥' + (a ? Number(a).toLocaleString('ja-JP') : '0');
    el.classList.toggle('zero', !a);
  },
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
      stampSlip();
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
  'graph-cat'(t) { st.graphCat = t.dataset.id; render(); window.scrollTo(0, 0); },
  'graph-back'() { st.graphCat = null; render(); },
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
  'add-fixed'() { openFixedSheet(null); },
  'edit-fixed'(t) {
    const f = data.fixed.find((x) => x.id === t.dataset.id);
    if (f) openFixedSheet(f);
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
    if (!Array.isArray(data.fixed)) data.fixed = [];
    save();
    st.form = newForm();
    st.openCat = null;
    render();
    toast('読み込みました');
  } catch (e) {
    toast('このファイルは読み込めませんでした');
  }
});

const autoAdded = applyFixed();
render();
if (autoAdded) toast(`固定費を${autoAdded}件記録しました`);

// ホーム画面から戻ってきたときにも固定費をチェック
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const n = applyFixed();
  if (n) { render(); toast(`固定費を${n}件記録しました`); }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
