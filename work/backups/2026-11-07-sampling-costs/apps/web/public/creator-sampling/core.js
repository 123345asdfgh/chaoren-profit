(function (root) {
  const defaults = [{ id: 'plush', name: '毛绒', source: '毛绒' }, { id: 'blind', name: '盲盒', source: '盲盒' }, { id: 'regular', name: '常规', source: '常规' }];
  const levels = Array.from({ length: 7 }, (_, index) => 'L' + (index + 1));
  const percentage = (value, total) => total > 0 ? value / total * 100 : 0;
  const validQuantity = record => typeof record.quantity === 'number' && Number.isFinite(record.quantity) && record.quantity >= 0;
  const sortCounts = entries => entries.sort((first, second) => second.value - first.value || first.name.localeCompare(second.name, 'zh-CN'));
  function categoriesFromData(records, options = []) {
    const sources = [...new Set([...options, ...records.map(record => record.category)].filter(value => typeof value === 'string'))];
    const preferred = defaults.map(category => category.source);
    sources.sort((first, second) => {
      const firstRank = preferred.includes(first) ? preferred.indexOf(first) : preferred.length;
      const secondRank = preferred.includes(second) ? preferred.indexOf(second) : preferred.length;
      return firstRank - secondRank;
    });
    return sources.map(source => {
      const known = defaults.find(category => category.source === source);
      return known ? { ...known } : { id: 'source-' + encodeURIComponent(source), name: source || '未标注', source };
    });
  }
  function filterRecords(records, options, categories) {
    const selected = categories.find(category => category.id === options.category);
    return records.filter(record => {
      const calendarDate = String(record.date || '').slice(0, 10);
      const matchesTime = options.mode === 'all' || (options.mode === 'day' ? calendarDate === options.period : calendarDate.slice(0, 7) === options.period);
      return matchesTime && (options.category === 'all' || !!selected && record.category === selected.source);
    });
  }
  function aggregate(records) {
    const creators = new Map();
    const products = new Map();
    let invalidQuantity = 0;
    let missingCreator = 0;
    records.forEach(record => {
      const account = String(record.creator || '').trim().toLowerCase();
      if (account) {
        const current = creators.get(account);
        const key = String(record.date) + '|' + String(record.id);
        if (!current || key > current.key) creators.set(account, { key, level: levels.includes(record.level) ? record.level : '未标注' });
      } else missingCreator++;
      if (validQuantity(record)) {
        const name = record.product || '未标注产品';
        products.set(name, (products.get(name) || 0) + record.quantity);
      } else invalidQuantity++;
    });
    const tierRows = levels.map(name => ({ name, value: [...creators.values()].filter(creator => creator.level === name).length }));
    const unknownCount = [...creators.values()].filter(creator => creator.level === '未标注').length;
    if (unknownCount) tierRows.push({ name: '未标注', value: unknownCount });
    const productRows = sortCounts([...products].map(([name, value]) => ({ name, value })));
    const quantity = productRows.reduce((total, product) => total + product.value, 0);
    return { creators: creators.size, quantity, productCount: products.size, recordCount: records.length, invalidQuantity, missingCreator, tiers: tierRows.map(row => ({ ...row, percent: percentage(row.value, creators.size) })), products: productRows.map(row => ({ ...row, percent: percentage(row.value, quantity) })) };
  }
  function validateCategories(value) {
    if (!Array.isArray(value) || !value.length || value.length > 40) return false;
    const ids = new Set();
    const names = new Set();
    const sources = new Set();
    return value.every(category => {
      if (!category || typeof category.id !== 'string' || !category.id || category.id === 'all' || typeof category.name !== 'string' || typeof category.source !== 'string') return false;
      if (!category.name.trim() || category.name.length > 24 || !category.source.trim() || category.source.length > 60 || ids.has(category.id) || names.has(category.name.trim()) || sources.has(category.source)) return false;
      ids.add(category.id); names.add(category.name.trim()); sources.add(category.source);
      return true;
    });
  }
  function sampling(records) {
    return {
      planned: aggregate(records),
      shipped: aggregate(records.filter(record => record.shipped === true)),
      unshipped: aggregate(records.filter(record => record.shipped !== true))
    };
  }
  function fulfillment(records) {
    const due = new Set(), done = new Set();
    records.forEach(record => {
      const creator = String(record.creator || '').trim().toLowerCase();
      if (!creator || !record.shipped) return;
      const key = record.date + '|' + creator;
      due.add(key); if (record.fulfilled) done.add(key);
    });
    return {due: due.size, actual: done.size, rate: due.size ? done.size / due.size * 100 : null};
  }
  const api = { sampling, fulfillment, categoriesFromData, defaults, levels, aggregate, filterRecords, percentage, sortCounts, validateCategories, validQuantity };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DashboardCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
