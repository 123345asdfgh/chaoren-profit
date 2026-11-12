(function(){
 const records=[
  {name:'宝可梦抱抱随行盲盒',spec:'TEMP-COST-001',code:'DEMO-001',category:'盲盒',profit:58.42,margin:.46,saved:'2026/11/12 17:30',operator:'静态演示'},
  {name:'药屋少女的呢喃·药屋萌宠阁',spec:'TEMP-COST-002',code:'DEMO-002',category:'盲盒',profit:31.18,margin:.29,saved:'2026/11/11 15:06',operator:'静态演示'},
  {name:'潮流毛绒挂件',spec:'TEMP-COST-003',code:'DEMO-003',category:'毛绒',profit:-12.60,margin:-.08,saved:'2026/11/10 10:42',operator:'静态演示'},
  {name:'日常收藏摆件',spec:'TEMP-COST-004',code:'DEMO-004',category:'常规',profit:74.20,margin:.51,saved:'2026/11/08 09:18',operator:'静态演示'},
  {name:'限定联名盲盒',spec:'TEMP-COST-005',code:'DEMO-005',category:'盲盒',profit:46.73,margin:.37,saved:'2026/11/06 16:25',operator:'静态演示'}
 ];
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>'¥'+v.toFixed(2), tone=v=>v>0?'positive':v<0?'negative':'neutral';
 const q=document.getElementById('history-query'),cat=document.getElementById('history-category'),tbody=document.getElementById('history-rows'),count=document.getElementById('history-count');
 function render(){const needle=q.value.trim().toLowerCase(), category=cat.value;const rows=records.filter(r=>(!needle||[r.name,r.spec,r.code].some(v=>v.toLowerCase().includes(needle)))&&(!category||r.category===category));count.textContent=`共 ${rows.length} 条 · 静态演示数据`;tbody.innerHTML=rows.length?rows.map(r=>`<tr><td><div class="photo-placeholder">✦</div></td><td><strong>${esc(r.name)}</strong><small>第 1 版</small></td><td>${esc(r.spec)}</td><td>${esc(r.code)}</td><td>${esc(r.category)}</td><td class="${tone(r.profit)}">${money(r.profit)}</td><td class="${tone(r.margin)}">${(r.margin*100).toFixed(2)}%</td><td>${r.saved}</td><td>${esc(r.operator)}</td><td><button onclick="location.href='calculator.html?record=demo-record-001'">订单修改</button></td></tr>`).join(''):'<tr><td colspan="10" class="empty">没有符合条件的记录</td></tr>';}
 q.addEventListener('input',render);cat.addEventListener('change',render);render();
 document.getElementById('new-order').addEventListener('click',()=>location.href='calculator.html');
})();
