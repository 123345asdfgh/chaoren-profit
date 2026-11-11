// Navigation only. Persistence targets and version creation stay in archive-db.js.
(()=>{
 const ids=['archive-name','archive-spec','archive-product','photoId','attribute','chinaPrice','salePrice','buyerShipping','receipt','logistics','currency','zone','length','width','height','weight','packType','store',...settings.map(([id])=>id)];
 const capture=(changes={})=>Object.fromEntries(ids.map(id=>[id,String(changes[id]??get(id).value)]));
 let baseline=capture(),context='new',confirmation=null,returnFocus=null;
 const manuallyEdited=new Set();
 const initialUrl=new URL(location.href);
 let listHref='/history';
 try{const candidate=new URL(initialUrl.searchParams.get('historyReturn')||'/history',location.origin);if(candidate.origin===location.origin&&candidate.pathname==='/history')listHref=candidate.pathname+candidate.search}catch{}
 let catalogState={query:initialUrl.searchParams.get('catalogQuery')||'',page:Number(initialUrl.searchParams.get('catalogPage'))||1,limit:Number(initialUrl.searchParams.get('catalogLimit'))||10};
 function catalogHref(){
  const url=new URL(listHref,location.origin);
  url.searchParams.set('catalog','1');url.searchParams.set('catalogQuery',catalogState.query);url.searchParams.set('catalogPage',String(Number.isSafeInteger(catalogState.page)&&catalogState.page>0?catalogState.page:1));url.searchParams.set('catalogLimit',String([10,20,50].includes(catalogState.limit)?catalogState.limit:10));
  return url.pathname+url.search;
 }
 const withList=destination=>{const url=new URL(destination,location.origin);url.searchParams.set('historyReturn',listHref);return url.pathname+url.search};
 function isDirty(){const current=capture();return ids.some(id=>current[id]!==baseline[id]||get(id).validity?.badInput)||Boolean(window.ProductPhoto?.isPending?.());}
 function markClean(saved=capture()){baseline={...saved};manuallyEdited.clear();}
 function confirmDiscard({title='有未保存的修改',message='未保存的修改将丢失。',confirmLabel='放弃修改并离开'}={}){
  if(confirmation)return confirmation;
  const dialog=get('unsaved-changes-dialog');
  get('unsaved-changes-title').textContent=title;get('unsaved-changes-message').textContent=message;get('discard-changes').textContent=confirmLabel;
  returnFocus=document.activeElement;dialog.returnValue='';
  confirmation=new Promise(resolve=>{dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='discard';confirmation=null;returnFocus?.focus();resolve(accepted)},{once:true});dialog.showModal();get('keep-editing').focus();});
  return confirmation;
 }
 async function run(action,options){
  // Do not race a write with navigation or replacing the active form.
  if(typeof savingMeasurement!=='undefined'&&savingMeasurement)return false;
  if(isDirty()&&!await confirmDiscard(options))return false;
  await action();return true;
 }
 function returnTarget(){
  if(context==='product')return {label:'返回商品表',href:catalogHref()};
  if(context==='history'&&activeRecordId)return {label:'返回本单详情',href:withList('/history/product/'+encodeURIComponent(activeRecordId))};
  return {label:'返回历史记录',href:listHref};
 }
 function updateReturn(){
  const target=returnTarget();
  get('measurement-back').href=target.href;get('measurement-back-label').textContent=target.label;
  get('save-return').textContent=target.label;
 }
 async function goBack(){
  return run(async()=>{
   get('save-success-dialog').close();
   location.assign(returnTarget().href);
  });
 }
 get('measurement-back').addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();void goBack()});
 get('save-return').addEventListener('click',()=>void goBack());
 // These are ordinary page links, including all three sidebar entries.
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const anchor=event.target.closest('a[href]');if(!anchor||anchor.id==='measurement-back'||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
  const url=new URL(anchor.href,location.href);if(!['http:','https:'].includes(url.protocol))return;
  if(url.origin===location.origin&&url.pathname===location.pathname&&url.search===location.search&&url.hash)return;
  if(!isDirty()&&!(typeof savingMeasurement!=='undefined'&&savingMeasurement))return;
  event.preventDefault();void run(()=>location.assign(url.href));
 });
 for(const id of ids)get(id).addEventListener('input',()=>manuallyEdited.add(id));
 window.MeasurementNavigation={capture,isDirty,markClean,run,confirmDiscard,goBack,
  setContext(value){context=value;updateReturn()},
  updateReturn,
  setCatalogState(value){catalogState={...value};updateReturn()},
  rebaseDefaults(){for(const id of [...settings.map(([key])=>key),'zone'])if(!manuallyEdited.has(id))baseline[id]=get(id).value},
 };
 updateReturn();
})();
