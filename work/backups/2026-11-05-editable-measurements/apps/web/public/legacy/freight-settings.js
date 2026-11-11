// Shared logistics parameters for the main calculator and the temporary comparison.
let savedFreightSettings=FreightCore.cloneConfig(FreightCore.DEFAULT_CONFIG);
const freightChannels=['USPH','USFC','USMPPK','USTM'];
const freightAttributes=Object.keys(FreightCore.DEFAULT_CONFIG.routes);
const freightEditorBases=new WeakMap();
function renderFreightEditor(container,config,onInput){
 freightEditorBases.set(container,FreightCore.cloneConfig(config));
 container.replaceChildren();
 const tabs=document.createElement('div');tabs.className='freight-config-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','物流配置分类');container.append(tabs);
 const panels=[],buttons=[];
 const selectTab=(index,focus=false)=>{
  panels.forEach((panel,i)=>{panel.hidden=i!==index;buttons[i].setAttribute('aria-selected',String(i===index));buttons[i].tabIndex=i===index?0:-1});
  if(focus)buttons[index].focus();
 };
 for(const [i,title] of ['商品规则','渠道运价','店铺与限制'].entries()){
  const button=document.createElement('button'),panel=document.createElement('div');
  button.type='button';button.textContent=title;button.id=container.id+'-tab-'+i;button.setAttribute('role','tab');button.setAttribute('aria-controls',container.id+'-panel-'+i);
  panel.id=container.id+'-panel-'+i;panel.className='freight-config-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);
  button.addEventListener('click',()=>selectTab(i));
  button.addEventListener('keydown',event=>{
   const next=event.key==='ArrowRight'?(i+1)%3:event.key==='ArrowLeft'?(i+2)%3:event.key==='Home'?0:event.key==='End'?2:null;
   if(next!==null){event.preventDefault();selectTab(next,true)}
  });
  tabs.append(button);container.append(panel);buttons.push(button);panels.push(panel);
 }
 const group=(parent,className)=>{const div=document.createElement('div');div.className=className;parent.append(div);return div};
 const note=(parent,text)=>{const p=document.createElement('p');p.className='freight-config-note';p.textContent=text;parent.append(p)};
 const field=(parent,label,value,key,kind='number',min='0',compact=false)=>{
  const box=document.createElement('div'),caption=document.createElement('label'),input=document.createElement(kind==='select'?'select':'input');
  box.className='freight-config-field';if(compact)caption.className='freight-field-label';
  caption.textContent=label;input.dataset.freightKey=key;input.id=container.id+'-'+encodeURIComponent(key);caption.htmlFor=input.id;
  if(kind==='select')for(const option of freightChannels)input.add(new Option(option,option));
  else {input.type='number';input.step='any';input.min=min;input.max='1000000';}
  input.value=String(value);box.append(caption,input);parent.append(box);input.addEventListener(kind==='select'?'change':'input',onInput);
  input.addEventListener('invalid',()=>{
   selectTab(panels.indexOf(input.closest('.freight-config-panel')));
   const channel=input.closest('.freight-channel-panel');
   if(channel)selectChannel(channel.dataset.channel);
   for(let ancestor=input.parentElement;ancestor;ancestor=ancestor.parentElement)if(ancestor.tagName==='DETAILS')ancestor.open=true;
  });
  return input;
 };
 const table=(parent,headings,className)=>{
  const wrap=group(parent,'freight-config-table-wrap'),element=document.createElement('table'),head=document.createElement('thead'),row=document.createElement('tr'),body=document.createElement('tbody');
  element.className=className;
  for(const title of headings){const th=document.createElement('th');th.scope='col';th.textContent=title;row.append(th)}
  head.append(row);element.append(head,body);wrap.append(element);return body;
 };
 note(panels[0],'包裹直接计费；以下尺寸和重量倍数仅用于裸货包装预估。');
 const products=table(panels[0],['商品属性','默认渠道','裸货尺寸倍数','裸货重量倍数'],'freight-product-table');
 for(const attr of freightAttributes){
  const row=document.createElement('tr'),title=document.createElement('th');title.scope='row';title.textContent=attr;row.append(title);
  for(const [label,value,key,kind,min] of [[attr+' · 默认渠道',config.routes[attr],`route:${attr}`,'select','0'],[attr+' · 尺寸倍数',config.pack[attr].size,`pack:${attr}:size`,'number','0.001'],[attr+' · 重量倍数',config.pack[attr].weight,`pack:${attr}:weight`,'number','0.001']]){
   const cell=document.createElement('td');row.append(cell);field(cell,label,value,key,kind,min,true);
  }
  products.append(row);
 }
 const channelPicker=group(panels[1],'freight-channel-picker'),channelLabel=document.createElement('label'),channelSelect=document.createElement('select');
 channelLabel.textContent='选择渠道';channelSelect.id=container.id+'-channel-picker';channelLabel.htmlFor=channelSelect.id;
 for(const code of freightChannels)channelSelect.add(new Option(code,code));
 channelPicker.append(channelLabel,channelSelect);
 const channelPanels=[];
 const selectChannel=code=>{channelSelect.value=code;channelPanels.forEach(panel=>{panel.hidden=panel.dataset.channel!==code})};
 channelSelect.addEventListener('change',()=>selectChannel(channelSelect.value));
 for(const code of freightChannels){
  const section=group(panels[1],'freight-channel-panel');section.dataset.channel=code;channelPanels.push(section);
  const grid=group(section,'freight-channel-options');
  const mode=field(grid,'计费方式',config.channels[code].mode,`channel:${code}:mode`,'select');mode.replaceChildren(new Option('实重与材积重取大','max'),new Option('仅按实重','actual'));mode.value=config.channels[code].mode;
  const advanced=group(grid,'freight-channel-advanced');
  const advancedFields=group(advanced,'freight-config-grid');
  field(advancedFields,code+' · 材积除数',config.channels[code].volumeDivisor,`channel:${code}:volumeDivisor`,'number','0.001');
  field(advancedFields,code+' · 最低计费重（kg）',config.channels[code].minWeight,`channel:${code}:minWeight`,'number','0.001');
  const tiers=table(section,['重量范围（kg）','运价（元/kg）','票费（元）'],'freight-rate-table');
  config.channels[code].tiers.forEach((tier,i)=>{
   const row=document.createElement('tr'),range=document.createElement('td'),rangeFields=group(range,'freight-weight-range'),dash=document.createElement('span');dash.textContent='～';
   field(rangeFields,`${code} 第${i+1}档 · 起始重量（kg）`,tier.min,`tier:${code}:${i}:min`,'number','0',true);rangeFields.append(dash);
   field(rangeFields,`${code} 第${i+1}档 · 结束重量（kg）`,tier.max,`tier:${code}:${i}:max`,'number','0',true);row.append(range);
   for(const [key,label] of [['rate','运价（元/kg）'],['fee','票费（元）']]){const cell=document.createElement('td');row.append(cell);field(cell,`${code} 第${i+1}档 · ${label}`,tier[key],`tier:${code}:${i}:${key}`,'number','0',true)}
   tiers.append(row);
  });
 }
 note(panels[2],'香港店铺按以下渠道规则计费，并叠加店铺附加费。');
 const policy=group(panels[2],'freight-config-grid');
 field(policy,'香港改走渠道',config.hongKong.overrideChannel,'hk:overrideChannel','select');
 field(policy,'保留原渠道',config.hongKong.preserveChannel,'hk:preserveChannel','select');
 field(policy,'香港附加费（RMB）',config.hongKong.extraFee,'hk:extraFee');
 field(policy,'最大计费重（kg）',config.maxWeight,'maxWeight','number','0.001');
 selectTab(0);selectChannel(freightChannels[0]);
}
function readFreightEditor(container){
 const config=FreightCore.cloneConfig(freightEditorBases.get(container)||FreightCore.DEFAULT_CONFIG);
 for(const input of container.querySelectorAll('[data-freight-key]')){
  if(!input.checkValidity()||input.value==='')throw Error('请填写有效的物流配置：'+input.closest('div').querySelector('label')?.textContent);
  const parts=input.dataset.freightKey.split(':'),value=input.tagName==='SELECT'?input.value:Number(input.value);
  if(parts[0]==='route')config.routes[parts[1]]=value;
  else if(parts[0]==='pack')config.pack[parts[1]][parts[2]]=value;
  else if(parts[0]==='hk')config.hongKong[parts[1]]=value;
  else if(parts[0]==='maxWeight')config.maxWeight=value;
  else if(parts[0]==='channel')config.channels[parts[1]][parts[2]]=value;
  else if(parts[0]==='tier')config.channels[parts[1]].tiers[Number(parts[2])][parts[3]]=value;
 }
 for(const [code,channel] of Object.entries(config.channels)){
  if(channel.tiers.some(t=>t.min>t.max))throw Error(code+' 的重量档起始值不能大于结束值');
  const ordered=[...channel.tiers].sort((a,b)=>a.min-b.min);
  if(ordered.some((t,i)=>i>0&&t.min<=ordered[i-1].max))throw Error(code+' 的重量档不能重叠');
 }
 return config;
}
