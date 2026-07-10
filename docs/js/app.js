/* ═══ 拙诚版·富厚堂 · 应用逻辑 ═══
   一个入口,五件事:逛 · 做 · 读 · 带 · 回
   全站无底部 Tab;在园的家是舆图(03),离园的家是行后首页(21)。 */

/* ───────── 状态 ───────── */
const STORE_KEY = 'fht_state_v1';

function defaultState() {
  return {
    entered: false,          // 是否已扫码入园
    enterDate: null,         // 入园日期 ISO
    mode: 'park',            // park 在园 | post 离园
    visited: [],             // 走到过的点位 id(含门房)
    rikeDone: [],            // 试一天 · 圈过的条目下标
    bairi: { on: false, start: null, log: {} },  // 百日课
    demoDayOffset: 0,        // 演示:时间快进
    letters: [],             // {id, text, to, tel, addr, status:'saved'|'shipping', dates:[], createdCn}
    excerpts: [],            // {text, src, rec}
    monthlyOn: true,         // 每月读半封
    orders: [],              // {title, amount, dateCn, status}
    reading: { idx: 1 },     // 电子书读到第几篇(pages 下标)
    owned: { shouzhairen: false, qici: false, lectures: [] },
    sealMatched: false,      // 对印
    qiciChoice: null,
    bookPlain: false,        // 电子书 原文/白话
    svcOpen: false,          // 服务栏展开
  };
}

let S = load();
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) {}
  return defaultState();
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }

