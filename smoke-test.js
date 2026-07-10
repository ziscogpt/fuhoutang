/* 冒烟测试:在 Node 中模拟最小浏览器环境,渲染所有路由 */
const fs = require('fs');

const fakeEl = () => ({
  innerHTML: '', classList: { add(){}, remove(){} },
  querySelector: () => fakeEl(), insertAdjacentHTML(){}, style: {},
  textContent: '', dataset: {}, value: '',
});
global.window = { addEventListener(){}, scrollTo(){} };
global.document = { getElementById: () => fakeEl() };
global.location = { hash: '', href: '' };
global.localStorage = { _d: {}, getItem(k){ return this._d[k] || null; }, setItem(k,v){ this._d[k]=v; }, removeItem(k){ delete this._d[k]; } };
global.navigator = {};
global.confirm = () => false;
window.scrollTo = () => {};
window.addEventListener = () => {};

const src = fs.readFileSync('docs/js/data.js', 'utf8') + '\n' + fs.readFileSync('docs/js/app.js', 'utf8')
  + '\nglobal.__t = { routes, App, DATA, getS: () => S };';
eval(src);
const { routes, App, DATA, getS } = global.__t;
const S = getS();

const routeNames = Object.keys(routes);
const paramsFor = {
  place: [['zhaimen'], ['babentang'], ['cangshulou'], ['yifangguan'], ['siyunguan'], ['jiyuan'], ['xilou']],
  source: [['ZGF-JS-0847'], ['ZGF-NP-0112'], ['ZGF-KS-0003'], ['ZGF-XX-9999']],
};

let fail = 0;
function tryRender(name, params) {
  try {
    const html = routes[name](params || [], {});
    if (typeof html !== 'string') throw new Error('non-string output');
    if (html.includes('undefined')) console.log(`  ⚠ ${name}(${(params||[]).join(',')}) 输出含 "undefined"`);
    console.log(`  ✓ ${name}(${(params||[]).join(',')})`);
  } catch (e) { fail++; console.log(`  ✗ ${name}(${(params||[]).join(',')}) → ${e.message}`); }
}

console.log('— 初始状态(未入园) —');
routeNames.forEach(n => (paramsFor[n] || [[]]).forEach(p => tryRender(n, p)));

console.log('— 入园 + 走满 + 订百日课 + 写信 + 对印 —');
App.enter();
App.demoWalkAll();
App.bairiOn();
S.bairi.log[1] = true;
S.letters.push({ id: 1, text: '妈:园子里人不多,我坐了一下午。', status: 'shipping', to: '王秀兰', dates: ['七月十日','七月十一日','七月十二日'], createdCn: '七月十日' });
S.letters.push({ id: 2, text: '爸:周末回家吃饭。', status: 'saved', createdCn: '七月十日' });
S.excerpts.push({ text: '凡世家子弟,衣食起居…', src: '咸丰六年九月廿九日 · 谕纪泽', rec: 'ZGF-JS-0847' });
S.orders.push({ title: '代寄一封', amount: 38, dateCn: '七月十日', status: '已付' });
S.sealMatched = true;
S.mode = 'post';
S.owned.shouzhairen = true; S.owned.qici = true; S.qiciChoice = 'A';
routeNames.forEach(n => (paramsFor[n] || [[]]).forEach(p => tryRender(n, p)));

console.log('— 问答引擎 —');
const qaHit = DATA.qa.find(i => i.keys.some(k => '他为什么不让孩子穿好衣服?'.includes(k)));
console.log(qaHit ? '  ✓ 问一问命中示例问题' : '  ✗ 问一问未命中示例问题') || (qaHit || fail++);
const sirHit = DATA.sir.find(i => i.keys.some(k => '我总怕孩子输在起跑线上'.includes(k)));
console.log(sirHit ? '  ✓ 问先生命中示例问题' : '  ✗ 问先生未命中示例问题') || (sirHit || fail++);

console.log(fail ? `\n共 ${fail} 处失败` : '\n全部通过');
process.exit(fail ? 1 : 0);
