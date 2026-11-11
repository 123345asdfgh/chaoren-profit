(function () {
  'use strict';
  const core = DashboardCore;
  let data = {records: [], quality: [], fulfillmentAvailable: false, source: {categoryOptions: [], range: null, months: [], secondaryCount: 0}};
  let loaded = false;
  const palette = ['#e9a066', '#85a89a', '#edc77e', '#9aaec2', '#b39fbd', '#d69b96', '#82b8b3', '#b8aa8d'];
  let dates = [...new Set(data.records.map(record => record.date.slice(0, 10)))].sort();
  const latestDate = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Shanghai', year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const state = { mode: 'month', day: latestDate, month: latestDate.slice(0, 7), categories: null, product: '' };
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
  let searchableProducts = [];
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
    const choices = [{ id: 'all', name: '全部' }, ...categories];
    const container = element('categories');
    const selected = state.categories === null ? [] : state.categories;
    const selectedNames = categories.filter(category => selected.includes(category.id)).map(category => category.name);
    const selectionText = state.categories === null ? '全部品类' : selectedNames.join('、') || '未选择品类';
    element('category-display').textContent = selectionText;
    element('category-trigger').title = selectionText;
    container.replaceChildren();
    choices.forEach(category => {
      const label = make('label', 'category-checkbox');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'category-' + category.id;
      input.checked = category.id === 'all' ? state.categories === null : selected.includes(category.id);
      input.addEventListener('change', () => {
        if (category.id === 'all') state.categories = null;
        else {
          const next = new Set(selected);
          if (input.checked) next.add(category.id); else next.delete(category.id);
          state.categories = next.size ? [...next] : null;
        }
        render();
        element(input.id)?.focus({ preventScroll: true });
      });
      label.append(input, make('span', '', category.name));
      container.append(label);
    });
  }
  function matchingProducts(query) {
    const needle = String(query || '').trim().toLocaleLowerCase('zh-CN');
    if (!needle) return [];
    return searchableProducts.filter(name => name.toLocaleLowerCase('zh-CN').includes(needle));
  }
  function setProduct(product) {
    state.product = product || '';
    element('product-search').value = state.product;
    element('product-search-results').replaceChildren();
    element('product-search-results').hidden = true;
    element('clear-product').hidden = !state.product;
    element('product-search-status').textContent = state.product
      ? `当前仅显示商品“${state.product}”相关数据`
      : '未选择商品，显示当前日期与品类内的全部数据';
    render();
  }
  function renderProductSuggestions(query) {
    const container = element('product-search-results');
    container.replaceChildren();
    const matches = matchingProducts(query);
    if (!String(query || '').trim() || !matches.length) {
      container.hidden = true;
      return matches;
    }
    matches.slice(0, 12).forEach(product => {
      const button = make('button', 'product-search-option');
      button.type = 'button';
      button.textContent = product;
      button.addEventListener('click', () => setProduct(product));
      container.append(button);
    });
    container.hidden = false;
    return matches;
  }
  function render() {
    const period = state.mode === 'day' ? state.day : state.month;
    const options = { mode: state.mode, period, categories: state.categories, product: state.product };
    const records = core.filterRecords(data.records, options, categories);
    const {planned: result, shipped, unshipped} = core.sampling(records);
    renderCategories();
    renderPeriodControl();
    element('creator-total').textContent = number(result.creators) + ' / ' + number(shipped.creators);
    element('quantity-total').textContent = number(shipped.quantity);
    const costs = core.costStatistics(records), costNotes = [];
    element('cost-total').textContent = loaded && costs.hasValue ? '¥' + costs.totalRmb.toLocaleString('zh-CN', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—';
    if (costs.partial) costNotes.push('已知部分');
    if (costs.estimatedRows) costNotes.push('含暂估组合价');
    if (costs.missingPriceRows) costNotes.push(costs.missingPriceRows + '条缺少商品价格');
    if (costs.invalidQuantityRows) costNotes.push(costs.invalidQuantityRows + '条数量缺失');
    element('cost-caption').textContent = loaded ? costNotes.join(' · ') || '中国组合价 × 40% × 已寄出数量' : '中国组合价 × 40% × 已寄出数量';
    element('cost-total').title = 'Σ（商品表中国组合价 × 40% × 已寄出数量）' + (costs.partial ? '；不含缺少价格或有效数量的记录' : '');
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
    const warnings = state.product ? [] : [...(data.quality || [])];
    if (shipped.invalidQuantity) warnings.push(`${shipped.invalidQuantity}条已寄样记录数量无效，未计入寄出数量`);
    if (unshipped.invalidQuantity) warnings.push(`${unshipped.invalidQuantity}条未寄样记录数量无效，未计入未寄出数量`);
    if (result.missingCreator) warnings.push(`${result.missingCreator}条缺少账号未计入达人人数`);
    if (costs.missingPriceRows) warnings.push(`${costs.missingPriceRows}条已寄样记录缺少匹配商品或中国组合价，未计入成本`);
    element('quality').textContent = warnings.join('；');
  }
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(node => node.setAttribute('aria-pressed', String(node === button)));
    closePeriodCalendar();
    render();
  }));
  function closeCategoryDropdown(restoreFocus = false) {
    element('category-dropdown').hidden = true;
    element('category-trigger').setAttribute('aria-expanded', 'false');
    if (restoreFocus) element('category-trigger').focus();
  }
  element('category-trigger').addEventListener('click', () => {
    if (!element('category-dropdown').hidden) { closeCategoryDropdown(); return; }
    closePeriodCalendar();
    element('category-dropdown').hidden = false;
    element('category-trigger').setAttribute('aria-expanded', 'true');
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.category-picker')) closeCategoryDropdown();
  });
  element('category-trigger').addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (element('category-dropdown').hidden) element('category-trigger').click();
      element('categories').querySelector('input')?.focus();
    }
  });
  element('category-trigger').closest('.category-picker').addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeCategoryDropdown(true); }
  });
  let calendarYear = Number(state.month.slice(0, 4)), calendarMonth = Number(state.month.slice(5, 7)) - 1;
  const pad = value => String(value).padStart(2, '0');
  const calendarDate = value => value.getUTCFullYear() + '-' + pad(value.getUTCMonth() + 1) + '-' + pad(value.getUTCDate());
  function closePeriodCalendar(restoreFocus = false) {
    element('period-calendar').hidden = true;
    element('period-trigger').setAttribute('aria-expanded', 'false');
    if (restoreFocus) element('period-trigger').focus();
  }
  function choosePeriod(value) {
    if (state.mode === 'day') state.day = value; else state.month = value;
    closePeriodCalendar(true);
    render();
  }
  function renderPeriodControl() {
    const trigger = element('period-trigger');
    trigger.disabled = state.mode === 'all';
    trigger.setAttribute('aria-label', state.mode === 'day' ? '选择统计日期' : '选择统计月份');
    element('period-display').textContent = state.mode === 'all' ? '全部日期' : state.mode === 'day' ? state.day.replaceAll('-', ' / ') : state.month.replace('-', ' 年 ') + ' 月';
    if (!element('period-calendar').hidden) renderPeriodCalendar();
  }
  function renderPeriodCalendar() {
    const byDay = state.mode === 'day';
    const heading = element('period-calendar').querySelector('.period-calendar-heading');
    heading.classList.toggle('by-day', byDay);
    const year = element('period-year');
    year.replaceChildren();
    const years = [Number(latestDate.slice(0, 4)), calendarYear, ...data.source.months.map(month => Number(month.slice(0, 4)))];
    for (let value = Math.min(...years) - 5; value <= Math.max(...years) + 5; value++) {
      const option = make('option', '', value + ' 年'); option.value = String(value); year.append(option);
    }
    year.value = String(calendarYear);
    const month = element('period-month');
    month.hidden = !byDay;
    month.replaceChildren();
    for (let value = 0; value < 12; value++) { const option = make('option', '', (value + 1) + ' 月'); option.value = String(value); month.append(option); }
    month.value = String(calendarMonth);
    element('period-previous').setAttribute('aria-label', byDay ? '上个月' : '上一年');
    element('period-next').setAttribute('aria-label', byDay ? '下个月' : '下一年');
    element('period-weekdays').hidden = !byDay;
    const grid = element('period-calendar-grid');
    grid.classList.toggle('by-day', byDay);
    grid.setAttribute('aria-label', byDay ? '选择日期' : '选择月份');
    grid.replaceChildren();
    const available = new Set(byDay ? dates : data.source.months);
    const selected = byDay ? state.day : state.month;
    const first = new Date(Date.UTC(calendarYear, calendarMonth, 1));
    first.setUTCDate(1 - (first.getUTCDay() + 6) % 7);
    for (let index = 0; index < (byDay ? 42 : 12); index++) {
      const day = new Date(first); day.setUTCDate(first.getUTCDate() + index);
      const value = byDay ? calendarDate(day) : calendarYear + '-' + pad(index + 1);
      const button = make('button', 'period-calendar-cell', byDay ? String(day.getUTCDate()) : (index + 1) + '月');
      button.type = 'button'; button.dataset.value = value;
      button.setAttribute('aria-label', value);
      button.setAttribute('aria-pressed', String(value === selected));
      if (value === (byDay ? latestDate : latestDate.slice(0, 7))) button.setAttribute('aria-current', 'date');
      if (byDay && day.getUTCMonth() !== calendarMonth) button.classList.add('outside-month');
      if (available.has(value)) button.classList.add('has-data');
      button.addEventListener('click', () => choosePeriod(value));
      grid.append(button);
    }
    element('period-latest').disabled = !(byDay ? dates.length : data.source.months.length);
  }
  element('period-trigger').addEventListener('click', () => {
    if (!element('period-calendar').hidden) { closePeriodCalendar(); return; }
    closeCategoryDropdown();
    const selected = state.mode === 'day' ? state.day : state.month;
    calendarYear = Number(selected.slice(0, 4)); calendarMonth = Number(selected.slice(5, 7)) - 1;
    element('period-calendar').hidden = false;
    element('period-trigger').setAttribute('aria-expanded', 'true');
    renderPeriodCalendar();
    (element('period-calendar-grid').querySelector('[aria-pressed="true"]') || element('period-year')).focus();
  });
  for (const [id, step] of [['period-previous', -1], ['period-next', 1]]) element(id).addEventListener('click', () => {
    if (state.mode === 'day') {
      const next = new Date(Date.UTC(calendarYear, calendarMonth + step, 1));
      calendarYear = next.getUTCFullYear(); calendarMonth = next.getUTCMonth();
    } else calendarYear += step;
    renderPeriodCalendar();
  });
  element('period-year').addEventListener('change', event => { calendarYear = Number(event.target.value); renderPeriodCalendar(); });
  element('period-month').addEventListener('change', event => { calendarMonth = Number(event.target.value); renderPeriodCalendar(); });
  element('period-latest').addEventListener('click', () => {
    const value = state.mode === 'day' ? dates.at(-1) : data.source.months.at(-1);
    if (value) choosePeriod(value);
  });
  element('period-calendar').addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closePeriodCalendar(true); return; }
    const columns = state.mode === 'day' ? 7 : 3;
    const step = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns}[event.key];
    if (step === undefined || !event.target.classList.contains('period-calendar-cell')) return;
    event.preventDefault();
    const buttons = [...element('period-calendar-grid').children];
    buttons[(buttons.indexOf(event.target) + step + buttons.length) % buttons.length].focus();
  });
  document.addEventListener('click', event => { if (!event.target.closest('.period-picker')) closePeriodCalendar(); });
  element('product-search').addEventListener('input', event => {
    if (!event.target.value.trim()) { setProduct(''); return; }
    renderProductSuggestions(event.target.value);
  });
  element('product-search-form').addEventListener('submit', event => {
    event.preventDefault();
    const query = element('product-search').value.trim();
    if (!query) { setProduct(''); return; }
    const matches = matchingProducts(query);
    const exact = matches.find(product => product === query);
    if (exact) { setProduct(exact); return; }
    if (matches.length === 1) { setProduct(matches[0]); return; }
    if (matches.length > 1) {
      renderProductSuggestions(query);
      element('product-search-status').textContent = `找到 ${matches.length} 个商品，请从下方选择一个`;
      return;
    }
    element('product-search-status').textContent = '没有找到匹配的商品，请检查名称后重试';
  });
  element('clear-product').addEventListener('click', () => setProduct(''));
  document.addEventListener('click', event => {
    if (!event.target.closest('.product-search-form')) element('product-search-results').hidden = true;
  });
  element('product-search').addEventListener('keydown', event => {
    if (event.key === 'Escape') element('product-search-results').hidden = true;
    if (event.key === 'ArrowDown' && !element('product-search-results').hidden) {
      event.preventDefault();
      element('product-search-results').querySelector('button')?.focus();
    }
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
    paragraph('商品筛选', '输入商品名称并选择对应商品后，人数、数量、成本、履约、图表及明细均只统计该商品，同时保留日期与品类筛选。品类支持同时勾选多个，勾选“全部”恢复全部品类。清空搜索或点击“查看全部商品”可恢复全部商品。未寄样的两组分布默认收起，点击标题展开。');
    paragraph('寄样状态', '一类表「是否邮寄」识别为已邮寄的记录归入已寄样；其余记录（包括否、空白或未识别的填写内容）归入未寄样。同一达人若同时有已寄和未寄记录，会在两组分布中分别出现；顶部应寄样人数对全部账号去重，不将两组人数直接相加。履约人数按日期与账号计算，与这里的去重达人人数口径不同。');
    paragraph('寄样成本', '成本（人民币）＝Σ（商品表中国组合价 × 40% × 已寄出数量）。按一类表商品名称匹配测算商品表，忽略首尾空格、连续空格和英文大小写，不作模糊猜测。只统计当前日期、品类下已邮寄的记录；缺少商品名称、组合价或有效数量时不填零、不计入金额，并标注为已知部分。40%为固定比例，不取测算配置中的成本比例。后台每次核对时同时检查商品表价格，价格变化只更新受影响的记录。');
    paragraph('暂估价格', '当前商品表中为补齐成本演示而新增的中国组合价属于暂估数据，不代表真实采购价。成本卡片会显示“含暂估组合价”。可在跨境测算的商品表中找到 TEMP-COST- 开头的规格编码，点击修改，填写真实中国组合价并保存商品；后台下次核对后使用新价格，也可点击“检查更新”提前核对。');
    paragraph('履约口径', '一类表「是否邮寄」标记“是”的达人应履约；二类表「备注」含“直播”或“视频履约”算已履约，否定或待履约文字不计。必须同一天、同一达人匹配。重复产品、重复表格按日期与达人去重，不重复计数；人数按人次统计。履约率＝实际履约人次÷应履约人次。没有可用二类表或没有应履约人次时显示 —。');
    paragraph('读取状态', lastSyncText || '等待连接飞书。');
    if (data.source.fetchedAt) paragraph('最近成功读取', new Date(data.source.fetchedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}) + '（北京时间）');
    paragraph('缓存与更新', '页面直接读取当前用户的 Redis 缓存，不等待飞书扫描。后台每 10 分钟核对一次表格，按记录比较新增、修改和删除，只写入变化的数据；点击“检查更新”可立即安排后台核对。页面会自动读取新的缓存。首次尚无缓存时由后台初始化。');
    paragraph('权限与失败处理', '使用当前用户授权，只读访问飞书。任一表读取失败或不完整时保留上次成功缓存，不将失败显示为零；退出飞书后停止读取该账号的缓存。二类表链接仍在「飞书连接」添加和保存。');
  }
  function syncStatus(text, stateName) {
    lastSyncText = text; element('sync-status').textContent = text; element('sync-status').dataset.state = stateName; renderSource();
  }
  async function api(endpoint, body) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/profit/creator-sampling/' + endpoint, {method: body === undefined ? 'GET' : 'POST', ...(body === undefined ? {} : {headers:{'content-type':'application/json'},body:JSON.stringify(body)}),credentials:'same-origin',cache:'no-store',signal:controller.signal});
      const result = await response.json(); if (!response.ok) throw new Error(result.error || '读取失败，请重试。'); return result;
    } catch(error) { if (error.name === 'AbortError') throw new Error('读取超时，请稍后重试。'); throw error; }
    finally {clearTimeout(timer);}
  }
  let syncBusy = false;
  let cacheTimer, lastCacheChange = '';
  function pollCache(delay) {
    clearTimeout(cacheTimer);
    cacheTimer = setTimeout(() => { if (!document.hidden) void synchronize(); else pollCache(60000); }, delay);
  }
  function busy(value) { syncBusy = value; element('sync-now').disabled = value; }
  async function synchronize(force = false) {
    if (syncBusy) return false;
    busy(true);
    if (!loaded) syncStatus('正在读取缓存…', 'loading');
    try {
      if (force) await api('refresh', {});
      const next = await api('data');
      if (!next.cache?.ready) {
        syncStatus(next.cache?.error || '首次缓存正在后台准备，完成后自动显示…', next.cache?.error ? 'error' : 'loading');
        pollCache(next.cache?.error ? 60000 : 3000); return false;
      }
      if (!Array.isArray(next.records) || next.source?.hasMore !== false || !Array.isArray(next.source?.months)) throw new Error('未能确认表格读取完整，请重试。');
      data = next;
      const months = data.source.months;
      if (!loaded || lastCacheChange !== next.cache.lastChangedAt) {
      dates = [...new Set(data.records.map(record => record.date))].sort();
      if (months.length && (!loaded || !months.includes(state.month))) {
        state.month = months.at(-1); state.day = dates.at(-1) || state.month + '-01';
      }
      if (dates.length && !months.includes(state.day.slice(0,7))) state.day = dates.at(-1);
      loaded = true;
      categories = core.categoriesFromData(data.records, data.source.categoryOptions || []);
      globalProducts = core.aggregate(data.records).products.map(row => row.name);
      searchableProducts = [...new Set(data.records.map(record => record.product).filter(name => typeof name === 'string' && name.trim()))].sort((a,b) => a.localeCompare(b,'zh-CN'));
      if (state.product && !searchableProducts.includes(state.product)) setProduct('');
      if (state.categories !== null) state.categories = state.categories.filter(id => categories.some(category => category.id === id));
      if (state.categories?.length === 0) state.categories = null;
      render();
      lastCacheChange = next.cache.lastChangedAt;
      }
      const checkedAt = new Date(next.cache.lastCheckedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
      const status = next.cache.error ? '缓存数据 · 后台核对失败：' + next.cache.error + ' 已保留上次成功数据。'
        : next.cache.checking || force ? '当前显示缓存 · 后台正在核对表格差异…'
        : months.length ? '缓存数据 · 最近核对 ' + checkedAt + '（北京时间）· 每 10 分钟自动更新'
        : '暂无可用月份，请在「飞书连接」添加带有日期或中文月份文件名的二类表。';
      syncStatus(status, next.cache.error ? 'error' : 'online');
      pollCache(next.cache.checking || force ? 3000 : 60000);
      return true;
    } catch(error) {
      const message = error.message + (loaded ? ' 已保留上次成功数据。' : ' 请先在「飞书连接」登录并确认表格权限。');
      syncStatus(message, 'error'); pollCache(60000); return false;
    } finally { busy(false); }
  }
  element('sync-now').hidden = false; element('sync-now').textContent = '检查更新 ↻';
  element('sync-now').addEventListener('click', () => synchronize(true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void synchronize(); });
  element('source-button').addEventListener('click', () => element('source-dialog').showModal());
  render(); syncStatus('正在读取缓存…','loading');
  void synchronize();
})();
