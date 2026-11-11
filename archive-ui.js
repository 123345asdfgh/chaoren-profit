const archiveFieldIds=[...productIds,'referenceChina','chinaPrice','salePrice','buyerShipping','receipt','logistics','currency',...settings.map(([key])=>key),'zone'];
let archiveRecords=[];
const archiveMessage=(text,error=false)=>{get('archive-message').textContent=text;get('archive-message').classList.toggle('error',error);};
function readArchives(){
 try{archiveRecords=ArchiveCore.read(window.localStorage);return true;}
 catch(error){archiveRecords=[];get('archive-results').replaceChildren();get('archive-results').hidden=true;get('archive-count').textContent='存档暂不可用';archiveMessage('无法读取本地存档：'+error.message+' 请检查浏览器是否允许本地存储；原记录不会被覆盖。',true);return false;}
}
function showArchives(){
 const query=get('archive-search').value.trim();
 const container=get('archive-results');container.replaceChildren();container.hidden=!query;
 archiveMessage('');
 if(!query){get('archive-count').textContent='输入关键词后显示存档';return;}
 const matches=ArchiveCore.search(archiveRecords,query);
 get('archive-count').textContent=`匹配 ${matches.length} 条`; 
 if(!matches.length){const note=document.createElement('p');note.className='small';note.textContent=archiveRecords.length?'未找到匹配记录，请换一个名称或编码。':'还没有产品存档，完成01测算后点击“保存产品测算”。';container.append(note);return;}
 for(const record of matches.slice(0,50)){
  const row=document.createElement('article');row.className='archive-item';
  const info=document.createElement('div');info.className='archive-info';
  const title=document.createElement('strong');title.textContent=record.name;
  const codes=document.createElement('div');codes.className='small';codes.textContent=`规格编码：${record.specCode} · 商品编码：${record.productCode}`;
  const summary=document.createElement('div');summary.className='small';
  const result=record.snapshot.result;
  summary.textContent=`保存于 ${new Date(record.savedAt).toLocaleString('zh-CN')}`+(result&&Number.isFinite(result.netRmb)&&Number.isFinite(result.netUsd)?` · 净利率 ${result.margin===null?'不适用':(result.margin*100).toFixed(2)+'%'} · ${money(result.netRmb,'RMB')} / ${money(result.netUsd)}`:'');
  info.append(title,codes,summary);
  const actions=document.createElement('div');actions.className='archive-actions';
  const restore=document.createElement('button');restore.type='button';restore.textContent='载入测算';restore.addEventListener('click',()=>restoreArchive(record));
  const remove=document.createElement('button');remove.type='button';remove.className='delete-archive';remove.textContent='删除';remove.setAttribute('aria-label',`删除存档：${record.name}`);remove.addEventListener('click',()=>deleteArchive(record));
  const compare=document.createElement('button');compare.type='button';compare.textContent='对比';compare.className='primary';compare.addEventListener('click',()=>openComparison(record));
  actions.append(restore,compare,remove);row.append(info,actions);container.append(row);
 }
 if(matches.length>50){const note=document.createElement('p');note.className='small';note.textContent='当前显示前50条，请输入更精确的名称或编码筛选。';container.append(note);}
}
function deleteArchive(record){
 if(!window.confirm(`确定删除“${record.name}”的这条存档吗？删除后无法恢复，当前测算输入不受影响。`))return;
 try{
  const removed=ArchiveCore.remove(window.localStorage,record.id);
  if(readArchives()){showArchives();archiveMessage(removed?'存档已删除。':'该存档已不存在，搜索结果已刷新。');}
 }catch(error){archiveMessage('删除失败：'+error.message+' 原有存档未删除。',true);}
}
function validateSnapshot(snapshot){
 if(!snapshot||!snapshot.fields)throw Error('记录缺少测算参数。');
 const fields=snapshot.fields;
 for(const id of archiveFieldIds){
  if(typeof fields[id]!=='string')throw Error('记录缺少字段：'+id);
  const input=get(id).cloneNode(true);input.value=fields[id];
  if(input.value!==fields[id]||!input.checkValidity())throw Error('记录中的字段无效：'+id);
 }
 const input={...Object.fromEntries(settings.map(([key])=>[key,Number(fields[key])])),chinaPrice:Number(fields.chinaPrice),salePrice:Number(fields.salePrice),buyerShipping:Number(fields.buyerShipping),receipt:Number(fields.receipt),logistics:Number(fields.logistics),currency:fields.currency};
 for(const key of ['chinaPrice','salePrice','buyerShipping','receipt','logistics',...settings.map(([key])=>key)])if(fields[key]==='')throw Error('记录中的必填参数为空。');
 if(Math.abs(input.salePrice+input.buyerShipping-input.receipt)>Math.max(1e-8,input.receipt*1e-12))throw Error('记录中的最终实收不一致。');
 DailyCore.calculate(input);
 const adopted=snapshot.adoptedQuote;
 if(adopted&&(!Number.isFinite(adopted.cny)||adopted.cny<0||typeof adopted.code!=='string'||typeof adopted.signature!=='string'))throw Error('记录的物流来源无效。');
}
function restoreArchive(record){
 try{validateSnapshot(record.snapshot);}catch(error){archiveMessage('无法载入：'+error.message,true);return;}
 if(!window.confirm(`载入“${record.name}”的完整测算？当前尚未保存的输入将被替换，已存档记录不受影响。`))return;
 const snapshot=record.snapshot;
 for(const id of archiveFieldIds)get(id).value=snapshot.fields[id];
 previousCurrency=get('currency').value;
 adoptedQuote=snapshot.adoptedQuote?{...snapshot.adoptedQuote}:null;
 quoteInvalid('此存档未保留有效参考报价，可点击“计算运费”重新查询；01物流成本已恢复。');
 if(snapshot.quote)get('quote').click();
 settingSummary();referencePrice();renderProfit();renderClocks();
 get('archive-name').value=record.name;get('archive-spec').value=record.specCode;get('archive-product').value=record.productCode;
 get('save-product-form').hidden=true;
 archiveMessage(`已载入“${record.name}”的全部测算参数与扣点。修改后填写完全相同的商品名称、规格编码、商品编码，再次保存将覆盖旧数据。`);
 get('net').scrollIntoView({behavior:'smooth',block:'center'});
}
get('open-save').addEventListener('click',()=>{
 renderProfit();
 if(!latest){get('message').textContent='请先完成01中的有效利润测算，再保存产品。';return;}
 get('save-product-form').hidden=false;get('save-product-message').textContent='三项信息均需填写；三项完全相同会覆盖旧存档，以本次保存的数据为准。';get('archive-name').focus();
});
get('cancel-save').addEventListener('click',()=>{get('save-product-form').hidden=true;});
get('save-product-form').addEventListener('submit',event=>{
 event.preventDefault();renderProfit();
 if(!latest){get('save-product-message').textContent='当前测算无效，请先补全01数据。';return;}
 const snapshot={fields:Object.fromEntries(archiveFieldIds.map(id=>[id,get(id).value])),result:latest,input:latestInput,reference,quote,adoptedQuote,rateTable:'2026-09-28'};
 try{
  ArchiveCore.save(window.localStorage,{name:get('archive-name').value,specCode:get('archive-spec').value,productCode:get('archive-product').value},snapshot);
  get('save-product-form').hidden=true;
  if(readArchives()){showArchives();archiveMessage('保存成功。三项信息相同则更新旧存档；输入名称或编码查询。');}
  get('message').textContent='产品测算已保存；三项信息相同则覆盖旧数据。';
 }catch(error){get('save-product-message').textContent='保存失败：'+error.message+' 请检查本地存储权限或空间，原有存档未删除。';}
});
get('archive-search').addEventListener('input',()=>{if(readArchives())showArchives();});
window.addEventListener('storage',event=>{if(event.key===ArchiveCore.KEY||event.key===null){if(readArchives())showArchives();}});
if(readArchives())showArchives();
