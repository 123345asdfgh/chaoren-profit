(function(){
 const searchInput=get('product-search'),options=get('product-name-options'),nameHint=get('product-name-hint');
 const normalized=value=>value.trim(),nameKey=value=>normalized(value).toLowerCase();
 let lookupVersion=0,lookupTimer=null,suggestions=[],selected=-1,composing=false;
 function nameMessage(message='',error=false){nameHint.textContent=message;nameHint.classList.toggle('input-error',error);}
 function hideSuggestions(){options.hidden=true;selected=-1;searchInput.setAttribute('aria-expanded','false');searchInput.removeAttribute('aria-activedescendant');}
 function cancelLookup(){clearTimeout(lookupTimer);lookupVersion++;hideSuggestions();}
 function applyProduct(product){
  cancelLookup();
  try{loadProductMeasurement(product);nameMessage('已回填上次保存的数据，可修改；保存将新增历史记录并更新商品资料。');}
  catch(error){nameMessage('商品数据无法载入：'+error.message,true)}
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
   for(const [label,value]of [['商品名称',product.name],['规格编码',product.specCode],['商品编码',product.productCode]]){button.append(document.createTextNode(label+'：'));appendHighlighted(button,value,normalized(searchInput.value));button.append(document.createTextNode('；'));}
   button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>{applyProduct(product);searchInput.focus()});options.append(button);
  }
  options.hidden=!products.length;searchInput.setAttribute('aria-expanded',String(products.length>0));
 }
 async function lookupName(){
  const query=normalized(searchInput.value),version=++lookupVersion;if(!query){nameMessage();hideSuggestions();return}
  try{
   const result=await apiRequest('/products/suggestions?'+new URLSearchParams({q:query}));
   if(version!==lookupVersion||nameKey(searchInput.value)!==nameKey(query))return;
   const exact=result.products.filter(product=>nameKey(product.specCode)===nameKey(query));
   if(exact.length===1){if(document.activeElement===searchInput)applyProduct(exact[0]);return}
   nameMessage(result.products.length?'选择商品后开始新单并回填全部数据。':'未找到该规格编码，可直接在下方填写新商品并保存。');
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
