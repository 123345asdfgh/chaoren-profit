(function () {
  'use strict';
  const core = DashboardCore;
  let data = {records: [], quality: [], fulfillmentAvailable: false, source: {categoryOptions: [], range: null, months: [], secondaryCount: 0}};
  let loaded = false;
  const palette = ['#e9a066', '#85a89a', '#edc77e', '#9aaec2', '#b39fbd', '#d69b96', '#82b8b3', '#b8aa8d'];
  let dates = [...new Set(data.records.map(record => record.date.slice(0, 10)))].sort();
  const latestDate = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Shanghai', year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const state = { mode: 'month', day: latestDate, month: latestDate.slice(0, 7), category: 'all' };
  const element = id => document.getElementById(id);
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const svgNode = (tag, attributes, text) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const number = value => value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const percent = value => value.toFixed(1) + '%';
  let categories = core.categoriesFromData(data.records, data.source.categoryOptions || []);
  let globalProducts = core.aggregate(data.records).products.map(row => row.name);
  let lastSyncText = '';
  const tierColor = name => palette[core.levels.includes(name) ? core.levels.indexOf(name) : 7];
  const productColor = name => palette[Math.max(0, globalProducts.indexOf(name)) % palette.length];
  let toastTimer;
  function toast(text) {
    element('toast').textContent = text;
    element('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element('toast').classList.remove('visible'), 4200);
  }
  function point(radius, degrees) {
    const radians = (degrees - 90) * Math.PI / 180;
    return [110 + radius * Math.cos(radians), 110 + radius * Math.sin(radians)];
  }
  function sectorPath(start, end) {
    const outer = 93;
    const inner = 59;
    if (end - start > 359.999) {
      return `M110 17 A93 93 0 1 1 110 203 A93 93 0 1 1 110 17 L110 51 A59 59 0 1 0 110 169 A59 59 0 1 0 110 51 Z`;
    }
    const first = point(outer, start);
    const second = point(outer, end);
    const third = point(inner, end);
    const fourth = point(inner, start);
    const large = end - start > 180 ? 1 : 0;
    return `M${first} A${outer} ${outer} 0 ${large} 1 ${second} L${third} A${inner} ${inner} 0 ${large} 0 ${fourth} Z`;
  }
  function renderChart(containerId, legendId, rows, total, label, colorFor) {
    const svg = svgNode('svg', { viewBox: '0 0 220 220', role: 'img', 'aria-label': label + (loaded ? '占比分布，总计' + number(total) : '，等待数据') });
    if (!total) svg.append(svgNode('circle', { cx: 110, cy: 110, r: 76, class: 'empty-ring' }));
    let start = 0;
    const labels = [];
    rows.filter(row => row.value > 0).forEach(row => {
      const end = start + row.percent * 3.6;
      const description = `${row.name}：${number(row.value)}，占比 ${percent(row.percent)}`;
      const path = svgNode('path', { d: sectorPath(start, end), fill: colorFor(row.name), tabindex: 0, 'aria-label': description });
      path.append(svgNode('title', {}, description));
      svg.append(path);
      if (row.percent >= 8) {
        const location = point(76, (start + end) / 2);
        labels.push(svgNode('text', { x: location[0], y: location[1], 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, percent(row.percent)));
      }
      start = end;
    });
    labels.forEach(node => svg.append(node));
    svg.append(svgNode('text', { x: 110, y: 108, 'text-anchor': 'middle', class: 'center-value' }, loaded ? number(total) : '—'));
    svg.append(svgNode('text', { x: 110, y: 129, 'text-anchor': 'middle', class: 'center-label' }, loaded ? (total ? label : '暂无数据') : '等待完整数据'));
    element(containerId).replaceChildren(svg);
    const legend = element(legendId);
    legend.replaceChildren();
    if (!loaded) {legend.append(make('p','empty-message','连接后显示真实统计')); return;}
    rows.forEach(row => {
      const item = make('div', 'legend-item' + (row.value ? '' : ' zero'));
      const dot = make('span', 'legend-dot');
      dot.style.background = colorFor(row.name);
      const name = make('span', 'legend-name', row.name);
      name.title = row.name;
      item.title = row.name + ' · ' + number(row.value) + ' · ' + percent(row.percent);
      item.append(dot, name, make('strong', '', percent(row.percent)));
      legend.append(item);
    });
    if (!rows.length) legend.append(make('p', 'empty-message', '当前筛选下暂无寄样记录'));
  }
  function renderRanking(id, rows, unit, colorFor) {
    const container = element(id);
    container.replaceChildren();
    if (!loaded) {container.append(make('p','empty-message','等待完整数据')); return;}
    core.sortCounts([...rows]).forEach((row, index) => {
      const wrapper = make('div', 'rank-row');
      const main = make('div', 'rank-main');
      const name = make('div', 'rank-name');
      const dot = make('span', 'legend-dot');
      dot.style.background = colorFor(row.name);
      const text = make('span', '', row.name);
      text.title = row.name;
      name.append(dot, text);
      const track = make('div', 'bar-track');
      const fill = make('div', 'bar-fill');
      fill.style.width = row.percent + '%';
      fill.style.background = colorFor(row.name);
      track.append(fill);
      main.append(name, track);
      const count = make('div', 'rank-count', number(row.value));
      count.append(make('small', '', unit));
      wrapper.append(make('span', 'rank-index', String(index + 1).padStart(2, '0')), main, count, make('span', 'rank-percent', percent(row.percent)));
      container.append(wrapper);
    });
    if (!rows.length) container.append(make('div', 'empty-message', '暂无数据，请更换日期或品类'));
  }
  function renderCategories() {
    const choices = [...categories, { id: 'all', name: '全部' }];
    const container = element('categories');
    container.replaceChildren();
    choices.forEach(category => {
      const button = make('button', 'category');
      button.type = 'button';
      button.dataset.category = category.id;
      button.setAttribute('aria-pressed', String(state.category === category.id));
      button.append(make('span', 'category-name', category.name), make('span', 'category-check', '✓'));
      button.addEventListener('click', () => {
        state.category = category.id;
        render();
        [...container.querySelectorAll('button')].find(node => node.dataset.category === category.id)?.focus({ preventScroll: true });
      });
      container.append(button);
    });
  }
  function render() {
    const period = state.mode === 'day' ? state.day : state.month;
    const options = { mode: state.mode, period, category: state.category };
    const records = core.filterRecords(data.records, options, categories);
    const {planned: result, shipped, unshipped} = core.sampling(records);
    renderCategories();
    element('creator-total').textContent = number(result.creators) + ' / ' + number(shipped.creators);
    element('quantity-total').textContent = number(shipped.quantity);
    element('product-total').textContent = number(shipped.productCount);
    const leaders = core.sortCounts([...shipped.tiers]).filter(row => row.value > 0 && row.value === Math.max(...shipped.tiers.map(tier => tier.value)));
    element('leading-tier').textContent = leaders.length ? leaders[0].name + (leaders.length > 1 ? ' 等' : '') : '—';
    element('leading-caption').textContent = leaders.length ? (leaders.length > 1 ? leaders.length + '个等级并列 · 各占 ' : '占实际寄样达人 ') + percent(leaders[0].percent) : '暂无已寄样达人';
    element('leading-tier').title = leaders.map(row => row.name).join(' / ');
    const periodLabel = state.mode === 'all' ? '全部日期' : state.mode === 'month' ? state.month.replace('-', '年') + '月' : state.day;
    const range = data.source.range;
    element('scope').textContent = loaded ? (range ? `${periodLabel} · 自动读取月份：${data.source.months.join('、')} · ${data.source.secondaryCount} 张二类表 · 一类表仅统计对应月份` : '暂无可用月份，请在「飞书连接」添加二类表格') : '自动识别已保存二类表的最新三个月';
    const fulfillment = core.fulfillment(records);
    element('fulfilled-total').textContent = loaded && data.fulfillmentAvailable ? number(fulfillment.actual) : '—';
    element('fulfillment-rate').textContent = loaded && data.fulfillmentAvailable && fulfillment.rate !== null ? percent(fulfillment.rate) : '—';
    element('fulfilled-caption').textContent = loaded && data.fulfillmentAvailable ? `应履约 ${number(fulfillment.due)} · 实际履约 ${number(fulfillment.actual)} 人次` : '暂无可用二类表';
    element('fulfillment-caption').textContent = fulfillment.due ? '同日同达人匹配 · 实际 ÷ 应履约' : '当前范围暂无应履约达人';
    if (!loaded) {
      element('creator-total').textContent = '— / —';
      ['quantity-total','product-total'].forEach(id => element(id).textContent = '—');
    }
    renderChart('tier-chart', 'tier-legend', shipped.tiers, shipped.creators, '已寄样达人 / 位', tierColor);
    renderChart('product-chart', 'product-legend', shipped.products, shipped.quantity, '已寄出数量 / 份', productColor);
    renderRanking('tier-rank', shipped.tiers, '位', tierColor);
    renderRanking('product-rank', shipped.products, '份', productColor);
    renderChart('unshipped-tier-chart', 'unshipped-tier-legend', unshipped.tiers, unshipped.creators, '未寄样达人 / 位', tierColor);
    renderChart('unshipped-product-chart', 'unshipped-product-legend', unshipped.products, unshipped.quantity, '未寄出数量 / 份', productColor);
    renderRanking('unshipped-tier-rank', unshipped.tiers, '位', tierColor);
    renderRanking('unshipped-product-rank', unshipped.products, '份', productColor);
    element('record-count').textContent = result.recordCount + ' 条';
    const table = element('records');
    table.replaceChildren();
    [...records].sort((first, second) => second.date.localeCompare(first.date) || first.creator.localeCompare(second.creator)).forEach(record => {
      const row = make('tr');
      const category = categories.find(item => item.source === record.category)?.name || record.category || '未标注';
      [record.date, record.creator || '未标注', record.level || '未标注', record.product, category, core.validQuantity(record) ? number(record.quantity) : '无效数量', record.shipped ? '已寄样' : '未寄样', !record.shipped ? '无需履约' : !data.fulfillmentAvailable ? '待核对' : record.fulfilled ? '已履约' : '未匹配履约'].forEach(value => row.append(make('td', '', value)));
      table.append(row);
    });
    if (!records.length) {
      const row = make('tr');
      const cell = make('td', 'empty-message', '暂无符合条件的记录');
      cell.colSpan = 8;
      row.append(cell);
      table.append(row);
    }
    const warnings = [...(data.quality || [])];
    if (shipped.invalidQuantity) warnings.push(`${shipped.invalidQuantity}条已寄样记录数量无效，未计入寄出数量`);
    if (unshipped.invalidQuantity) warnings.push(`${unshipped.invalidQuantity}条未寄样记录数量无效，未计入未寄出数量`);
    if (result.missingCreator) warnings.push(`${result.missingCreator}条缺少账号未计入达人人数`);
    element('quality').textContent = warnings.join('；');
  }
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(node => node.setAttribute('aria-pressed', String(node === button)));
    const input = element('period');
    input.type = state.mode === 'day' ? 'date' : 'month';
    input.value = state.mode === 'day' ? state.day : state.month;
    input.disabled = state.mode === 'all';
    input.parentElement.hidden = state.mode === 'all';
    element('period-label').textContent = state.mode === 'day' ? '选择日期' : '选择月份';
    render();
  }));
  element('period').value = state.month;
  element('period').addEventListener('change', event => {
    if (!event.target.value) {
      event.target.value = state.mode === 'day' ? state.day : state.month;
      return;
    }
    if (state.mode === 'day') state.day = event.target.value;
    else state.month = event.target.value;
    render();
  });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => element(button.dataset.close).close()));
  function renderSource() {
    const source = element('source-description'); source.replaceChildren();
    function paragraph(title,text) { source.append(make('h3','',title),make('p','',text)); }
    const range = data.source.range;
    paragraph('来源与范围', '自动使用当前用户已保存二类表中实际存在的最新三个月，不纳入未来月份，无需手动选择表格。一类表固定为「寄样统计表（天）」，只读取二类表对应月份的完整记录；月份不连续时也不会带入中间月份。' + (range ? `本次月份：${data.source.months.join('、')}，一类表已完整读取 ${data.records.length} 条。` : '暂无可用月份。'));
    paragraph('二类表与日期', '优先使用行内完整年月日；只有日数时，从文件本身的中文名称识别年月（不使用工作表名称）。文件只写月份时按最近一次该月份确定年份。合并日期空格沿用上一行。取实际可识别的最新三个不同月份，同月有多张表时自动合并并去重；无法识别的日期会明确提示。');
    if (data.source.secondaryNames?.length) paragraph('本次二类表', data.source.secondaryNames.join('、'));
    paragraph('寄样人数', '应寄样达人为当前周期、品类内一类表全部记录的去重账号数；实际寄样达人仅取已邮寄记录后去重。顶部按“应寄样 / 实际寄样”显示，缺少账号的记录不计入人数。');
    paragraph('图表统计', '已寄样与未寄样分别展示达人等级和产品分布。“产品寄出数量”“覆盖产品”和“主力达人等级”只统计已邮寄记录；未寄出的产品数量单独展示。各组按账号去重，等级取组内最近记录，产品按名称汇总组内有效数量，品类跟随飞书原表。');
    paragraph('寄样状态', '一类表「是否邮寄」识别为已邮寄的记录归入已寄样；其余记录（包括否、空白或未识别的填写内容）归入未寄样。同一达人若同时有已寄和未寄记录，会在两组分布中分别出现；顶部应寄样人数对全部账号去重，不将两组人数直接相加。履约人数按日期与账号计算，与这里的去重达人人数口径不同。');
    paragraph('履约口径', '一类表「是否邮寄」标记“是”的达人应履约；二类表「备注」含“直播”或“视频履约”算已履约，否定或待履约文字不计。必须同一天、同一达人匹配。重复产品、重复表格按日期与达人去重，不重复计数；人数按人次统计。履约率＝实际履约人次÷应履约人次。没有可用二类表或没有应履约人次时显示 —。');
    paragraph('读取状态', lastSyncText || '等待连接飞书。');
    if (data.source.fetchedAt) paragraph('最近成功读取', new Date(data.source.fetchedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}) + '（北京时间）');
    paragraph('权限与失败处理', '使用当前用户授权，只读访问飞书。首次打开及点击刷新时读取；任一表读取失败或不完整时保留上次成功数据，不将失败显示为零。二类表链接仍在「飞书连接」添加和保存。');
  }
  function syncStatus(text, stateName) {
    lastSyncText = text; element('sync-status').textContent = text; element('sync-status').dataset.state = stateName; renderSource();
  }
  async function api(endpoint, body) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 300000);
    try {
      const response = await fetch('/api/profit/creator-sampling/' + endpoint, {method: body === undefined ? 'GET' : 'POST', ...(body === undefined ? {} : {headers:{'content-type':'application/json'},body:JSON.stringify(body)}),credentials:'same-origin',cache:'no-store',signal:controller.signal});
      const result = await response.json(); if (!response.ok) throw new Error(result.error || '读取失败，请重试。'); return result;
    } catch(error) { if (error.name === 'AbortError') throw new Error('读取超时，请稍后重试。'); throw error; }
    finally {clearTimeout(timer);}
  }
  let syncBusy = false;
  function busy(value) { syncBusy = value; element('sync-now').disabled = value; }
  async function synchronize() {
    if (syncBusy) return false;
    busy(true); syncStatus('正在自动识别二类表月份并读取对应数据…', 'loading');
    try {
      const next = await api('read', {});
      if (!Array.isArray(next.records) || next.source?.hasMore !== false || !Array.isArray(next.source?.months)) throw new Error('未能确认表格读取完整，请重试。');
      data = next;
      const months = data.source.months;
      dates = [...new Set(data.records.map(record => record.date))].sort();
      if (months.length && (!loaded || !months.includes(state.month))) {
        state.month = months.at(-1); state.day = dates.at(-1) || state.month + '-01';
      }
      if (dates.length && !months.includes(state.day.slice(0,7))) state.day = dates.at(-1);
      element('period').value = state.mode === 'day' ? state.day : state.month;
      loaded = true;
      categories = core.categoriesFromData(data.records, data.source.categoryOptions || []);
      globalProducts = core.aggregate(data.records).products.map(row => row.name);
      if (state.category !== 'all' && !categories.some(c => c.id === state.category)) state.category = 'all';
      render();
      syncStatus(months.length ? '自动读取成功 · ' + months.join('、') + ' · ' + new Date(next.source.fetchedAt).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}) + '（北京时间）' : '暂无可用月份，请在「飞书连接」添加带有日期或中文月份文件名的二类表。', 'online');
      return true;
    } catch(error) {
      const message = error.message + (loaded ? ' 已保留上次成功数据。' : ' 请先在「飞书连接」登录并确认表格权限。');
      syncStatus(message, 'error'); return false;
    } finally { busy(false); }
  }
  element('sync-now').hidden = false; element('sync-now').textContent = '刷新数据 ↻';
  element('sync-now').addEventListener('click', () => synchronize());
  element('source-button').addEventListener('click', () => element('source-dialog').showModal());
  render(); syncStatus('正在连接飞书数据…','loading');
  void synchronize();
})();
