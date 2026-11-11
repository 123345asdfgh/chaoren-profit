(function(){
 const dialog=get('product-catalog-dialog'),form=get('catalog-product-form'),feedback=get('catalog-feedback-dialog');
 const nameInput=get('archive-name'),options=get('product-name-options'),nameHint=get('product-name-hint');
 const keys=['name','attribute','length','width','height','weight'],dimensions=['length','width','height','weight'];
 const normalized=value=>value.trim().replace(/\s+/gu,' '),nameKey=value=>normalized(value).toLowerCase();
 let editId=null,saving=false,page=1,limit=10,total=0,query='',attribute='',listVersion=0,loading=false;
 let lookupVersion=0,lookupTimer=null,suggestions=[],selected=-1,composing=false;
 const timestamp=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
 for(const id of ['catalog-attribute','catalog-filter-attribute']){
  get(id).replaceChildren(new Option(id==='catalog-attribute'?'请选择商品属性':'全部属性',''),...Object.keys(FreightCore.RULES).map(name=>new Option(name,name)));
 }
 function hideSuggestions(){
  options.hidden=true;selected=-1;nameInput.setAttribute('aria-expanded','false');nameInput.removeAttribute('aria-activedescendant');
 }
 function cancelLookup(){clearTimeout(lookupTimer);lookupVersion++;hideSuggestions();}
 function applyProduct(product){
  cancelLookup();nameInput.value=product.name;
  get('attribute').value=product.attribute;
  for(const key of dimensions)get(key).value=String(product[key]);
  nameHint.textContent='已回填商品资料';
  updateFreightQuote(true);renderProfit();
 }
 function selectSuggestion(index){
  selected=index;
  [...options.children].forEach((button,index)=>button.setAttribute('aria-selected',String(index===selected)));
  const button=options.children[selected];
  if(button){nameInput.setAttribute('aria-activedescendant',button.id);button.scrollIntoView({block:'nearest'});}
 }
 function showSuggestions(products){
  suggestions=products;options.replaceChildren();selected=-1;
  for(const [index,product]of products.entries()){
   const button=document.createElement('button'),name=document.createElement('strong'),details=document.createElement('span');
   button.type='button';button.id='product-name-option-'+index;button.setAttribute('role','option');button.setAttribute('aria-selected','false');
   name.textContent=product.name;details.textContent=`${product.attribute} · ${product.length} × ${product.width} × ${product.height} cm · ${product.weight} kg`;
   button.append(name,details);button.addEventListener('mousedown',event=>event.preventDefault());
   button.addEventListener('click',()=>{applyProduct(product);nameInput.focus()});options.append(button);
  }
  options.hidden=!products.length;nameInput.setAttribute('aria-expanded',String(products.length>0));
 }
 async function lookupName(){
  const query=normalized(nameInput.value),version=++lookupVersion;
  if(!query){nameHint.textContent='';hideSuggestions();return}
  try{
   const result=await apiRequest('/products/suggestions?'+new URLSearchParams({q:query}));
   if(version!==lookupVersion||nameKey(nameInput.value)!==nameKey(query))return;
   const exact=result.products.find(product=>nameKey(product.name)===nameKey(query));
   if(exact){applyProduct(exact);return}
   nameHint.textContent=result.products.length?'选择已有商品可回填资料':'该商品尚未录入，请先通过右上角“商品录入”添加资料';
   if(document.activeElement===nameInput)showSuggestions(result.products);
  }catch{
   if(version===lookupVersion){hideSuggestions();nameHint.textContent='商品资料暂时无法读取，请重试';}
  }
 }
 function scheduleLookup(){
  cancelLookup();nameHint.textContent='';
  for(const id of dimensions)get(id).value='';
  updateFreightQuote();
  if(!composing&&normalized(nameInput.value))lookupTimer=setTimeout(()=>void lookupName(),180);
 }
 nameInput.addEventListener('input',scheduleLookup);
 nameInput.addEventListener('compositionstart',()=>{composing=true;cancelLookup()});
 nameInput.addEventListener('compositionend',()=>{composing=false;scheduleLookup()});
 nameInput.addEventListener('blur',hideSuggestions);
 nameInput.addEventListener('keydown',event=>{
  if(composing||options.hidden)return;
  if(event.key==='ArrowDown'){event.preventDefault();selectSuggestion((selected+1)%suggestions.length)}
  if(event.key==='ArrowUp'){event.preventDefault();selectSuggestion((selected+suggestions.length-1)%suggestions.length)}
  if(event.key==='Escape'){event.preventDefault();hideSuggestions()}
  if(event.key==='Enter'){event.preventDefault();if(selected>=0)applyProduct(suggestions[selected])}
 });
 for(const id of ['attribute',...dimensions])get(id).addEventListener('input',()=>{cancelLookup();nameHint.textContent=''});
 get('new-order').addEventListener('click',()=>{cancelLookup();nameHint.textContent=''});
 function resetForm(prefill=false){
  editId=null;form.reset();get('catalog-form-title').textContent='录入商品';get('catalog-submit').textContent='录入商品';get('catalog-clear').textContent='清空表单';get('catalog-form-message').textContent='';
  if(prefill){get('catalog-name').value=nameInput.value;get('catalog-attribute').value=get('attribute').value;for(const key of dimensions)get('catalog-'+key).value=get(key).value;}
 }
 function editProduct(product){
  if(saving)return;
  editId=product.id;for(const key of keys)get('catalog-'+key).value=String(product[key]);
  get('catalog-form-title').textContent='修改商品资料';get('catalog-submit').textContent='保存修改';get('catalog-clear').textContent='取消修改';get('catalog-form-message').textContent='';get('catalog-name').focus();
 }
 function updatePagination(){
  const pages=Math.max(1,Math.ceil(total/limit));
  get('catalog-page-label').textContent=`第 ${page} / ${pages} 页`;
  get('catalog-prev').disabled=loading||page<=1;get('catalog-next').disabled=loading||page>=pages;
  get('catalog-refresh').disabled=loading;
 }
 function emptyRow(message){
  const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=9;cell.className='catalog-empty';cell.textContent=message;row.append(cell);get('catalog-rows').replaceChildren(row);
 }
 function renderRows(products){
  get('catalog-rows').replaceChildren();
  if(!products.length){emptyRow(query||attribute?'没有符合条件的商品。':'还没有商品资料，录入后会显示在这里。');return}
  for(const [index,product]of products.entries()){
   const row=document.createElement('tr');
   for(const [column,value]of [(page-1)*limit+index+1,product.name,product.attribute,...dimensions.map(key=>product[key]),timestamp(product.updatedAt)].entries()){
    const cell=document.createElement('td');cell.textContent=String(value);if(column===1)cell.className='catalog-product-name';if(column===7)cell.className='catalog-updated';row.append(cell);
   }
   const actions=document.createElement('td');actions.className='catalog-row-actions';
   const edit=document.createElement('button'),use=document.createElement('button');edit.type=use.type='button';edit.textContent='修改';use.textContent='使用';edit.setAttribute('aria-label','修改商品 '+product.name);use.setAttribute('aria-label','使用商品 '+product.name);
   edit.addEventListener('click',()=>editProduct(product));use.addEventListener('click',()=>{if(saving)return;applyProduct(product);dialog.close();get('length').focus()});actions.append(edit,use);row.append(actions);get('catalog-rows').append(row);
  }
 }
 async function loadProducts(){
  const version=++listVersion;loading=true;updatePagination();get('catalog-list-message').textContent='读取中…';
  try{
   const result=await apiRequest('/products?'+new URLSearchParams({q:query,attribute,page:String(page),limit:String(limit)}));
   if(version!==listVersion)return;
   total=result.total;const pages=Math.max(1,Math.ceil(total/limit));
   if(page>pages){page=pages;return void loadProducts()}
   get('catalog-total').textContent=`共 ${total} 条`;renderRows(result.products);get('catalog-list-message').textContent='';
  }catch(error){if(version===listVersion){emptyRow('商品资料读取失败，请刷新重试。');get('catalog-list-message').textContent=error.message}}
  finally{if(version===listVersion){loading=false;updatePagination()}}
 }
 get('open-products').addEventListener('click',()=>{
  cancelLookup();resetForm(true);dialog.showModal();get('catalog-name').focus();void loadProducts();
 });
 get('close-products').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>get('open-products').focus());
 get('catalog-clear').addEventListener('click',()=>{if(saving)return;resetForm();get('catalog-name').focus()});
 get('catalog-filter-form').addEventListener('submit',event=>{event.preventDefault();query=normalized(get('catalog-search').value);attribute=get('catalog-filter-attribute').value;page=1;void loadProducts()});
 get('catalog-reset-filter').addEventListener('click',()=>{get('catalog-filter-form').reset();query=attribute='';page=1;void loadProducts()});
 get('catalog-page-size').addEventListener('change',()=>{limit=Number(get('catalog-page-size').value);page=1;void loadProducts()});
 get('catalog-prev').addEventListener('click',()=>{if(page>1&&!loading){page--;void loadProducts()}});
 get('catalog-next').addEventListener('click',()=>{if(page*limit<total&&!loading){page++;void loadProducts()}});
 get('catalog-refresh').addEventListener('click',()=>void loadProducts());
 function notify(title,message){
  if(!dialog.open)return;
  get('catalog-feedback-title').textContent=title;get('catalog-feedback-message').textContent=message;feedback.showModal();get('catalog-feedback-confirm').focus();
 }
 get('catalog-feedback-confirm').addEventListener('click',()=>feedback.close());
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(saving)return;
  const invalid=keys.map(key=>get('catalog-'+key)).find(input=>!input.checkValidity()||!normalized(input.value));
  if(invalid){get('catalog-form-message').textContent='请填写有效的'+document.querySelector(`label[for="${invalid.id}"]`).textContent+'。';invalid.focus();return}
  const body={name:normalized(get('catalog-name').value),attribute:get('catalog-attribute').value,...Object.fromEntries(dimensions.map(key=>[key,Number(get('catalog-'+key).value)]))};
  const updating=!!editId;saving=true;get('catalog-submit').disabled=true;get('catalog-clear').disabled=true;get('catalog-form-message').textContent='';
  try{
   const product=await apiRequest('/products'+(updating?'/'+encodeURIComponent(editId):''),{method:updating?'PATCH':'POST',body:JSON.stringify(body)});
   resetForm();if(!updating){get('catalog-filter-form').reset();query=attribute='';page=1;}
   await loadProducts();notify(updating?'修改成功':'录入成功','“'+product.name+'”的基础信息已保存。');
  }catch(error){get('catalog-form-message').textContent=error.message;notify('未能保存',error.message)}
  finally{saving=false;get('catalog-submit').disabled=false;get('catalog-clear').disabled=false}
 });
})();