/* ───────── 工具 ───────── */
const CN_D = ['〇','一','二','三','四','五','六','七','八','九'];
function cnNum(n) { // 1-99 → 汉字
  if (n <= 10) return ['零','一','二','三','四','五','六','七','八','九','十'][n];
  if (n < 20) return '十' + (n % 10 ? CN_D[n % 10] : '');
  const t = Math.floor(n / 10), o = n % 10;
  return CN_D[t] + '十' + (o ? CN_D[o] : '');
}
function cnDate(d) {
  d = d || new Date();
  return cnNum(d.getMonth() + 1) + '月' + cnNum(d.getDate()) + '日';
}
function cnYearDate(d) {
  d = d || new Date();
  const y = String(d.getFullYear()).split('').map(x => CN_D[+x]).join('');
  return `二〇二六年`.replace('二〇二六', y) + cnNum(d.getMonth() + 1) + '月' + cnNum(d.getDate()) + '日';
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* 拙字进度 */
function zhuoCount() { return Math.min(8, S.visited.length); }
function zhuoClip() { return `inset(0 ${(100 - zhuoCount() / 8 * 100).toFixed(1)}% 0 0)`; }
function zhuoLabel() { const z = zhuoCount(); return z >= 8 ? '八笔写满了' : `八笔写了${DATA.zNums[z]}笔`; }

/* 百日课:今天是第几天 */
function bairiDay() {
  if (!S.bairi.on || !S.bairi.start) return 0;
  const days = Math.floor((Date.now() - new Date(S.bairi.start).getTime()) / 86400000);
  return Math.max(1, days + 1 + S.demoDayOffset);
}
function bairiDoneCount() { return Object.keys(S.bairi.log).length; }

/* ───────── 通用组件 ───────── */
function capsule(dark) {
  return `<div class="capsule${dark ? ' dark' : ''}"><span>···</span><i></i><span>◎</span></div>`;
}

function tian(size, fz) {
  return `<div class="tian" style="width:${size}px; height:${size}px;">
    <span class="vx"></span><span class="hx"></span>
    <span class="z-ghost" style="font-size:${fz}px; line-height:${size}px;">拙</span>
    <span class="z-fill" style="font-size:${fz}px; line-height:${size}px; clip-path:${zhuoClip()};">拙</span>
  </div>`;
}

function audioBar(id, meta, line, margin) {
  return `<div class="audio" style="${margin || ''}" onclick="App.toggleAudio('${id}', this)" data-dur="${meta}">
    <div class="a-btn"><span class="tri"></span></div>
    <div class="a-body">
      <div class="a-meta">听这一处 · ${meta}</div>
      ${line ? `<div class="a-line">${line}</div>` : ''}
      <div class="a-prog"></div>
    </div>
  </div>`;
}

function colophon() {
  return `<div class="colophon">内容据《曾国藩全集》专题数据集,逐条可查</div>`;
}

function serviceBar() {
  if (S.svcOpen) {
    return `<div id="servicebar"><div class="sb-open">
      <div onclick="App.svc('卫生间')">卫生间</div>
      <div onclick="App.svc('寄存')">寄存</div>
      <div onclick="App.svc('饮水')">饮水</div>
      <div onclick="App.call()">求助</div>
      <div class="sb-fold" onclick="App.svcToggle()">收起</div>
    </div></div>`;
  }
  return `<div id="servicebar"><div class="sb-closed"><div onclick="App.svcToggle()">服务 ∧</div></div></div>`;
}

/* ───────── 路由 ───────── */
const routes = {};
function go(hash) { location.hash = hash; }

/* 自维护导航栈:让每一页都退得回去。
   - App.back(fallback):有来路就退一步;没有来路(直接打开的分享链接)退到兜底页。
   - goReplace:替换当前历史(入园、支付成功),避免"返回"回到落地页/已付款的下单页。 */
let navStack = [location.hash || '#'];
let replaceNext = false;
function goReplace(hash) {
  replaceNext = true;
  location.replace(location.href.split('#')[0] + '#' + hash);
}
function homeRoute() { return S.mode === 'park' ? 'map' : 'home'; }

function render() {
  clearAudio();
  let h = location.hash.replace(/^#\/?/, '');
  if (!h) {
    if (!S.entered) h = 'landing';
    else h = S.mode === 'park' ? 'map' : 'home';
  }
  const [pathQ, ] = h.split('?');
  const parts = pathQ.split('/');
  const name = parts[0];
  const view = routes[name] || routes['map'];
  const app = document.getElementById('app');
  app.innerHTML = view(parts.slice(1), parseQuery(h)) + serviceBar();
  window.scrollTo(0, 0);
}
function parseQuery(h) {
  const q = {}; const i = h.indexOf('?');
  if (i >= 0) h.slice(i + 1).split('&').forEach(kv => { const [k, v] = kv.split('='); q[k] = decodeURIComponent(v || ''); });
  return q;
}

/* 页内动作后的重渲染:保持滚动位置,不跳回页首 */
function rerender() {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

window.addEventListener('hashchange', () => {
  const h = location.hash || '#';
  const top = navStack[navStack.length - 1];
  if (replaceNext) { replaceNext = false; navStack[navStack.length - 1] = h; }
  else if (navStack.length >= 2 && navStack[navStack.length - 2] === h) navStack.pop(); // 后退(含系统返回键)
  else if (top !== h) navStack.push(h);
  render();
});

/* 问答对话(会话内暂存:跳去出处页再回来,话还在;关掉页面即散,不留档) */
const chats = { qa: [], sir: [] };

/* ───────── 音频模拟 ───────── */
let audioTimers = {};
function clearAudio() { Object.values(audioTimers).forEach(t => clearInterval(t.timer)); audioTimers = {}; }
function parseDur(s) { const m = s.match(/(\d+)′(\d+)″/); return m ? (+m[1]) * 60 + (+m[2]) : 120; }

/* ───────── 交互动作 ───────── */
const App = {
  /* 返回:优先退回来路;直接打开的链接没有来路,退到兜底页(默认当前状态的家) */
  back(fallback) {
    if (navStack.length > 1) history.back();
    else go(fallback || homeRoute());
  },

  /* 服务栏开合只更新自身,不重渲染整页(保住正在写的信、聊天记录、播放进度) */
  svcToggle() {
    S.svcOpen = !S.svcOpen; save();
    const sb = document.getElementById('servicebar');
    if (sb) sb.outerHTML = serviceBar();
  },
  svc(k) { toast(DATA.services[k]); },
  call() { toast(`拨打 ${DATA.phone} …`); setTimeout(() => { location.href = 'tel:0738'; }, 400); },

  enter() {
    S.entered = true; S.mode = 'park';
    if (!S.enterDate) S.enterDate = new Date().toISOString();
    save(); goReplace('map'); // 落地页只走一次,返回不再回到它
  },

  checkin(id) {
    if (!S.visited.includes(id)) {
      S.visited.push(id); save();
      const z = zhuoCount();
      toast(z >= 8 ? '八笔写满了。这个字,是走出来的。' : `你走到了。「拙」字添了一笔,共${DATA.zNums[z]}笔。`);
      rerender();
    }
  },

  toggleAudio(id, el) {
    const cur = audioTimers[id];
    if (cur) {
      clearInterval(cur.timer); delete audioTimers[id];
      el.querySelector('.a-btn').innerHTML = '<span class="tri"></span>';
      return;
    }
    const durS = parseDur(el.dataset.dur || '2′00″');
    const prog = el.querySelector('.a-prog');
    const meta = el.querySelector('.a-meta');
    const base = meta.textContent.split('·')[0].trim();
    let t = cur ? cur.t : 0;
    el.querySelector('.a-btn').innerHTML = '<span class="pausebars"><i></i><i></i></span>';
    audioTimers[id] = { t, timer: setInterval(() => {
      const a = audioTimers[id]; if (!a) return;
      a.t += 1;
      if (a.t >= durS) { clearInterval(a.timer); delete audioTimers[id]; prog.style.width = '100%';
        el.querySelector('.a-btn').innerHTML = '<span class="tri"></span>'; return; }
      prog.style.width = (a.t / durS * 100).toFixed(1) + '%';
      const mm = Math.floor(a.t / 60), ss = String(a.t % 60).padStart(2, '0');
      meta.textContent = `${base} · ${mm}′${ss}″ / ${el.dataset.dur}`;
    }, 1000) };
  },

  /* 试一天:自己圈 */
  rike(i) {
    const k = S.rikeDone.indexOf(i);
    if (k >= 0) S.rikeDone.splice(k, 1); else { S.rikeDone.push(i); }
    save(); rerender();
  },

  /* 百日课 */
  bairiOn() {
    if (!S.bairi.on) { S.bairi.on = true; S.bairi.start = new Date().toISOString(); save(); }
    go('bairi');
  },
  bairiDone() {
    const d = bairiDay();
    if (!S.bairi.log[d]) {
      S.bairi.log[d] = true; save();
      const pi = DATA.bairiPishu[d % DATA.bairiPishu.length];
      toast('先生批:' + pi.replace(/^.*批[::,]/, ''));
      rerender();
    }
  },

  /* 说件小事 */
  saveLetter(mode) {
    const ta = document.getElementById('lettertext');
    const text = ta ? ta.value.trim() : '';
    if (!text) { toast('写一句家里的小事,再存。'); return; }
    if (mode === 'save') {
      S.letters.push({ id: Date.now(), text, status: 'saved', createdCn: cnDate() });
      save(); toast('已存下。回家对上半印,还能再寄。');
    } else if (mode === 'share') {
      S.letters.push({ id: Date.now(), text, status: 'saved', createdCn: cnDate() });
      save();
      if (navigator.share) { navigator.share({ text: '【富厚堂 · 半封信】\n' + text }).catch(() => {}); }
      else toast('已存下。在微信里长按转发即可发给对方。');
    } else {
      const id = Date.now();
      S.letters.push({ id, text, status: 'saved', createdCn: cnDate() });
      S.pendingLetter = id; save(); go('checkout?type=letter&id=' + id);
    }
  },

  /* 摘录 */
  excerpt(text, src, rec) {
    S.excerpts.push({ text, src, rec }); save();
    toast('存这一段 · 已入摘录');
  },

  /* 电子书翻页 */
  bookNav(d) {
    const n = S.reading.idx + d;
    if (n < 0 || n >= DATA.book.pages.length) { toast(d > 0 ? '示例数据到这页为止' : '前面没有了'); return; }
    S.reading.idx = n; save(); rerender();
  },
  bookPlainToggle() { S.bookPlain = !S.bookPlain; save(); rerender(); },

  /* 支付(演示) */
  pay(amount, title, after) {
    showOverlay(`
      <div style="font-size:15px; font-weight:600;">微信支付</div>
      <div style="margin-top:16px; border:1.5px solid var(--ink); padding:16px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:14px;">${esc(title)}</span>
        <span style="font-size:22px; font-weight:700;">¥${amount}</span>
      </div>
      <div style="margin-top:14px; font-size:12px; color:var(--mut); line-height:1.9;">本地演示环境,不发生真实扣款。</div>
      <div style="margin-top:18px; display:flex; gap:12px;">
        <div class="btn-line" style="flex:1;" onclick="hideOverlay()">算了</div>
        <div class="btn-ink" style="flex:1.4; letter-spacing:2px;" onclick="App.payOk(${amount}, '${esc(title)}', '${after}')">确认支付 ¥${amount}</div>
      </div>`);
  },
  payOk(amount, title, after) {
    hideOverlay();
    S.orders.push({ title, amount, dateCn: cnDate(), status: '已付' });
    if (after === 'letter') {
      const l = S.letters.find(x => x.id === S.pendingLetter);
      if (l) {
        l.status = 'shipping';
        l.to = (document.getElementById('f-name') || {}).value || '家里人';
        const d = new Date();
        l.dates = [0, 1, 2].map(i => { const x = new Date(d.getTime() + i * 86400000); return cnDate(x); });
      }
      save(); goReplace('sent'); // 顶掉下单页,返回不会退回已付款的表单
    } else if (after === 'shouzhairen') { S.owned.shouzhairen = true; save(); rerender(); toast('全季已解锁'); }
    else if (after === 'qici') { S.owned.qici = true; save(); rerender(); toast('全本已解锁'); }
    else if (after === 'goods') { save(); toast('已下单。出园结账,也可寄到家。'); go('orders'); }
    else { save(); rerender(); toast('已付'); }
  },

  checkoutPay(type) {
    if (type === 'letter') {
      const name = (document.getElementById('f-name') || {}).value;
      if (!name || !name.trim()) { toast('先写收件人。'); return; }
      App.pay(38, '代寄一封 · 誊印装封 · 平信', 'letter');
    } else {
      App.pay(App._goodsPrice || 0, App._goodsTitle || '铺子货品', 'goods');
    }
  },

  buyGoods(id) {
    const g = DATA.goods.find(x => x.id === id);
    App._goodsPrice = g.priceNum; App._goodsTitle = g.name;
    App.pay(g.priceNum, g.name, 'goods');
  },

  /* 对印 */
  matchSeal() {
    if (!S.sealMatched) { S.sealMatched = true; save(); rerender(); toast('对上了。两个半印合成一方。'); }
  },
  duiyinSend() {
    const ta = document.getElementById('lettertext');
    const text = ta ? ta.value.trim() : '';
    if (!text) { toast('写点什么,再寄。'); return; }
    const id = Date.now();
    S.letters.push({ id, text, status: 'saved', createdCn: cnDate() });
    S.pendingLetter = id; save(); go('checkout?type=letter&id=' + id);
  },
  duiyinSave() {
    const ta = document.getElementById('lettertext');
    const text = ta ? ta.value.trim() : '';
    if (!text) { toast('还没写。'); return; }
    S.letters.push({ id: Date.now(), text, status: 'saved', createdCn: cnDate() });
    save(); toast('先存着。在「我的 · 我的信」里。');
  },

  monthlyToggle() { S.monthlyOn = !S.monthlyOn; save(); rerender(); toast(S.monthlyOn ? '已订 · 每月初一送达' : '已关 · 随时可再订'); },

  /* 问一问 / 问先生 */
  ask(kind, preset) {
    const input = document.getElementById('askinput');
    const q = preset || (input ? input.value.trim() : '');
    if (!q) return;
    if (input) input.value = '';
    const box = document.getElementById('chatbox');
    const meHtml = `<div class="bub-me">${esc(q)}</div>`;
    chats[kind].push(meHtml);
    box.insertAdjacentHTML('beforeend', meHtml);
    const pool = kind === 'sir' ? DATA.sir : DATA.qa;
    const hit = pool.find(item => item.keys.some(k => q.includes(k)));
    setTimeout(() => {
      let html;
      if (hit && kind === 'sir') {
        html = `<div class="bub-ai"><div style="padding:14px 16px;">
          <div class="kai" style="font-size:16px; line-height:2;">${hit.quote}</div>
          <div style="margin-top:8px; font-size:13px; color:var(--ink2); line-height:1.9;">${hit.talk}</div></div>
          <div class="ba-src" onclick="go('source/${hit.rec}')"><span>${hit.src}</span><span>${hit.rec} →</span></div></div>`;
      } else if (hit) {
        html = `<div class="bub-ai"><div class="ba-text">${hit.a}</div>
          <div class="ba-src" onclick="go('source/${hit.rec}')"><span>${hit.src}</span><span>${hit.rec} →</span></div></div>`;
      } else {
        const miss = kind === 'sir' ? DATA.sirMiss : DATA.qaMiss;
        html = `<div class="bub-ai" style="border-style:dashed; border-color:rgba(38,36,29,.4);"><div class="ba-text" style="color:var(--mut); font-size:12px;">${kind === 'sir' ? '"' + miss + '"' : miss}</div></div>`;
      }
      chats[kind].push(html);
      box.insertAdjacentHTML('beforeend', html);
      box.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 350);
  },

  qiciChoose(c) {
    S.qiciChoice = c; save(); rerender();
  },

  playEp(name, locked) {
    if (locked) { toast('这一集在全季里。'); return; }
    toast(`《${name}》播放中 · 演示环境无视频文件`);
  },

  saveCard() { toast('已存图(演示)。这个字,是走出来的。'); },
  shareCard() {
    if (navigator.share) navigator.share({ text: `【富厚堂 · 字卡】${cnYearDate()} · 八处走满。这个字,是走出来的。` }).catch(() => {});
    else toast('长按截图分享(演示)。');
  },

  routeHome() { toast('唤起外部地图 App(演示)· 停车场 P2 · 高速入口 8 公里'); },

  /* 演示控制 */
  demoMode() {
    S.mode = S.mode === 'park' ? 'post' : 'park';
    save(); go(S.mode === 'park' ? 'map' : 'home');
    toast(S.mode === 'park' ? '演示:你回到了园中' : '演示:你已离园。首页换成行后状态。');
  },
  demoDay() { S.demoDayOffset += 1; save(); rerender(); toast('演示:时间快进一天'); },
  demoWalkAll() {
    S.visited = PLACE_ORDER.slice(); save(); rerender(); toast('演示:八处走满');
  },
  demoReset() {
    if (confirm('清空全部体验数据,从门口重新开始?')) {
      localStorage.removeItem(STORE_KEY); S = load(); location.hash = ''; render();
    }
  },
  leavePark() {
    S.mode = 'post'; save(); go('home');
    toast('今天到这儿。路上慢些。');
  },
};

/* ───────── 弹层 ───────── */
function toast(msg) {
  const t = document.getElementById('toast');
  t.innerHTML = msg; t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}
function showOverlay(html) {
  const o = document.getElementById('overlay');
  o.querySelector('.ov-panel').innerHTML = html;
  o.classList.add('show');
}
function hideOverlay() { document.getElementById('overlay').classList.remove('show'); }

/* ═════════ 页面 ═════════ */

/* 01 · 扫码落地页 */
routes.landing = () => `
<div class="page" style="padding-bottom:0;">
  ${capsule()}
  <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;">
    <div class="serif" style="font-size:34px; font-weight:900; letter-spacing:6px;">富厚堂</div>
    <div style="margin-top:10px; font-size:13px; color:var(--ink2);">${cnDate()} · 你到园了</div>
    <div style="margin-top:44px; position:relative; width:190px; height:100px;">
      <div style="position:absolute; inset:0; border:1.5px solid var(--ink); background:var(--paper);"></div>
      <div style="position:absolute; top:29px; right:-2px; width:21px; height:42px; overflow:hidden;">
        <div style="width:42px; height:42px; border:2.5px solid var(--red); box-sizing:border-box; display:flex; align-items:center; justify-content:center;">
          <span class="serif" style="font-size:15px; color:var(--red); writing-mode:vertical-rl;">拙誠</span>
        </div>
      </div>
      <div style="position:absolute; left:16px; top:0; bottom:0; display:flex; align-items:center;">
        <span style="font-size:12px; color:var(--ink2); line-height:1.9;">这半个印,记你来过。<br>另一半在馆里。</span>
      </div>
    </div>
    <div style="margin-top:40px; background:var(--ink); color:var(--bg); padding:14px 52px; font-size:16px; letter-spacing:4px; cursor:pointer;" onclick="App.enter()">进园宅图</div>
    <div style="margin-top:12px; font-size:12px; color:var(--faint);">不用注册 · 离园后印还在,回来对得上</div>
  </div>
</div>`;

/* 03 · 体验态首页 · 舆图 */
routes.map = () => {
  const spots = MAP_SPOTS.map(s => {
    const p = DATA.places[s.id];
    const on = S.visited.includes(s.id);
    return `<div class="spot ${on ? 'on' : 'off'}" style="${s.style}" onclick="go('place/${s.id}')"><i></i><span>${p.name}</span></div>`;
  }).join('');
  const mfOn = S.visited.includes('menfang');
  return `
<div class="page">
  ${capsule()}
  <div class="pagehead">
    <div>
      <div class="h-title" style="line-height:1;">富厚堂</div>
      <div style="margin-top:8px; font-size:12px; color:var(--ink2);">你在园中 · 闭园 17:30</div>
    </div>
    <div style="display:flex; align-items:flex-end; gap:9px;">
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
        <span style="font-size:12px; color:var(--mut); padding:4px 2px; cursor:pointer;" onclick="go('me')">我的</span>
        <div style="display:flex; align-items:flex-end; gap:9px;">
          ${tian(46, 38)}
          <span style="font-size:11px; color:var(--ink2); writing-mode:vertical-rl; letter-spacing:2px; padding-bottom:2px;">${zhuoLabel()}</span>
        </div>
      </div>
    </div>
  </div>

  <div style="margin:12px 20px 0 20px; border:1px solid rgba(38,36,29,.35); padding:8px 14px; display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--ink2); cursor:pointer;" onclick="go('leave')">
    <span>闭园前一小时 · 离园清单</span><span>→</span>
  </div>

  <div class="mapbox">
    <div style="position:absolute; inset:20px 18px 52px 18px; border:1px solid rgba(38,36,29,.45);"></div>
    <div style="position:absolute; top:20px; bottom:52px; left:50%; width:1px; background:rgba(38,36,29,.18);"></div>
    <div style="position:absolute; left:18px; right:18px; top:118px; height:1px; background:rgba(38,36,29,.18);"></div>
    <div style="position:absolute; bottom:14px; left:50%; transform:translateX(-50%); width:118px; height:44px; border:1px solid rgba(38,36,29,.5); border-bottom:none; border-radius:118px 118px 0 0;"></div>
    <div style="position:absolute; bottom:30px; left:50%; transform:translateX(-50%); font-size:11px; color:var(--ink2);">半月塘</div>
    ${spots}
    <div class="spot ${mfOn ? 'on' : 'dash'}" style="top:92px; right:46px;" onclick="go('menfang')"><i></i><span>门房 · 原声</span></div>
  </div>

  <div class="four">
    <div onclick="go('letter')"><b>说件小事</b><small>写给家里</small></div>
    <div onclick="go('ask')"><b>问一问</b><small>句句有出处</small></div>
    <div onclick="go('day')"><b>试一天</b><small>日课四条</small></div>
    <div onclick="go('kids')"><b>任务卡</b><small>给孩子</small></div>
  </div>

  <div style="margin:12px 20px 0 20px; display:flex; gap:24px; font-size:12px; color:var(--mut);">
    <span style="cursor:pointer; padding:4px 0;" onclick="go('study')">书房 →</span>
    <span style="cursor:pointer; padding:4px 0;" onclick="go('shop')">铺子 →</span>
  </div>
  <div class="spacer"></div>
  ${colophon()}
</div>`;
};

/* 04 · 内容页(七处通用) */
routes.place = (params) => {
  const id = params[0];
  const p = DATA.places[id];
  if (!p) { go('map'); return ''; }
  const visited = S.visited.includes(id);
  const facts = p.facts.map((f, i) => `<div class="lg-row"><div class="lg-num">${['一','二','三'][i]}</div><div class="lg-txt">${f}</div></div>`).join('');
  return `
<div class="page">
  ${capsule()}
  <div class="back" onclick="go('map')">‹ 舆图</div>
  <div class="pagehead afterback" style="align-items:flex-start;">
    <div>
      <div class="h-title" style="font-size:32px;">${p.name}</div>
      <div class="h-sub" style="font-size:13px;">${p.sub}</div>
    </div>
    <span class="h-part" style="border-left:1px solid var(--ink); padding-left:8px; letter-spacing:4px; font-size:13px;">${p.part}</span>
  </div>

  <div class="ph" style="margin:18px 20px 0 20px; height:100px;"><span>${p.img}</span></div>

  <div class="ledger">${facts}</div>
  <div class="srcnote" onclick="go('source/${p.rec}')">${p.factsSrc} · 出处 →</div>

  ${audioBar('pl-' + id, p.audio.dur, p.audio.line)}

  <div style="margin:16px 20px 0 20px;">
    ${visited
      ? `<div style="display:flex; align-items:center; gap:10px; justify-content:center; padding:10px 0;">
           <span class="zhuquan" style="width:30px; height:30px; font-size:13px; transform:rotate(-4deg);">到</span>
           <span style="font-size:13px; color:var(--ink2);">你走到了这一处</span></div>`
      : `<div class="btn-line" onclick="App.checkin('${id}')">我到了这一处 · 落一笔</div>`}
  </div>

  <div class="spacer"></div>
  <div class="footact" style="margin-bottom:20px;">
    <div style="border:1.5px solid var(--ink); background:var(--paper); padding:13px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="go('ask')">
      <span style="font-size:14px; color:var(--mut);">问一问:关于这一处,想问什么?</span><span style="font-size:14px;">→</span>
    </div>
    <div style="margin-top:7px; text-align:center; font-size:11px; color:var(--faint);">白话作答,句句有出处 · 不编一个字</div>
  </div>
</div>`;
};

/* 15 · 门房 */
routes.menfang = () => {
  const visited = S.visited.includes('menfang');
  return `
<div class="page">
  ${capsule()}
  <div class="back" onclick="go('map')">‹ 舆图</div>
  <div style="padding:34px 20px 0 20px;">
    <div class="h-title" style="font-size:30px; letter-spacing:4px;">门房</div>
    <div style="margin-top:12px; font-size:14px; color:var(--ink2); line-height:2;">这一处没有讲解词。只有一段录音,守了三十年宅子的人讲的,有停顿,有咳嗽,一刀没剪。</div>
  </div>
  <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px;">
    ${audioBar('menfang', DATA.menfang.audio.dur, null, 'width:300px; margin:0;')}
    <div style="font-size:13px; color:var(--ink2);">原声 · ${DATA.menfang.audio.dur} · 未剪辑</div>
    <div class="mono" style="font-size:10px; color:var(--faint); cursor:pointer;" onclick="go('source/ZGF-KS-0003')">口述音档库 · ZGF-KS-0003 →</div>
    ${visited
      ? `<div style="display:flex; align-items:center; gap:10px;"><span class="zhuquan" style="width:30px; height:30px; font-size:13px; transform:rotate(-4deg);">到</span><span style="font-size:13px; color:var(--ink2);">你走到了这一处</span></div>`
      : `<div class="btn-line" style="padding:12px 40px;" onclick="App.checkin('menfang')">我到了这一处 · 落一笔</div>`}
  </div>
  <div style="padding:0 20px 40px 20px; text-align:center; font-size:12px; color:var(--faint);">听不清的地方,他讲的是方言。</div>
</div>`;
};

/* 05 · 说件小事 */
routes.letter = () => `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back('map')">‹ 返回</div>
  <div class="pagehead afterback">
    <div class="h-title">说件小事</div>
    <span class="h-part">家与信之部</span>
  </div>
  <div class="lede">他的家书不说漂亮话,只讲家里的小事。上半页是他的,下半页是你的。</div>

  <div class="letterpaper" style="margin:16px 20px 0 20px; flex:1; min-height:300px;">
    <div class="lp-in">
      <div class="serif" style="font-size:16px; line-height:2.1;">${DATA.letterTop.text}</div>
      <div style="margin-top:8px; font-size:11px; color:var(--faint); cursor:pointer;" onclick="go('source/${DATA.letterTop.rec}')">${DATA.letterTop.src} →</div>
      <div style="margin:16px 0 14px 0; border-top:1px solid var(--ink);"></div>
      <textarea id="lettertext" class="zc" rows="5" placeholder="也说一件家里的小事,别写祝福。"></textarea>
    </div>
  </div>

  <div class="act3">
    <div onclick="App.saveLetter('save')">存下</div>
    <div onclick="App.saveLetter('share')">发给对方</div>
    <div class="primary" onclick="App.saveLetter('send')">由富厚堂代寄</div>
  </div>
  <div style="padding:8px 22px 16px 22px; text-align:right; font-size:11px; color:var(--faint);">誊印装封 · 平信,不加急 · ¥38</div>
</div>`;

/* 06 · 试一天 */
routes.day = () => {
  const rows = DATA.rike.map((t, i) => {
    const done = S.rikeDone.includes(i);
    return `<div style="display:flex; align-items:stretch; border-bottom:1px solid var(--ink);">
      <div style="flex:1; padding:14px 16px;">
        <div style="font-size:15px; font-weight:600;">${t.name}</div>
        <div style="margin-top:4px; font-size:12px; color:var(--mut);">${t.note}</div>
      </div>
      <div style="width:64px; border-left:1px solid var(--ink); display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="App.rike(${i})">
        ${done
          ? '<span class="zhuquan" style="width:34px; height:34px; font-size:15px; transform:rotate(-4deg);">做</span>'
          : '<span style="width:34px; height:34px; border:1px solid rgba(38,36,29,.3); border-radius:50%;"></span>'}
      </div>
    </div>`;
  }).join('');
  return `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back('map')">‹ 返回</div>
  <div class="pagehead afterback">
    <div class="h-title">试一天</div>
    <span class="h-part">日课之部</span>
  </div>
  <div class="lede">他给自己立过十二条,每天照做,做了三十多年。这里挑了四条轻的,你在园里就能开始。做完自己圈,像他当年那样。</div>

  <div style="margin:18px 20px 0 20px; border:1.5px solid var(--ink);">
    ${rows}
    <div style="padding:10px 16px; font-size:12px; color:var(--mut); background:var(--band);">做不做随你,不催,不排名,不发通知。</div>
  </div>

  <div class="spacer"></div>
  <div style="margin:0 20px 16px 20px; border-top:2px solid var(--ink); padding-top:14px; display:flex; align-items:center; justify-content:space-between;">
    <div style="display:flex; align-items:baseline; gap:10px;">
      <span style="font-size:15px; font-weight:600;">百日课</span>
      <span style="font-size:12px; color:var(--mut);">回家后,每天一条原文,共一百天</span>
    </div>
    <span style="border:1.5px solid var(--ink); padding:7px 16px; font-size:13px; cursor:pointer;" onclick="App.bairiOn()">${S.bairi.on ? '已订 →' : '订'}</span>
  </div>
</div>`;
};

/* 07 · 百日课 */
routes.bairi = () => {
  if (!S.bairi.on) {
    return `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back()">‹ 返回</div>
  <div class="pagehead afterback"><div class="h-title">百日课</div></div>
  <div class="lede">每天一条他的原文,共一百天。断了不清零,不提醒,不排名。</div>
  <div style="margin:24px 20px 0 20px;" class="btn-ink" onclick="App.bairiOn()">订 · 从今天起</div>
  <div class="spacer"></div>${colophon()}
</div>`;
  }
  const day = bairiDay();
  const lesson = DATA.bairiLessons[(day - 1) % DATA.bairiLessons.length];
  const doneToday = !!S.bairi.log[day];
  const doneCount = bairiDoneCount();
  const missCount = Math.max(0, day - 1 - Object.keys(S.bairi.log).filter(d => +d < day).length);
  let dots = '';
  for (let d = 1; d <= 100; d++) {
    let st;
    if (d === day && !doneToday) st = 'border:1.5px solid #26241D; box-sizing:border-box; background:#F6F0E1;';
    else if (d > day) st = 'border:1px solid rgba(38,36,29,.18); box-sizing:border-box;';
    else if (S.bairi.log[d]) st = 'background:#A5382C;';
    else st = 'border:1px solid rgba(38,36,29,.35); box-sizing:border-box;';
    dots += `<span><span style="${st}"></span></span>`;
  }
  return `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back()">‹ 返回</div>
  <div class="pagehead afterback">
    <div class="h-title">百日课</div>
    <span class="mono" style="font-size:12px; color:var(--mut);">第${cnNum(day)}天</span>
  </div>

  <div style="margin:14px 20px 0 20px; border:1.5px solid var(--ink); padding:13px 16px;">
    <div class="kai" style="font-size:18px; line-height:1.8;">${lesson.quote}</div>
    <div style="margin-top:8px; font-size:13px; color:var(--ink2);">${lesson.task}</div>
    <div style="margin-top:6px; font-size:11px; color:var(--faint); cursor:pointer;" onclick="go('source/${lesson.rec}')">${lesson.tag} · 出处 →</div>
  </div>

  <div style="margin:12px 20px 0 20px;">
    <div class="hundred">${dots}</div>
    <div style="margin-top:12px; font-size:12px; color:var(--ink2); line-height:1.9;">做了${cnNum(doneCount)}天${missCount ? ',断了' + cnNum(missCount) + '天' : ''}。<br>断了就断了,接着来。不清零,不补圈。</div>
  </div>

  <div class="spacer"></div>
  ${doneToday
    ? `<div style="margin:0 20px 12px 20px; border:1.5px solid var(--red); color:var(--red); text-align:center; padding:13px 0; font-size:14px; letter-spacing:2px;">今天读完了 · 先生批:${DATA.bairiPishu[day % DATA.bairiPishu.length].split('批')[1].replace(/^[::,]/, '')}</div>`
    : `<div class="btn-ink" style="margin:0 20px 12px 20px;" onclick="App.bairiDone()">今天读完了</div>`}
  <div style="margin:0 20px; display:flex; align-items:center; gap:10px; justify-content:center;">
    <span class="zhuquan" style="width:20px; height:20px; font-size:10px; border-width:1.5px; transform:rotate(-5deg);">批</span>
    <span style="font-size:12px; color:var(--ink2);">读完后,先生批一句——出自他当天的日记。</span>
  </div>
  <div style="padding:6px 20px 16px 20px; text-align:center; font-size:11px; color:var(--faint);">不提醒,不排名。来了,就是今天。</div>
</div>`;
};

/* 08 · 离园态 */
routes.leave = () => {
  const full = zhuoCount() >= 8;
  return `
<div class="page">
  ${capsule()}
  <div class="back" onclick="go('map')">‹ 舆图</div>
  <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:24px;">
    ${tian(170, 140)}
    <div style="text-align:center;">
      <div style="font-size:15px;">${zhuoLabel()}</div>
      <div style="margin-top:10px; font-size:12px; color:var(--faint);">语出:天下之至拙,能胜天下之至巧 ·《曾国藩全集》</div>
    </div>
  </div>

  <div class="rows" style="margin-top:0;">
    <div class="row" onclick="App.routeHome()">
      <div><span class="r-main">回家路线</span><span class="r-note">停车场 P2 · 高速入口 8 公里</span></div><span>→</span>
    </div>
    <div class="row" onclick="go('duiyin')">
      <div><span class="r-main">半个印还在馆里</span><span class="r-note">回家后对上它,再寄一封</span></div><span>→</span>
    </div>
    ${full ? `<div class="row" onclick="go('card')">
      <div><span class="r-main">留一张字卡</span><span class="r-note">走满八处才有,可存可分享</span></div><span>→</span>
    </div>` : ''}
  </div>
  <div style="margin:16px 20px 0 20px;" class="btn-line" onclick="App.leavePark()">我离园了</div>
  <div style="padding:16px 20px 20px 20px; text-align:center; font-size:13px; color:var(--mut);">今天到这儿。路上慢些。</div>
</div>`;
};

/* 09 · 出处页 */
routes.source = (params) => {
  const rec = DATA.records[params[0]];
  const recNo = params[0];
  if (!rec) {
    return `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back()">‹ 返回</div>
  <div class="pagehead afterback"><div class="h-title" style="font-size:24px;">这条记录</div></div>
  <div class="lede">记录号 ${esc(recNo || '')} 在示例库里还没有收录全文。正式版逐条可查。</div>
  <div class="spacer"></div>${colophon()}
</div>`;
  }
  return `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back()">‹ 返回</div>
  <div style="padding:24px 20px 0 20px;">
    <div class="h-title" style="font-size:24px; letter-spacing:2px;">${rec.title}</div>
    <div class="mono" style="margin-top:8px; font-size:11px; color:var(--faint);">记录号 ${recNo}</div>
  </div>

  <div class="ph" style="margin:18px 20px 0 20px; height:130px;"><span>${rec.img}</span></div>

  <div class="reclayers">
    <div class="rl"><div class="rl-tag">原文</div><div class="rl-body kai" style="font-size:16px; line-height:1.9;">${rec.original}</div></div>
    <div class="rl"><div class="rl-tag">白话</div><div class="rl-body" style="font-size:14px; line-height:1.9;">${rec.plain}</div></div>
    <div class="rl"><div class="rl-tag">出处</div><div class="rl-body" style="font-size:13px; line-height:2; color:var(--ink2);">${rec.source}<br><span style="font-size:11px; color:var(--faint);">${rec.checked}</span></div></div>
  </div>

  ${rec.fullLen ? `<div style="margin:14px 20px 0 20px; display:flex; justify-content:space-between; align-items:center; border:1.5px solid var(--ink); padding:12px 16px; cursor:pointer;" onclick="App._openBook(${rec.bookPage})">
    <span style="font-size:14px;">这封信的全文</span>
    <span style="font-size:13px; color:var(--mut);">共 ${rec.fullLen} 字 →</span>
  </div>` : ''}

  <div class="spacer"></div>
  ${colophon()}
</div>`;
};
App._openBook = (page) => {
  const idx = DATA.book.pages.findIndex(p => p.page === page);
  if (idx >= 0) { S.reading.idx = idx; save(); }
  go('book');
};

/* 13 · 电子书 */
routes.book = () => {
  const pg = DATA.book.pages[S.reading.idx];
  return `
<div class="page">
  ${capsule()}
  <div style="padding:60px 20px 0 20px; display:flex; justify-content:space-between; align-items:center;">
    <span style="font-size:13px; color:var(--mut); cursor:pointer;" onclick="go('study')">‹ 书房</span>
    <span class="mono" style="font-size:11px; color:var(--faint);">${DATA.book.vol} · 第 ${pg.page} 页 / 共 ${DATA.book.total} 页</span>
  </div>

  <div class="letterpaper" style="margin:20px 20px 0 20px; flex:1; min-height:340px;">
    <div style="border:1px solid var(--ink); flex:1; padding:22px 20px; display:flex; flex-direction:column;">
      <div class="serif" style="font-size:13px; color:var(--faint); letter-spacing:2px;">${pg.head}</div>
      ${S.bookPlain
        ? `<div style="margin-top:16px; font-size:15px; line-height:2.1; color:var(--ink2);">${pg.plain.replace('白话:', '')}</div>`
        : `<div class="serif" style="margin-top:16px; font-size:17px; line-height:2.2;">${pg.text}</div>
           <div style="margin-top:18px; border-top:1px solid rgba(38,36,29,.25); padding-top:14px; font-size:13px; color:var(--ink2); line-height:2;">${pg.plain}</div>`}
      <div class="spacer"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--faint);">
        <span style="cursor:pointer; padding:3px 0;" onclick="App.bookPlainToggle()">${S.bookPlain ? '看原文' : '只看白话'} · 点此切换</span>
        <span style="border:1px solid rgba(38,36,29,.3); padding:3px 10px; cursor:pointer;" onclick="App.excerpt('${esc(pg.text).slice(0, 40).replace(/'/g, '')}…', '${esc(pg.head)}', '${pg.rec}')">存这一段</span>
      </div>
    </div>
  </div>

  <div style="margin:10px 20px 0 20px; display:flex; border:1.5px solid var(--ink);">
    <div style="flex:1; text-align:center; padding:11px 0; font-size:13px; border-right:1.5px solid var(--ink); cursor:pointer;" onclick="App.bookNav(-1)">‹ 上一篇</div>
    <div style="flex:1; text-align:center; padding:11px 0; font-size:13px; color:var(--mut); cursor:pointer;" onclick="go('source/${pg.rec}')">出处</div>
    <div style="flex:1; text-align:center; padding:11px 0; font-size:13px; border-left:1.5px solid var(--ink); cursor:pointer;" onclick="App.bookNav(1)">下一篇 ›</div>
  </div>

  <div style="margin:10px 20px 0 20px; border:1.5px solid var(--ink); display:flex; align-items:stretch;">
    <div style="flex:1; padding:12px 14px; border-right:1.5px solid var(--ink);">
      <div style="font-size:13px; font-weight:600;">这一册的纸书</div>
      <div style="margin-top:3px; font-size:11px; color:var(--mut);">岳麓书社定本 ¥128 · 寄到家</div>
    </div>
    <div style="width:88px; display:flex; align-items:center; justify-content:center; background:var(--ink); color:var(--bg); font-size:13px; cursor:pointer;" onclick="App.buyGoods('book')">买纸书</div>
  </div>
  <div style="padding:10px 22px 16px 22px; display:flex; justify-content:space-between; font-size:11px; color:var(--faint);">
    <span>电子书全文免费读 · 不限时</span>
    <span>读到哪,回来接着读</span>
  </div>
</div>`;
};

/* 14 · 问一问 */
routes.ask = () => `
<div class="page" style="padding-bottom:0;">
  ${capsule()}
  <div class="back" onclick="App.back()">‹ 返回</div>
  <div class="pagehead afterback">
    <div class="h-title" style="font-size:26px;">问一问</div>
    <span style="font-size:11px; color:var(--faint); cursor:pointer;" onclick="go('sir')">白话作答 · 句句有出处 · 也可换"问先生" →</span>
  </div>
  <div id="chatbox" class="chat" style="flex:1; overflow-y:auto;">
    ${chats.qa.length ? chats.qa.join('') : `<div class="chips">${DATA.qaChips.map(c => `<span onclick="App.ask('qa', '${c}')">${c}</span>`).join('')}</div>`}
  </div>
  <div class="askbar">
    <input id="askinput" placeholder="接着问" onkeydown="if(event.key==='Enter')App.ask('qa')">
    <div class="send" onclick="App.ask('qa')">问</div>
  </div>
  <div style="padding:0 20px 14px 20px; text-align:center; font-size:11px; color:var(--faint);">全集里没有的,它会说不知道。不编一个字。</div>
</div>`;

/* 20 · 问先生 */
routes.sir = () => `
<div class="page" style="padding-bottom:0;">
  ${capsule()}
  <div class="back" onclick="App.back('ask')">‹ 回去</div>
  <div style="padding:20px 20px 0 20px; display:flex; align-items:center; gap:14px;">
    <div style="width:64px; height:80px; flex:none; border:1.5px solid var(--ink); background:repeating-linear-gradient(0deg, transparent 0 10px, rgba(38,36,29,.12) 10px 11px); display:flex; align-items:center; justify-content:center;">
      <span class="mono" style="font-size:9px; color:var(--mut); text-align:center;">白描<br>坐像</span>
    </div>
    <div>
      <div class="h-title" style="font-size:26px;">问先生</div>
      <div style="margin-top:6px; font-size:12px; color:var(--ink2);">他只用自己说过的话回答你。信里日记里没有的,他会直说没有。</div>
    </div>
  </div>
  <div id="chatbox" class="chat" style="flex:1; overflow-y:auto;">
    ${chats.sir.length ? chats.sir.join('') : `<div class="chips">${DATA.sirChips.map(c => `<span onclick="App.ask('sir', '${c}')">${c}</span>`).join('')}</div>`}
  </div>
  <div class="askbar">
    <input id="askinput" placeholder="跟先生说件事" onkeydown="if(event.key==='Enter')App.ask('sir')">
    <div class="send" onclick="App.ask('sir')">说</div>
  </div>
  <div style="padding:0 20px 14px 20px; text-align:center; font-size:11px; color:var(--faint);">每句答话都出自他的信与日记 · 不奉承,不劝学,不编一个字</div>
</div>`;

/* 10 · 铺子 */
routes.shop = () => `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back()">‹ 返回</div>
  <div class="pagehead afterback">
    <div class="h-title">铺子</div>
    <span style="font-size:12px; color:var(--mut);">出园结账,也可寄到家</span>
  </div>
  <div class="goods">
    ${DATA.goods.map(g => `
    <div class="g-row" onclick="App.buyGoods('${g.id}')">
      <div class="g-img"><span>${g.img}</span></div>
      <div class="g-body">
        <div class="g-t"><b>${g.name}</b><span>${g.price}</span></div>
        <div class="g-d">${g.desc}</div>
      </div>
    </div>`).join('')}
  </div>
  <div style="margin:10px 22px 0 22px; font-size:12px; color:var(--faint);">每样只此一件,不出联名,不出盲盒。</div>
  ${zhuoCount() >= 8 ? `<div style="margin:14px 20px 0 20px; border:1.5px solid var(--red); padding:12px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="go('card')">
    <div><span style="font-size:14px; color:var(--red);">你的字卡</span><span style="font-size:12px; color:var(--mut); margin-left:10px;">走满八处才有 · 免费</span></div><span style="color:var(--red);">→</span>
  </div>` : ''}
  <div class="spacer"></div>
  <div style="margin:0 20px 16px 20px; border-top:2px solid var(--ink); padding-top:14px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="go('study')">
    <div style="display:flex; align-items:baseline; gap:10px;"><span style="font-size:15px; font-weight:600;">看和玩</span><span style="font-size:12px; color:var(--mut);">《七次》《守宅人》在这边</span></div>
    <span>→</span>
  </div>
</div>`;

/* 11 · 互动影游《七次》 */
routes.qici = () => {
  const q = DATA.qici;
  const chosen = S.qiciChoice;
  return `
<div class="page dark" style="padding-bottom:0;">
  ${capsule(true)}
  <div style="height:320px; position:relative; background:repeating-linear-gradient(45deg, rgba(241,234,217,.05) 0 8px, transparent 8px 16px); border-bottom:1.5px solid rgba(241,234,217,.35); display:flex; align-items:center; justify-content:center;">
    <span class="mono" style="font-size:10px; color:var(--mut);">实拍影像 · 道光十二年 · 发榜墙前</span>
    <div style="position:absolute; top:80px; left:20px;">
      <div class="serif" style="font-size:26px; font-weight:900; color:var(--bg); letter-spacing:4px;">七次</div>
      <div style="margin-top:6px; font-size:12px; color:var(--dim);">${q.ep}</div>
    </div>
    <div style="position:absolute; top:60px; left:20px; font-size:13px; color:var(--dim); cursor:pointer;" onclick="App.back('study')">‹ 回去</div>
  </div>

  <div style="padding:22px 20px 0 20px;">
    <div style="font-size:14px; color:var(--bg); line-height:2;">${q.scene}</div>
    <div style="margin-top:6px; font-size:12px; color:var(--mut); cursor:pointer;" onclick="go('source/${q.rec}')">此事见于年谱 · 记录号 ${q.rec} →</div>
  </div>

  <div style="margin:20px 20px 0 20px; display:flex; flex-direction:column; gap:10px;">
    <div style="border:2px solid ${chosen === 'A' ? 'var(--red)' : 'rgba(241,234,217,.35)'}; padding:14px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="App.qiciChoose('A')">
      <div>
        <div style="font-size:15px; color:var(--bg);">${q.choiceA.text}</div>
        <div style="margin-top:3px; font-size:11px; color:var(--dim);">${q.choiceA.note}</div>
      </div>
      ${chosen === 'A' ? '<span class="zhuquan" style="width:26px; height:26px; font-size:12px; transform:rotate(-4deg); flex:none;">选</span>' : ''}
    </div>
    <div style="border:${chosen === 'B' ? '2px solid var(--red)' : '1px solid rgba(241,234,217,.35)'}; padding:14px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="App.qiciChoose('B')">
      <div>
        <div style="font-size:15px; color:var(--dim);">${q.choiceB.text}</div>
        <div style="margin-top:3px; font-size:11px; color:var(--mut);">${q.choiceB.note}</div>
      </div>
      ${chosen === 'B' ? '<span class="zhuquan" style="width:26px; height:26px; font-size:12px; transform:rotate(-4deg); flex:none;">选</span>' : ''}
    </div>
  </div>
  ${chosen
    ? `<div style="margin:14px 22px 0 22px; font-size:13px; color:var(--dim); line-height:2; border-top:1px solid rgba(241,234,217,.25); padding-top:12px;">${chosen === 'A' ? q.afterA : q.afterB}</div>`
    : `<div style="margin:14px 22px 0 22px; font-size:11px; color:var(--mut); line-height:1.9;">怎么选都能看完这一集。但史实不改:第七次,他中了。你改不了结局,只能体会过程。</div>`}

  <div class="spacer"></div>
  <div style="border-top:1px solid rgba(241,234,217,.25); padding:12px 20px 30px 20px; display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--mut);">
    ${S.owned.qici
      ? '<span>全本已解锁 · 共七集</span>'
      : `<span style="cursor:pointer; border:1px solid rgba(241,234,217,.35); color:var(--dim); padding:8px 16px;" onclick="App.pay(30, '《七次》全本', 'qici')">全七集 · 单集 ¥12 · 全本 ¥30</span>`}
    <span>每个情节可查出处 →</span>
  </div>
</div>`;
};

/* 12 · 专题剧《守宅人》 */
routes.shouzhairen = () => {
  const eps = DATA.shouzhairen.map(e => {
    const locked = !e.free && !S.owned.shouzhairen;
    return `<div class="row" onclick="App.playEp('${e.name}', ${locked})">
      <div style="display:flex; align-items:baseline; gap:10px;">
        <span class="serif" style="font-size:14px;">${e.no}</span><span style="font-size:14px;">${e.name}</span>
        <span style="font-size:11px; color:var(--faint);">${e.note}</span>
      </div>
      <span class="r-side">${e.free ? '免费' : (S.owned.shouzhairen ? '已解锁' : '全季解锁')}</span>
    </div>`;
  }).join('');
  return `
<div class="page">
  ${capsule()}
  <div style="height:250px; position:relative; background:repeating-linear-gradient(45deg, rgba(38,36,29,.08) 0 8px, transparent 8px 16px); border-bottom:2px solid var(--ink); display:flex; align-items:center; justify-content:center;">
    <span class="mono" style="font-size:10px; color:var(--mut);">剧照 · 老周在藏书楼上锁</span>
    <div style="position:absolute; top:60px; left:20px; font-size:13px; color:var(--mut); cursor:pointer;" onclick="App.back('study')">‹ 回去</div>
    <div style="position:absolute; left:20px; bottom:20px;">
      <div class="serif" style="font-size:30px; font-weight:900; letter-spacing:4px;">守宅人</div>
      <div style="margin-top:6px; font-size:12px; color:var(--ink2);">纪实短剧 · 六集 · 每集十二分钟</div>
    </div>
  </div>
  <div style="padding:18px 20px 0 20px; font-size:13px; color:var(--ink2); line-height:2;">守了三十年宅子的人,讲这座宅子。没有解说词,没有配乐轰炸,他说到哪算哪。素材出自口述音档库。</div>
  <div class="rows" style="margin-top:16px;">${eps}</div>
  <div class="spacer"></div>
  ${S.owned.shouzhairen
    ? '<div style="margin:0 20px 12px 20px; border:1.5px solid var(--ink); text-align:center; padding:13px 0; font-size:14px; color:var(--ink2);">全季已解锁</div>'
    : `<div class="btn-ink" style="margin:0 20px 12px 20px; letter-spacing:3px;" onclick="App.pay(18, '《守宅人》全季', 'shouzhairen')">全季 ¥18</div>`}
  <div style="padding:0 20px 16px 20px; text-align:center; font-size:11px; color:var(--faint);">看过剧再来园里,门房那段原声,你会认得他的声音。</div>
</div>`;
};

/* 16 · 对印 */
routes.duiyin = () => {
  const matched = S.sealMatched;
  return `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back()">‹ 返回</div>
  <div style="padding:20px 20px 0 20px;">
    <div class="h-title">${matched ? '对上了' : '对印'}</div>
    <div style="margin-top:8px; font-size:13px; color:var(--ink2);">${matched ? '两个半印合成一方。它的最后一次用处:再寄一封。' : '你的半印随身带着,另一半在馆里。对上它,再寄一封。'}</div>
  </div>
  <div style="margin:24px 20px 0 20px; display:flex; justify-content:center;" ${matched ? '' : `onclick="App.matchSeal()"`}>
    <div style="display:flex; cursor:pointer;">
      <div style="width:118px; height:150px; border:1.5px solid var(--ink); background:var(--paper); position:relative; display:flex; align-items:center; justify-content:center;">
        <span style="font-size:11px; color:var(--faint);">你的半印</span>
        ${matched ? '' : `<div style="position:absolute; top:54px; right:-1px; width:21px; height:42px; overflow:hidden;"><div style="width:42px; height:42px; border:2.5px solid var(--red); box-sizing:border-box; display:flex; align-items:center; justify-content:center;"><span class="serif" style="font-size:14px; color:var(--red); writing-mode:vertical-rl;">拙誠</span></div></div>`}
      </div>
      <div style="width:118px; height:150px; border:1.5px dashed rgba(38,36,29,.4); border-left:none; background:var(--bg); position:relative; display:flex; align-items:center; justify-content:center;">
        <span style="font-size:11px; color:var(--faint);">馆里的存根</span>
        ${matched ? `<div style="position:absolute; top:54px; left:-21px; width:42px; height:42px; border:2.5px solid var(--red); background:var(--paper); display:flex; align-items:center; justify-content:center;"><span class="serif" style="font-size:14px; color:var(--red); writing-mode:vertical-rl;">拙誠</span></div>` : ''}
      </div>
    </div>
  </div>
  ${matched ? '' : '<div style="margin-top:10px; text-align:center; font-size:12px; color:var(--faint);">点一下,把两半对上。</div>'}

  <div class="letterpaper" style="margin:20px 20px 0 20px; flex:1; min-height:220px;">
    <div style="border:1px solid var(--ink); flex:1; padding:18px; position:relative; display:flex; flex-direction:column; background:repeating-linear-gradient(90deg, transparent 0 31px, rgba(38,36,29,.10) 31px 32px);">
      <div class="serif" style="font-size:15px; line-height:2.05;">此间一切如常。余每日早起,饭后仍写字一纸——</div>
      <div style="margin:14px 0 12px 0; border-top:1px solid var(--ink);"></div>
      <textarea id="lettertext" class="zc" rows="3" placeholder="上次在园里没说的,写在这儿。"></textarea>
      ${matched ? `<div style="position:absolute; bottom:16px; right:16px; width:66px; height:66px; border:1.5px solid rgba(38,36,29,.6); border-radius:50%; transform:rotate(-12deg); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px;">
        <span style="font-size:10px; color:var(--ink2); letter-spacing:2px;">富厚堂</span>
        <span style="width:34px; height:1px; background:rgba(38,36,29,.4);"></span>
        <span class="mono" style="font-size:8px; color:var(--mut);">${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, '0')}.${String(new Date().getDate()).padStart(2, '0')}</span>
      </div>` : ''}
    </div>
  </div>
  <div class="act3">
    <div class="primary" onclick="App.duiyinSend()">交富厚堂代寄</div>
    <div onclick="App.duiyinSave()">先存着</div>
  </div>
  <div style="padding:8px 22px 16px 22px; text-align:right; font-size:11px; color:var(--faint);">誊印装封 · 平信,不加急 · ¥38</div>
</div>`;
};

/* 17 · 每月读半封 */
routes.monthly = () => `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back('study')">‹ 返回</div>
  <div class="pagehead afterback">
    <div class="h-title">每月读半封</div>
    <span class="mono" style="font-size:12px; color:var(--mut);">${DATA.monthly.issue}</span>
  </div>
  <div class="letterpaper" style="margin:18px 20px 0 20px; flex:1; min-height:320px;">
    <div class="lp-in">
      <div class="serif" style="font-size:16px; line-height:2.1;">${DATA.monthly.text}</div>
      <div style="margin-top:10px; font-size:13px; color:var(--ink2); line-height:1.9;">${DATA.monthly.note}</div>
      <div class="mono" style="margin-top:6px; font-size:10px; color:var(--faint); cursor:pointer;" onclick="go('source/${DATA.monthly.rec}')">${DATA.monthly.rec} →</div>
      <div style="margin:16px 0 14px 0; border-top:1px solid var(--ink);"></div>
      <textarea class="zc" rows="3" placeholder="想写就写,不写也行"></textarea>
    </div>
  </div>
  <div style="margin:14px 20px 0 20px; border-top:2px solid var(--ink); padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
    <span style="font-size:12px; color:var(--mut);">每月初一送达 · 随时可关</span>
    <div style="display:flex; align-items:center; gap:10px;">
      <span style="font-size:13px;">${S.monthlyOn ? '已订' : '未订'}</span>
      <span class="switch ${S.monthlyOn ? '' : 'off'}" onclick="App.monthlyToggle()"><i></i></span>
    </div>
  </div>
  <div style="height:16px;"></div>
</div>`;

/* 18 · 字卡 */
routes.card = () => {
  if (zhuoCount() < 8) {
    return `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back()">‹ 返回</div>
  <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px;">
    ${tian(150, 124)}
    <div style="font-size:13px; color:var(--ink2);">${zhuoLabel()} · 还差${DATA.zNums[8 - zhuoCount()]}笔</div>
    <div style="font-size:11px; color:var(--faint);">没走满的人,没有这张卡。</div>
  </div>
</div>`;
  }
  return `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back()">‹ 返回</div>
  <div style="flex:1; display:flex; align-items:center; justify-content:center;">
    <div style="width:252px; background:var(--paper); border:2px solid var(--ink); padding:5px;">
      <div style="border:1px solid var(--ink); display:flex; flex-direction:column; align-items:center; padding:36px 22px 20px 22px;">
        <div style="position:relative; width:150px; height:150px; border:1.5px solid var(--ink);">
          <span style="position:absolute; left:50%; top:0; bottom:0; width:1px; background:rgba(165,56,44,.25);"></span>
          <span style="position:absolute; top:50%; left:0; right:0; height:1px; background:rgba(165,56,44,.25);"></span>
          <span class="kai" style="position:absolute; inset:0; font-size:124px; line-height:150px; text-align:center; color:var(--red);">拙</span>
        </div>
        <div style="margin-top:22px; font-size:11px; color:var(--ink2); letter-spacing:1px;">${cnYearDate()} · 富厚堂 · 八处走满</div>
        <div class="kai" style="margin-top:8px; font-size:12px; color:var(--faint);">这个字,是走出来的。</div>
      </div>
    </div>
  </div>
  <div style="margin:0 20px; display:flex; border:1.5px solid var(--ink);">
    <div style="flex:1; text-align:center; padding:13px 0; font-size:14px; border-right:1.5px solid var(--ink); cursor:pointer;" onclick="App.saveCard()">存图</div>
    <div style="flex:1; text-align:center; padding:13px 0; font-size:14px; background:var(--ink); color:var(--bg); cursor:pointer;" onclick="App.shareCard()">分享给朋友</div>
  </div>
  <div style="padding:10px 20px 16px 20px; text-align:center; font-size:11px; color:var(--faint);">没走满的人,没有这张卡。</div>
</div>`;
};

/* 19 · 任务卡 */
routes.kids = () => `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back('map')">‹ 回去</div>
  <div style="padding:24px 20px 0 20px;">
    <div class="h-title" style="font-size:30px;">任务卡</div>
    <div style="margin-top:8px; font-size:13px; color:var(--ink2);">做完一件,找穿蓝褂子的工作人员盖个小印。</div>
  </div>
  <div style="margin:20px 20px 0 20px; border:1.5px solid var(--ink);">
    <div style="display:flex; align-items:stretch; border-bottom:1px solid var(--ink);">
      <div style="flex:1; padding:16px;">
        <div style="font-size:16px; font-weight:600;">找一找</div>
        <div style="margin-top:4px; font-size:13px; color:var(--ink2);">半月塘的水里,有个什么在晃?</div>
      </div>
      <div style="width:72px; border-left:1px solid var(--ink); display:flex; align-items:center; justify-content:center;">
        <span style="width:40px; height:40px; border:2px solid var(--red); display:flex; align-items:center; justify-content:center; transform:rotate(-6deg);"><span class="serif" style="font-size:14px; color:var(--red);">塘</span></span>
      </div>
    </div>
    <div style="display:flex; align-items:stretch; border-bottom:1px solid var(--ink);">
      <div style="flex:1; padding:16px;">
        <div style="font-size:16px; font-weight:600;">数一数</div>
        <div style="margin-top:4px; font-size:13px; color:var(--ink2);">藏书楼的窗,一共有几扇?</div>
      </div>
      <div style="width:72px; border-left:1px solid var(--ink); display:flex; align-items:center; justify-content:center;">
        <span style="width:40px; height:40px; border:2px solid var(--red); display:flex; align-items:center; justify-content:center; transform:rotate(4deg);"><span class="serif" style="font-size:14px; color:var(--red);">楼</span></span>
      </div>
    </div>
    <div style="display:flex; align-items:stretch;">
      <div style="flex:1; padding:16px;">
        <div style="font-size:16px; font-weight:600;">听一听</div>
        <div style="margin-top:4px; font-size:13px; color:var(--ink2);">八本堂里,喊一声有回音吗?</div>
      </div>
      <div style="width:72px; border-left:1px solid var(--ink); display:flex; align-items:center; justify-content:center;">
        <span style="width:40px; height:40px; border:1.5px dashed rgba(38,36,29,.35); display:flex; align-items:center; justify-content:center;"><span style="font-size:12px; color:var(--dim);">印</span></span>
      </div>
    </div>
  </div>
  <div style="padding:14px 22px 0 22px; font-size:13px; color:var(--ink2);">盖满三个,出园时换一张书签。</div>
  <div class="spacer"></div>
  <div style="margin:0 20px 16px 20px; display:flex; align-items:center; gap:14px;">
    <div style="width:76px; height:52px; flex:none; background:repeating-linear-gradient(45deg, rgba(38,36,29,.08) 0 6px, transparent 6px 12px); border:1px solid var(--ink); display:flex; align-items:center; justify-content:center;"><span class="mono" style="font-size:9px; color:var(--mut);">集印册实拍</span></div>
    <div style="font-size:12px; color:var(--mut); line-height:1.8;">纸质任务卡在检票口领,<br>这里只是电子备份。</div>
  </div>
</div>`;

/* 21 · 行后首页 */
routes.home = () => {
  if (!S.entered) { go('landing'); return ''; }
  const d = bairiDay();
  const doneToday = d && S.bairi.log[d];
  const shipping = S.letters.filter(l => l.status === 'shipping').length;
  const pg = DATA.book.pages[S.reading.idx];
  const enterCn = S.enterDate ? cnDate(new Date(S.enterDate)) : '';
  return `
<div class="page">
  ${capsule()}
  <div class="pagehead">
    <div>
      <div class="h-title">富厚堂</div>
      <div style="margin-top:8px; font-size:12px; color:var(--ink2);">上次来:${enterCn} · 八处走了${DATA.zNums[zhuoCount()]}处</div>
    </div>
    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
      <span style="font-size:12px; color:var(--mut); padding:4px 2px; cursor:pointer;" onclick="go('me')">我的</span>
      ${tian(46, 38)}
    </div>
  </div>

  <div class="rows" style="margin-top:20px;">
    <div class="band">今天</div>
    <div class="row" onclick="go('bairi')">
      <div><span class="r-main"><b>百日课${S.bairi.on ? ' · 第' + cnNum(d) + '天' : ''}</b></span><span class="r-note">${S.bairi.on ? (doneToday ? '今天读完了' : '今天还没读') : '还没订 · 每天一条'}</span></div><span>→</span>
    </div>
    <div class="row" onclick="go('book')">
      <div><span class="r-main"><b>接着读</b></span><span class="r-note">${DATA.book.vol} · 第 ${pg.page} 页</span></div><span>→</span>
    </div>
  </div>

  <div class="rows">
    <div class="row" onclick="go('duiyin')">
      <div><span class="r-main">${S.sealMatched ? '印对上了' : '半个印还在馆里'}</span><span class="r-note">${S.sealMatched ? '再寄一封,随时' : '对上它,再寄一封'}</span></div><span>→</span>
    </div>
    <div class="row" onclick="go('sent')">
      <div><span class="r-main">你寄的信</span><span class="r-note">${shipping ? cnNum(shipping) + '封在路上' : (S.letters.length ? cnNum(S.letters.length) + '封存着' : '还没寄过')}</span></div><span>→</span>
    </div>
    <div class="row" onclick="go('study')">
      <div><span class="r-main">书房</span><span class="r-note">读的 听的 看的</span></div><span>→</span>
    </div>
    <div class="row" onclick="go('shop')">
      <div><span class="r-main">铺子</span><span class="r-note">纸书与信笺,寄到家</span></div><span>→</span>
    </div>
  </div>

  <div class="spacer"></div>
  <div style="padding:0 20px 16px 20px; text-align:center; font-size:12px; color:var(--faint);">再来的那天,这一页自己换回舆图。</div>
</div>`;
};

/* 22 · 书房目录 */
routes.study = () => {
  const pg = DATA.book.pages[S.reading.idx];
  return `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back()">‹ 返回</div>
  <div class="pagehead afterback">
    <div>
      <div class="h-title">书房</div>
      <div style="margin-top:8px; font-size:13px; color:var(--ink2);">读的、听的、看的,都从同一部全集里来。</div>
    </div>
  </div>

  <div style="margin:18px 20px 0 20px; border:1.5px solid var(--ink);">
    <div style="display:flex; align-items:stretch; border-bottom:1px solid var(--ink);">
      <div style="width:44px; border-right:1px solid var(--ink); display:flex; align-items:center; justify-content:center;"><span class="serif" style="font-size:13px; writing-mode:vertical-rl; letter-spacing:4px; color:var(--ink2);">读</span></div>
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:13px 14px; border-bottom:1px solid rgba(38,36,29,.3); cursor:pointer;" onclick="go('book')">
          <div><div style="font-size:15px; font-weight:600;">电子书 · 家书定本</div><div style="margin-top:2px; font-size:11px; color:var(--mut);">免费全文 · 读到第 ${pg.page} 页</div></div>
          <span style="font-size:12px; color:var(--mut);">接着读 →</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding:13px 14px; cursor:pointer;" onclick="go('monthly')">
          <div><div style="font-size:15px; font-weight:600;">每月读半封</div><div style="margin-top:2px; font-size:11px; color:var(--mut);">订阅 · ${DATA.monthly.issue.split(' · ')[0]}已到</div></div>
          <span style="font-size:12px; color:var(--mut);">→</span>
        </div>
      </div>
    </div>
    <div style="display:flex; align-items:stretch; border-bottom:1px solid var(--ink);">
      <div style="width:44px; border-right:1px solid var(--ink); display:flex; align-items:center; justify-content:center;"><span class="serif" style="font-size:13px; writing-mode:vertical-rl; letter-spacing:4px; color:var(--ink2);">听</span></div>
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:13px 14px; border-bottom:1px solid rgba(38,36,29,.3); cursor:pointer;" onclick="toast('播客第 12 期 · 播客 App 同步(演示)')">
          <div><div style="font-size:15px; font-weight:600;">播客 · 一封一封读</div><div style="margin-top:2px; font-size:11px; color:var(--mut);">每周一封 · 播客 App 同步</div></div>
          <span style="font-size:12px; color:var(--mut);">第 12 期 →</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding:13px 14px; cursor:pointer;" onclick="App.pay(9, '名家讲 · 单讲', 'lecture')">
          <div><div style="font-size:15px; font-weight:600;">名家讲</div><div style="margin-top:2px; font-size:11px; color:var(--mut);">林乾 · 谭伯牛 · 王开林,别人怎么讲他</div></div>
          <span style="font-size:12px; color:var(--mut);">每讲 ¥9</span>
        </div>
      </div>
    </div>
    <div style="display:flex; align-items:stretch;">
      <div style="width:44px; border-right:1px solid var(--ink); display:flex; align-items:center; justify-content:center;"><span class="serif" style="font-size:13px; writing-mode:vertical-rl; letter-spacing:4px; color:var(--ink2);">看</span></div>
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:13px 14px; border-bottom:1px solid rgba(38,36,29,.3); cursor:pointer;" onclick="go('shouzhairen')">
          <div><div style="font-size:15px; font-weight:600;">《守宅人》</div><div style="margin-top:2px; font-size:11px; color:var(--mut);">纪实短剧六集 · 前两集免费</div></div>
          <span style="font-size:12px; color:var(--mut);">${S.owned.shouzhairen ? '已解锁 →' : '全季 ¥18'}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding:13px 14px; cursor:pointer;" onclick="go('qici')">
          <div><div style="font-size:15px; font-weight:600;">《七次》</div><div style="margin-top:2px; font-size:11px; color:var(--mut);">互动影游七集 · 史实不可改</div></div>
          <span style="font-size:12px; color:var(--mut);">${S.owned.qici ? '已解锁 →' : '全本 ¥30'}</span>
        </div>
      </div>
    </div>
  </div>

  <div style="margin:14px 20px 0 20px; border:1.5px solid var(--ink); display:flex; justify-content:space-between; align-items:center; padding:12px 16px; cursor:pointer;" onclick="go('excerpts')">
    <div><span style="font-size:14px; font-weight:600;">我的摘录</span><span style="font-size:12px; color:var(--mut); margin-left:10px;">${S.excerpts.length ? '存下的' + cnNum(S.excerpts.length) + '段' : '还没存过'}</span></div>
    <span>→</span>
  </div>

  <div class="spacer"></div>
  ${colophon()}
</div>`;
};

/* 23 · 代寄下单 */
routes.checkout = (params, q) => {
  const letter = S.letters.find(l => l.id === +(q.id || 0)) || S.letters[S.letters.length - 1];
  const preview = letter ? letter.text.slice(0, 18) + (letter.text.length > 18 ? '……' : '') : '';
  return `
<div class="page">
  ${capsule()}
  <div style="padding:60px 20px 0 20px; display:flex; align-items:center; gap:12px; cursor:pointer;" onclick="App.back()">
    <span style="font-size:20px;">‹</span><span style="font-size:16px; font-weight:600;">由富厚堂代寄</span>
  </div>

  <div style="margin:22px 20px 0 20px; border:1.5px solid var(--ink); display:flex;">
    <div style="width:44px; border-right:1px solid var(--ink); display:flex; align-items:center; justify-content:center;"><span class="serif" style="font-size:13px; writing-mode:vertical-rl; letter-spacing:4px; color:var(--ink2);">这封信</span></div>
    <div style="flex:1; padding:13px 14px;">
      <div class="kai" style="font-size:14px; line-height:1.9; color:#3B382F;">${esc(preview)}</div>
      <div style="margin-top:6px; font-size:11px; color:var(--faint);">誊印在半封信笺上 · 上半页是他的原信</div>
    </div>
  </div>

  <div style="margin:14px 20px 0 20px; border:1.5px solid var(--ink);">
    <div style="background:var(--band); border-bottom:1.5px solid var(--ink); padding:9px 16px; font-size:12px; color:var(--ink2);">寄给谁</div>
    <div style="display:flex; border-bottom:1px solid rgba(38,36,29,.3);">
      <div style="width:90px; padding:13px 16px; font-size:14px; color:var(--mut); border-right:1px solid rgba(38,36,29,.3);">收件人</div>
      <input id="f-name" style="flex:1; padding:13px 16px; font-size:14px; border:none; outline:none; background:transparent; font-family:inherit;" placeholder="谁收">
    </div>
    <div style="display:flex; border-bottom:1px solid rgba(38,36,29,.3);">
      <div style="width:90px; padding:13px 16px; font-size:14px; color:var(--mut); border-right:1px solid rgba(38,36,29,.3);">电话</div>
      <input id="f-tel" style="flex:1; padding:13px 16px; font-size:14px; border:none; outline:none; background:transparent; font-family:inherit;" placeholder="联系电话">
    </div>
    <div style="display:flex;">
      <div style="width:90px; padding:13px 16px; font-size:14px; color:var(--mut); border-right:1px solid rgba(38,36,29,.3);">地址</div>
      <input id="f-addr" style="flex:1; padding:13px 16px; font-size:14px; border:none; outline:none; background:transparent; font-family:inherit;" placeholder="寄到哪">
    </div>
  </div>

  <div style="margin:14px 22px 0 22px; font-size:12px; color:var(--mut); line-height:2;">誊印装封,贴普票,三日内从荷叶镇邮局寄出。平信,不加急,一般七到十天到。</div>

  <div class="spacer"></div>
  <div style="margin:0 20px; border-top:2px solid var(--ink); padding-top:14px; display:flex; justify-content:space-between; align-items:center;">
    <div style="font-size:14px;">合计 <span style="font-size:20px; font-weight:700;">¥38</span></div>
    <div style="background:var(--ink); color:var(--bg); padding:13px 40px; font-size:15px; cursor:pointer;" onclick="App.checkoutPay('letter')">微信支付</div>
  </div>
  <div style="height:20px;"></div>
</div>`;
};

/* 24 · 寄出状态 / 我的信 */
routes.sent = () => {
  const shipping = S.letters.filter(l => l.status === 'shipping');
  const saved = S.letters.filter(l => l.status === 'saved');
  if (!S.letters.length) {
    return `
<div class="page">
  ${capsule()}
  <div style="padding:60px 20px 0 20px; display:flex; align-items:center; gap:12px; cursor:pointer;" onclick="App.back()">
    <span style="font-size:20px;">‹</span><span style="font-size:16px; font-weight:600;">你寄的信</span>
  </div>
  <div class="lede" style="margin-top:20px;">还没有信。在园里「说件小事」,或回家后「对印」,都能写。</div>
  <div class="spacer"></div>${colophon()}
</div>`;
  }
  const l = shipping[shipping.length - 1];
  return `
<div class="page">
  ${capsule()}
  <div style="padding:60px 20px 0 20px; display:flex; align-items:center; gap:12px; cursor:pointer;" onclick="App.back()">
    <span style="font-size:20px;">‹</span><span style="font-size:16px; font-weight:600;">你寄的信</span>
  </div>
  ${l ? `
  <div style="padding:26px 20px 0 20px;">
    <div class="h-title" style="font-size:26px;">在路上</div>
    <div style="margin-top:8px; font-size:13px; color:var(--ink2);">寄给${esc(l.to || '家里人')} · 平信</div>
  </div>
  <div class="rows" style="margin-top:20px;">
    <div class="row" style="cursor:default;"><div style="display:flex; align-items:center; gap:12px;"><span style="width:11px; height:11px; background:var(--ink); flex:none;"></span><span style="font-size:14px;">誊印好了</span></div><span class="r-side">${l.dates[0]}</span></div>
    <div class="row" style="cursor:default;"><div style="display:flex; align-items:center; gap:12px;"><span style="width:11px; height:11px; background:var(--ink); flex:none;"></span><span style="font-size:14px;">装封,贴了票</span></div><span class="r-side">${l.dates[1]}</span></div>
    <div class="row" style="cursor:default;"><div style="display:flex; align-items:center; gap:12px;"><span style="width:11px; height:11px; background:var(--ink); flex:none;"></span><span style="font-size:14px;">交给荷叶镇邮局</span></div><span class="r-side">${l.dates[2]}</span></div>
    <div class="row" style="cursor:default;"><div style="display:flex; align-items:center; gap:12px;"><span style="width:11px; height:11px; border:1.5px solid var(--ink); box-sizing:border-box; flex:none; background:var(--paper);"></span><span style="font-size:14px; color:var(--ink2);">在路上,一般七到十天</span></div><span class="r-side" style="color:var(--faint);">现在</span></div>
  </div>
  <div class="ph diag" style="margin:16px 20px 0 20px; height:130px;"><span>实拍 · 你这封信装封后的样子</span></div>
  <div style="margin:8px 22px 0 22px; font-size:11px; color:var(--faint);">交邮那天,馆里拍一张给你留底。</div>` : ''}
  ${saved.length ? `
  <div class="rows">
    <div class="band">存着的(${cnNum(saved.length)}封)</div>
    ${saved.map(s => `<div class="row" style="cursor:default;"><div><span class="r-main kai" style="font-size:13px; color:#3B382F;">${esc(s.text.slice(0, 16))}${s.text.length > 16 ? '…' : ''}</span></div><span class="r-side">${s.createdCn} 存</span></div>`).join('')}
  </div>` : ''}
  <div class="spacer"></div>
  <div style="padding:0 20px 16px 20px; text-align:center; font-size:12px; color:var(--faint);">平信,不加急。到了,收信的人自然知道。</div>
</div>`;
};

/* 25 · 我的 */
routes.me = () => {
  const shipping = S.letters.filter(l => l.status === 'shipping').length;
  const enterCn = S.enterDate ? cnYearDate(new Date(S.enterDate)) : '';
  const d = bairiDay();
  return `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back()">‹ 返回</div>
  <div style="padding:22px 20px 0 20px;" class="h-title">我的</div>

  <div style="margin:18px 20px 0 20px; border:1.5px solid var(--ink); background:var(--paper); position:relative; overflow:hidden; padding:16px;">
    <div style="font-size:14px; font-weight:600;">你来过 · ${enterCn || '还没到园'}</div>
    <div style="margin-top:5px; font-size:12px; color:var(--mut);">八处走了${DATA.zNums[zhuoCount()]}处 · ${S.sealMatched ? '印对上了' : '半个印还在馆里,随时可对'}</div>
    <div style="position:absolute; top:50%; right:${S.sealMatched ? '10px' : '-16px'}; transform:translateY(-50%); width:${S.sealMatched ? '64px' : '32px'}; height:64px; overflow:hidden;">
      <div style="width:64px; height:64px; border:2.5px solid var(--red); box-sizing:border-box; display:flex; align-items:center; justify-content:center;"><span class="serif" style="font-size:18px; color:var(--red); writing-mode:vertical-rl;">拙誠</span></div>
    </div>
  </div>

  <div class="rows">
    <div class="row" onclick="go('duiyin')"><span class="r-main">对印 · 再寄一封</span><span class="r-side">${S.sealMatched ? '已合一方 →' : '还没对 →'}</span></div>
    <div class="row" onclick="go('sent')"><span class="r-main">我的信</span><span class="r-side">${S.letters.length ? cnNum(S.letters.length) + '封' + (shipping ? ' · ' + cnNum(shipping) + '封在路上' : '') : '还没写'} →</span></div>
    <div class="row" onclick="go('excerpts')"><span class="r-main">我的摘录</span><span class="r-side">${S.excerpts.length ? cnNum(S.excerpts.length) + '段' : '还没存'} →</span></div>
    <div class="row" onclick="go('bairi')"><span class="r-main">百日课</span><span class="r-side">${S.bairi.on ? '第' + cnNum(d) + '天 · 做了' + cnNum(bairiDoneCount()) + '天' : '还没订'} →</span></div>
    <div class="row" onclick="go('monthly')"><span class="r-main">订阅</span><span class="r-side">每月读半封 · ${S.monthlyOn ? '已订' : '未订'} →</span></div>
    <div class="row" onclick="go('orders')"><span class="r-main">订单</span><span class="r-side">${S.orders.length ? cnNum(S.orders.length) + '笔 · 开发票' : '还没有'} →</span></div>
  </div>

  <div style="margin:14px 20px 0 20px; border:1.5px solid var(--ink); display:flex; justify-content:space-between; align-items:center; padding:13px 16px; cursor:pointer;" onclick="App.call()">
    <span style="font-size:14px;">有事找人</span>
    <span style="font-size:12px; color:var(--mut);">一点就拨 ${DATA.phone}</span>
  </div>

  <div style="margin:22px 20px 0 20px; border:1px dashed rgba(38,36,29,.4); padding:12px 16px;">
    <div style="font-size:11px; color:var(--faint); margin-bottom:8px;">演示控制(本地体验用,正式版没有这一块)</div>
    <div style="display:flex; flex-wrap:wrap; gap:8px; font-size:12px;">
      <span style="border:1px solid var(--ink); padding:6px 12px; cursor:pointer;" onclick="App.demoMode()">${S.mode === 'park' ? '切到:离园后' : '切到:在园中'}</span>
      <span style="border:1px solid var(--ink); padding:6px 12px; cursor:pointer;" onclick="App.demoDay()">时间快进一天</span>
      <span style="border:1px solid var(--ink); padding:6px 12px; cursor:pointer;" onclick="App.demoWalkAll()">八处走满</span>
      <span style="border:1px solid rgba(165,56,44,.6); color:var(--red); padding:6px 12px; cursor:pointer;" onclick="App.demoReset()">重置全部</span>
    </div>
  </div>

  <div class="spacer"></div>
  <div style="padding:0 20px 16px 20px; text-align:center; font-size:11px; color:var(--faint);">不用注册,这些都跟着你的微信走。</div>
</div>`;
};

/* 摘录列表 */
routes.excerpts = () => `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back('study')">‹ 返回</div>
  <div class="pagehead afterback"><div class="h-title" style="font-size:26px;">我的摘录</div></div>
  ${S.excerpts.length
    ? `<div class="rows">${S.excerpts.map(e => `
      <div class="row" style="align-items:flex-start; flex-direction:column; gap:6px;" onclick="go('source/${e.rec}')">
        <span class="serif" style="font-size:14px; line-height:1.9;">${esc(e.text)}</span>
        <span style="font-size:11px; color:var(--faint);">${esc(e.src)} · ${e.rec} →</span>
      </div>`).join('')}</div>`
    : '<div class="lede">还没存过。电子书里「存这一段」,就到这儿。</div>'}
  <div class="spacer"></div>${colophon()}
</div>`;

/* 订单列表 */
routes.orders = () => `
<div class="page">
  ${capsule()}
  <div class="back" onclick="App.back('me')">‹ 返回</div>
  <div class="pagehead afterback"><div class="h-title" style="font-size:26px;">订单</div></div>
  ${S.orders.length
    ? `<div class="rows">${S.orders.map(o => `
      <div class="row" style="cursor:default;">
        <div><span class="r-main">${esc(o.title)}</span><span class="r-note">${o.dateCn}</span></div>
        <span class="r-side">¥${o.amount} · ${o.status}</span>
      </div>`).join('')}</div>
      <div style="margin:10px 22px 0 22px; font-size:12px; color:var(--faint); cursor:pointer;" onclick="toast('开票申请已记下(演示)')">需要发票?点这里,开电子票。</div>`
    : '<div class="lede">还没有订单。</div>'}
  <div class="spacer"></div>${colophon()}
</div>`;

/* ───────── 启动 ───────── */
window.App = App;
window.go = go;
window.toast = toast;
window.hideOverlay = hideOverlay;
render();
