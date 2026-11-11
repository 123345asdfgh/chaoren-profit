(function(){
 const searchInput=get('product-search'),options=get('product-name-options'),nameHint=get('product-name-hint');
 const normalized=value=>value.trim(),nameKey=value=>normalized(value).toLowerCase();
 let lookupVersion=0,lookupTimer=null,suggestions=[],selected=-1,composing=false;
 function nameMessage(message='',error=false){nameHint.textContent=message;nameHint.classList.toggle('input-error',error);}
 function hideSuggestions(){options.hidden=true;selected=-1;searchInput.setAttribute('aria-expanded','false');searchInput.removeAttribute('aria-activedescendant');}
 function cancelLookup(){clearTimeout(lookupTimer);lookupVersion++;hideSuggestions();}
 function applyProduct(product){
  cancelLookup();
  const action=()=>{try{loadProductMeasurement(product);nameMessage('已回填上次保存的数据，可修改；保存将新增历史记录并更新商品资料。');}catch(error){nameMessage('商品数据无法载入：'+error.message,true)}};
  if(globalThis.MeasurementNavigation)void MeasurementNavigation.run(action,{title:'载入另一个商品？',message:'未保存的修改将丢失。',confirmLabel:'放弃修改并载入'});else action();
 }
 function selectSuggestion(index){
  selected=index;[...options.children].forEach((button,index)=>button.setAttribute('aria-selected',String(index===selected)));
  const button=options.children[selected];if(button){searchInput.setAttribute('aria-activedescendant',button.id);button.scrollIntoView({block:'nearest'});}
 }
 function appendHighlighted(target,value,query){
  const text=String(value||'—'),needle=query.toLowerCase(),lower=text.toLowerCase();let start=0,index=needle?lower.indexOf(needle):-1;
  while(index>=0){target.append(document.createTextNode(text.slice(start,index)));const mark=document.createElement('mark');mark.textContent=text.slice(index,index+query.length);target.append(mark);start=index+query.length;index=lower.indexOf(needle,start);}
  target.append(document.createTextNode(text.slice(start)));
 }
 function showSuggestions(products){
  suggestions=products;options.replaceChildren();selected=-1;
  for(const [index,product]of products.entries()){
   const button=document.createElement('button');button.type='button';button.id='product-name-option-'+index;button.setAttribute('role','option');button.setAttribute('aria-selected','false');
   for(const [label,value]of [['商品名称',product.name],['规格编码',product.specCode],['商品编码',product.productCode]]){button.append(document.createTextNode(label+'：'));appendHighlighted(button,value,label==='规格编码'?normalized(searchInput.value):'');button.append(document.createTextNode('；'));}
   button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>{applyProduct(product);searchInput.focus()});options.append(button);
  }
  options.hidden=!products.length;searchInput.setAttribute('aria-expanded',String(products.length>0));
 }
 async function lookupName(){
  const query=normalized(searchInput.value),version=++lookupVersion;if(!query){nameMessage();hideSuggestions();return}
  try{
   const result=await apiRequest('/products/suggestions?'+new URLSearchParams({q:query}));
   if(version!==lookupVersion||nameKey(searchInput.value)!==nameKey(query))return;
   nameMessage(result.products.length?'点击下方对应商品，回填全部数据并开始新单。':'未找到该规格编码，可直接在下方填写新商品并保存。');
   if(document.activeElement===searchInput)showSuggestions(result.products);
  }catch{if(version===lookupVersion){hideSuggestions();nameMessage('商品资料暂时无法读取，请重试',true)}}
 }
 function scheduleLookup(){cancelLookup();nameMessage();if(!composing&&normalized(searchInput.value))lookupTimer=setTimeout(()=>void lookupName(),180);}
 searchInput.addEventListener('input',scheduleLookup);
 searchInput.addEventListener('compositionstart',()=>{composing=true;cancelLookup()});
 searchInput.addEventListener('compositionend',()=>{composing=false;scheduleLookup()});
 searchInput.addEventListener('blur',hideSuggestions);
 searchInput.addEventListener('keydown',event=>{
  if(composing||options.hidden)return;
  if(event.key==='ArrowDown'){event.preventDefault();selectSuggestion((selected+1)%suggestions.length)}
  if(event.key==='ArrowUp'){event.preventDefault();selectSuggestion((selected+suggestions.length-1)%suggestions.length)}
  if(event.key==='Escape'){event.preventDefault();hideSuggestions()}
  if(event.key==='Enter'){event.preventDefault();if(selected>=0)applyProduct(suggestions[selected])}
 });
 // Editing the form cancels an in-flight lookup so a late response cannot replace input.
 for(const input of document.querySelectorAll('main input,main select'))if(input!==searchInput)input.addEventListener('input',()=>{cancelLookup();nameMessage()});
 get('new-order').addEventListener('click',()=>{cancelLookup();nameMessage()});
})();

