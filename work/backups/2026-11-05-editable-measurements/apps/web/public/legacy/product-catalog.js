(function(){
 const dialog=get('product-catalog-dialog'),form=get('catalog-product-form'),feedback=get('catalog-feedback-dialog'),deleteDialog=get('catalog-delete-dialog');
 const nameInput=get('archive-name'),searchInput=get('product-search'),options=get('product-name-options'),nameHint=get('product-name-hint');
 const keys=['name','specCode','productCode','attribute','length','width','height','weight'],dimensions=['length','width','height','weight'];
 const normalized=value=>value.trim().replace(/\s+/gu,' '),nameKey=value=>normalized(value).toLowerCase();
 let pendingDelete=null;
 let editId=null,saving=false,page=1,limit=10,total=0,query='',specCode='',productCode='',attribute='',listVersion=0,loading=false;
 let lookupVersion=0,lookupTimer=null,suggestions=[],selected=-1,composing=false;
 function nameMessage(message='',error=false){nameHint.textContent=message;nameHint.classList.toggle('input-error',error);}
 const timestamp=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
 for(const id of ['catalog-attribute','catalog-filter-attribute']){
  get(id).replaceChildren(new Option(id==='catalog-attribute'?'请选择商品属性':'全部属性',''),...Object.keys(FreightCore.RULES).map(name=>new Option(name,name)));
 }
 function hideSuggestions(){
  options.hidden=true;selected=-1;searchInput.setAttribute('aria-expanded','false');searchInput.removeAttribute('aria-activedescendant');
 }
 function cancelLookup(){clearTimeout(lookupTimer);lookupVersion++;hideSuggestions();}
 function applyProduct(product){
  cancelLookup();nameInput.value=product.name;searchInput.value=product.name;
  get('archive-spec').value=product.specCode||'';get('archive-product').value=product.productCode||'';get('attribute').value=product.attribute;
  for(const key of dimensions)get(key).value=String(product[key]);
  const missingCodes=!product.specCode||!product.productCode;
  nameMessage(missingCodes?'已回填商品资料，请在“商品录入”中补全编码':'已回填商品资料',missingCodes);
  updateFreightQuote(true);renderProfit();
 }
 function selectSuggestion(index){
  selected=index;
  [...options.children].forEach((button,index)=>button.setAttribute('aria-selected',String(index===selected)));
  const button=options.children[selected];
  if(button){searchInput.setAttribute('aria-activedescendant',button.id);button.scrollIntoView({block:'nearest'});}
 }
 function appendHighlighted(target,value,query){
  const text=String(value||'—'),needle=query.toLowerCase(),lower=text.toLowerCase();
  let start=0,index=needle?lower.indexOf(needle):-1;
  while(index>=0){
   target.append(document.createTextNode(text.slice(start,index)));
   const mark=document.createElement('mark');mark.textContent=text.slice(index,index+query.length);target.append(mark);
   start=index+query.length;index=lower.indexOf(needle,start);
  }
  target.append(document.createTextNode(text.slice(start)));
 }
 function showSuggestions(products){
  suggestions=products;options.replaceChildren();selected=-1;
  for(const [index,product]of products.entries()){
   const button=document.createElement('button');
   button.type='button';button.id='product-name-option-'+index;button.setAttribute('role','option');button.setAttribute('aria-selected','false');
   for(const [label,value]of [['商品名称',product.name],['规格编码',product.specCode],['商品编码',product.productCode]]){
    button.append(document.createTextNode(label+'：'));appendHighlighted(button,value,normalized(searchInput.value));button.append(document.createTextNode('；'));
   }
   button.addEventListener('mousedown',event=>event.preventDefault());
   button.addEventListener('click',()=>{applyProduct(product);searchInput.focus()});options.append(button);
  }
  options.hidden=!products.length;searchInput.setAttribute('aria-expanded',String(products.length>0));
 }
 async function lookupName(){
  const query=normalized(searchInput.value),version=++lookupVersion;
  if(!query){nameMessage();hideSuggestions();return}
  try{
   const result=await apiRequest('/products/suggestions?'+new URLSearchParams({q:query}));
   if(version!==lookupVersion||nameKey(searchInput.value)!==nameKey(query))return;
   const exact=result.products.filter(product=>[product.name,product.specCode,product.productCode].some(value=>nameKey(value||'')===nameKey(query)));
   if(exact.length===1){applyProduct(exact[0]);return}
   nameMessage(result.products.length?'选择已有商品可回填资料':'该商品尚未录入，请先通过右上角“商品录入”添加资料',!result.products.length);
   if(document.activeElement===searchInput)showSuggestions(result.products);
  }catch{
   if(version===lookupVersion){hideSuggestions();nameMessage('商品资料暂时无法读取，请重试',true);}
  }
 }
 function scheduleLookup(){
  cancelLookup();nameMessage();
  for(const id of [...dimensions,'archive-name','archive-spec','archive-product','attribute'])get(id).value='';
  updateFreightQuote(true);renderProfit();
  if(!composing&&normalized(searchInput.value))lookupTimer=setTimeout(()=>void lookupName(),180);
 }
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
 for(const id of ['attribute',...dimensions])get(id).addEventListener('input',()=>{cancelLookup();nameMessage()});
 get('new-order').addEventListener('click',()=>{cancelLookup();searchInput.value='';nameMessage()});
 function resetForm(prefill=false){
  editId=null;form.reset();get('catalog-form-title').textContent='录入商品';get('catalog-submit').textContent='录入商品';get('catalog-clear').textContent='清空表单';get('catalog-form-message').textContent='';
  if(prefill){get('catalog-name').value=nameInput.value||searchInput.value;get('catalog-specCode').value=get('archive-spec').value;get('catalog-productCode').value=get('archive-product').value;get('catalog-attribute').value=get('attribute').value;for(const key of dimensions)get('catalog-'+key).value=get(key).value;}
 }
 function editProduct(product){
  if(saving)return;
  editId=product.id;for(const key of keys)get('catalog-'+key).value=String(product[key]??'');
  get('catalog-form-title').textContent='修改商品资料';get('catalog-submit').textContent='保存修改';get('catalog-clear').textContent='取消修改';get('catalog-form-message').textContent='';get('catalog-name').focus();
 }
 function updatePagination(){
  const pages=Math.max(1,Math.ceil(total/limit));
  get('catalog-page-label').textContent=`第 ${page} / ${pages} 页`;
  get('catalog-prev').disabled=loading||page<=1;get('catalog-next').disabled=loading||page>=pages;
  get('catalog-refresh').disabled=loading;
 }
 function emptyRow(message){
  const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=11;cell.className='catalog-empty';cell.textContent=message;row.append(cell);get('catalog-rows').replaceChildren(row);
 }
 function renderRows(products){
  get('catalog-rows').replaceChildren();
  if(!products.length){emptyRow(query||specCode||productCode||attribute?'没有符合条件的商品。':'还没有商品资料，录入后会显示在这里。');return}
  for(const [index,product]of products.entries()){
   const row=document.createElement('tr');
   for(const [column,value]of [(page-1)*limit+index+1,product.name,product.specCode||'—',product.productCode||'—',product.attribute,...dimensions.map(key=>product[key]),timestamp(product.updatedAt)].entries()){
    const cell=document.createElement('td');cell.textContent=String(value);if(column===1)cell.className='catalog-product-name';if(column===9)cell.className='catalog-updated';row.append(cell);
   }
   const actions=document.createElement('td');actions.className='catalog-row-actions';
   const edit=document.createElement('button'),remove=document.createElement('button');edit.type=remove.type='button';edit.textContent='修改';remove.textContent='删除';edit.setAttribute('aria-label','修改商品 '+product.name);remove.setAttribute('aria-label','删除商品 '+product.name);
   edit.addEventListener('click',()=>editProduct(product));remove.addEventListener('click',()=>{
    if(saving)return;pendingDelete=product;
    get('catalog-delete-message').textContent='确定删除“'+product.name+'”的商品基础信息吗？已保存的测算记录会保留。';
    deleteDialog.showModal();get('catalog-delete-cancel').focus();
   });actions.append(edit,remove);row.append(actions);get('catalog-rows').append(row);
  }
 }
 async function loadProducts(){
  const version=++listVersion;loading=true;updatePagination();get('catalog-list-message').textContent='读取中…';
  try{
   const result=await apiRequest('/products?'+new URLSearchParams({q:query,specCode,productCode,attribute,page:String(page),limit:String(limit)}));
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
 function resetFilters(){get('catalog-filter-form').reset();query=specCode=productCode=attribute='';page=1;}
 get('catalog-filter-form').addEventListener('submit',event=>{event.preventDefault();query=normalized(get('catalog-search').value);specCode=get('catalog-filter-specCode').value.trim();productCode=get('catalog-filter-productCode').value.trim();attribute=get('catalog-filter-attribute').value;page=1;void loadProducts()});
 get('catalog-reset-filter').addEventListener('click',()=>{resetFilters();void loadProducts()});
 get('catalog-page-size').addEventListener('change',()=>{limit=Number(get('catalog-page-size').value);page=1;void loadProducts()});
 get('catalog-prev').addEventListener('click',()=>{if(page>1&&!loading){page--;void loadProducts()}});
 get('catalog-next').addEventListener('click',()=>{if(page*limit<total&&!loading){page++;void loadProducts()}});
 get('catalog-refresh').addEventListener('click',()=>void loadProducts());
 function notify(title,message){
  if(!dialog.open)return;
  get('catalog-feedback-title').textContent=title;get('catalog-feedback-message').textContent=message;feedback.showModal();get('catalog-feedback-confirm').focus();
 }
 get('catalog-feedback-confirm').addEventListener('click',()=>feedback.close());
 get('catalog-delete-cancel').addEventListener('click',()=>{if(!saving)deleteDialog.close()});
 deleteDialog.addEventListener('cancel',event=>{if(saving)event.preventDefault()});
 deleteDialog.addEventListener('close',()=>{pendingDelete=null;if(dialog.open)get('catalog-refresh').focus()});
 get('catalog-delete-confirm').addEventListener('click',async()=>{
  if(!pendingDelete||saving)return;
  const product=pendingDelete;saving=true;
  get('catalog-delete-confirm').disabled=get('catalog-delete-cancel').disabled=true;
  get('catalog-submit').disabled=get('catalog-clear').disabled=true;
  try{
   await apiRequest('/products/'+encodeURIComponent(product.id),{method:'DELETE',headers:{}});
   cancelLookup();if(editId===product.id)resetForm();
   deleteDialog.close();await loadProducts();notify('删除成功','“'+product.name+'”的基础信息已删除。');
  }catch(error){deleteDialog.close();notify('未能删除',error.message)}
  finally{
   saving=false;get('catalog-delete-confirm').disabled=get('catalog-delete-cancel').disabled=false;
   get('catalog-submit').disabled=get('catalog-clear').disabled=false;
  }
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(saving)return;
  const invalid=keys.map(key=>get('catalog-'+key)).find(input=>!input.checkValidity()||!normalized(input.value));
  if(invalid){get('catalog-form-message').textContent='请填写有效的'+document.querySelector(`label[for="${invalid.id}"]`).textContent+'。';invalid.focus();return}
  const body={name:normalized(get('catalog-name').value),specCode:get('catalog-specCode').value.trim(),productCode:get('catalog-productCode').value.trim(),attribute:get('catalog-attribute').value,...Object.fromEntries(dimensions.map(key=>[key,Number(get('catalog-'+key).value)]))};
  const updating=!!editId;saving=true;get('catalog-submit').disabled=true;get('catalog-clear').disabled=true;get('catalog-form-message').textContent='';
  try{
   const product=await apiRequest('/products'+(updating?'/'+encodeURIComponent(editId):''),{method:updating?'PATCH':'POST',body:JSON.stringify(body)});
   resetForm();if(!updating)resetFilters();
   await loadProducts();notify(updating?'修改成功':'录入成功','“'+product.name+'”的基础信息已保存。');
  }catch(error){get('catalog-form-message').textContent=error.message;notify('未能保存',error.message)}
  finally{saving=false;get('catalog-submit').disabled=false;get('catalog-clear').disabled=false}
 });
})();