(function(){
 const open=get('open-products'),dialog=get('product-catalog-dialog');
 if(!open||!dialog)return;
 let page=1,total=0,version=0,filter='';
 const rows=get('catalog-rows'),message=get('catalog-list-message');
 function confirmDeletion(product){
  const confirmation=get('catalog-delete-dialog');
  get('catalog-delete-product').textContent=(product.name?product.name+' · ':'')+'规格编码：'+product.specCode;
  confirmation.returnValue='';
  return new Promise(resolve=>{
   confirmation.addEventListener('close',()=>resolve(confirmation.returnValue==='delete'),{once:true});
   confirmation.showModal();get('catalog-delete-cancel').focus();
  });
 }
 const pages=()=>Math.max(1,Math.ceil(total/Number(get('catalog-page-size').value)));
 function status(text='',error=false){message.textContent=text;message.classList.toggle('error',error);}
 function empty(text){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=10;cell.className='catalog-empty';cell.textContent=text;row.append(cell);rows.replaceChildren(row);}
 function render(products){
  rows.replaceChildren();
  if(!products.length){empty('暂无匹配商品');return;}
  for(const [index,product]of products.entries()){
   const row=document.createElement('tr');
   const date=new Date(product.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
   const values=[(page-1)*Number(get('catalog-page-size').value)+index+1,product.name,product.specCode,product.productCode,product.attribute,product.netRmb==null?'—':money(product.netRmb,'RMB'),product.margin==null?'—':(product.margin*100).toFixed(2)+'%',product.weight,date];
   for(const [i,value]of values.entries()){const cell=document.createElement('td');cell.textContent=value==null||value===''?'—':String(value);if(i===1)cell.className='catalog-product-name';if(i===5||i===6)cell.className='catalog-profit';if(i===8)cell.className='catalog-updated';row.append(cell);}
   const actions=document.createElement('td');actions.className='catalog-row-actions';
   for(const [label,action]of [['修改',async()=>{
    const edit=async()=>{await defaultsReady;const fresh=await apiRequest('/products/'+encodeURIComponent(product.id));globalThis.MeasurementNavigation?.setCatalogState({query:filter,page,limit:Number(get('catalog-page-size').value)});loadProductMeasurement(fresh,'product');dialog.close();get('archive-name').focus();};
    if(globalThis.MeasurementNavigation)await MeasurementNavigation.run(edit,{title:'修改商品资料？',message:'未保存的修改将丢失。',confirmLabel:'放弃修改并进入'});else await edit();
   }],['删除',async()=>{
    if(!await confirmDeletion(product))return;
    await apiRequest('/products/'+encodeURIComponent(product.id),{method:'DELETE'});
    if(activeProductId===product.id){activeProductId=null;if(measurementMode==='product'){beginNewMeasurement(false);}else renderMeasurementMode();}
    await load('已删除商品资料，已有历史记录保留。');
   }]]){
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.addEventListener('click',async()=>{button.disabled=true;try{await action()}catch(error){status(error.message,true)}finally{button.disabled=false}});
    actions.append(button);
   }
   row.append(actions);rows.append(row);
  }
 }
 async function load(notice=''){
  const requestVersion=++version;status('正在读取…');
  try{
   const result=await apiRequest('/products?'+new URLSearchParams({specCode:filter,page:String(page),limit:get('catalog-page-size').value}));
   if(requestVersion!==version)return;
   total=result.total;
   if(page>pages()){page=pages();return load(notice);}
   render(result.products);get('catalog-total').textContent='共 '+total+' 条';get('catalog-page-label').textContent='第 '+page+' / '+pages()+' 页';
   get('catalog-prev').disabled=page<=1;get('catalog-next').disabled=page>=pages();status(notice);
  }catch(error){if(requestVersion===version){empty('商品资料读取失败');status(error.message,true);}}
 }
 async function openCatalog(){if(!dialog.open)dialog.showModal();await load();}
 globalThis.ProductCatalog={open:openCatalog};
 open.addEventListener('click',()=>void openCatalog());
 get('close-products').addEventListener('click',()=>dialog.close());
 get('catalog-filter-form').addEventListener('submit',event=>{event.preventDefault();filter=get('catalog-filter-specCode').value.trim();page=1;void load();});
 get('catalog-reset-filter').addEventListener('click',()=>{get('catalog-filter-specCode').value='';filter='';page=1;void load();});
 get('catalog-refresh').addEventListener('click',()=>void load());
 get('catalog-page-size').addEventListener('change',()=>{page=1;void load();});
 get('catalog-prev').addEventListener('click',()=>{if(page>1){page--;void load();}});
 get('catalog-next').addEventListener('click',()=>{if(page<pages()){page++;void load();}});
})();
