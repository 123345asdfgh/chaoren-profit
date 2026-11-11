import ExcelJS from 'exceljs';
import type {z} from 'zod';
import type {freightConfigSchema} from './freight-config.js';
import type {FreightQuote} from './snapshot.js';

type FreightConfig=z.infer<typeof freightConfigSchema>;
type HistoryRow=Record<string,unknown>;
type Snapshot={fields?:Record<string,string>;freight?:FreightConfig;quote?:FreightQuote|null};
type Column={header:string;width:number;value:(row:HistoryRow,index:number)=>ExcelJS.CellValue;format?:string};
type ColumnGroup={title:string;columns:Column[];result?:boolean};
const numberFormat='#,##0.00;[Red](#,##0.00);0.00';
const preciseFormat='0.00####';
const ink='FF172440',orange='FFC45D20',line='FFE6D5BB';
const fields=(row:HistoryRow)=>(row.snapshot as Snapshot)?.fields??{};
const labels:Record<string,[string,number]>={
 length:['长（cm）',15],width:['宽（cm）',15],height:['高（cm）',15],weight:['实重（kg）',16],packType:['尺寸类型',18],store:['店铺',18],
 chinaPrice:['中国组合价（RMB）',22],salePrice:['美区商品售价（USD）',24],buyerShipping:['买家运费（USD）',22],receipt:['最终含税实收（USD）',24],logistics:['实际物流成本',20],currency:['物流成本币种',18],
 fx:['结算汇率（RMB/USD）',24],multiplier:['参考售价倍率',20],costRate:['产品成本比例（%）',22],divisor:['去税除数',18],tax:['所得税率（%）',20],promotion:['推广费率（%）',20],operation:['代运营费率（%）',20],platform:['平台佣金率（%）',22],royalty:['版权费率（%）',20],labor:['人工成本率（%）',22],other:['其他费率（%）',20],zone:['美国时区',26]
};
const textKeys=new Set(['packType','store','currency','zone']);
function fieldValue(row:HistoryRow,key:string):ExcelJS.CellValue{
 const value=fields(row)[key];if(value===undefined||value==='')return null;
 if(key==='packType')return value==='naked'?'裸货尺寸':'包裹尺寸';
 return textKeys.has(key)?value:Number(value);
}
function fieldColumns(keys:string[]):Column[]{
 return keys.map(key=>({header:labels[key][0],width:labels[key][1],value:row=>fieldValue(row,key),format:textKeys.has(key)?undefined:['length','width','height','weight','fx','multiplier','divisor'].includes(key)?preciseFormat:numberFormat}));
}
const modeLabel=(mode:string)=>mode==='actual'?'仅按实重':'实重与材积重取大';
const fill=(color:string):ExcelJS.Fill=>({type:'pattern',pattern:'solid',fgColor:{argb:color}});
function styleCell(cell:ExcelJS.Cell,background:string,bold=false,color=ink,size=11){
 cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
 cell.font={name:'Microsoft YaHei',size,color:{argb:color},bold};
 if(typeof cell.value==='string')cell.numFmt='@';
 cell.fill=fill(background);
 const border:Partial<ExcelJS.Border>={style:'thin',color:{argb:line}};
 cell.border={top:border,bottom:border,left:border,right:border};
}
function fitRow(row:ExcelJS.Row,widths:number[],minimum=30){
 let lines=1;
 row.eachCell(cell=>{
  if(typeof cell.value==='string'){
   const length=[...cell.value].reduce((count,char)=>count+(char.charCodeAt(0)>255?2:1),0);
   lines=Math.max(lines,Math.ceil(length/Math.max(1,widths[Number(cell.col)-1]-2)));
  }
 });
 row.height=Math.min(409,Math.max(minimum,lines*17+10));
}
function buildHistorySheet(workbook:ExcelJS.Workbook,rows:HistoryRow[]){
 const groups:ColumnGroup[]=[
  {title:'产品信息',columns:[
   {header:'记录序号',width:12,value:(_row,index)=>index+1},
   {header:'商品名称',width:30,value:row=>String(row.name??'')},
   {header:'商品属性',width:16,value:row=>String(row.category??'')},
   {header:'商品编码',width:24,value:row=>String(row.product_code??'')},
   {header:'规格编码',width:24,value:row=>String(row.spec_code??'')},
   {header:'市场',width:12,value:row=>String(row.market??'US')}
  ]},
  {title:'物流信息',columns:fieldColumns(['length','width','height','weight','packType','store','logistics','currency'])},
  {title:'成交信息',columns:fieldColumns(['chinaPrice','salePrice','buyerShipping','receipt'])},
  {title:'基础参数',columns:fieldColumns(['fx','multiplier','costRate','divisor','zone'])},
  {title:'扣点与税费',columns:fieldColumns(['promotion','operation','platform','royalty','labor','other','tax'])},
  {title:'物流计费',columns:(['code','cny','chargeWeight','volumeWeight','rate','fee','extra'] as const).map((key,index)=>({header:['测算渠道','预计物流成本（RMB）','计费重（kg）','材积重（kg）','运价（元/kg）','票费（元）','店铺附加费（RMB）'][index],width:24,value:row=>(row.snapshot as Snapshot)?.quote?.[key]??null,format:key==='code'?undefined:['chargeWeight','volumeWeight'].includes(key)?preciseFormat:numberFormat}))},
  {title:'利润结果',result:true,columns:[
   {header:'净利润（RMB）',width:22,value:row=>row.net_rmb==null?null:Number(row.net_rmb),format:numberFormat},
   {header:'净利润（USD）',width:22,value:row=>row.net_usd==null?null:Number(row.net_usd),format:numberFormat},
   {header:'净利润率',width:18,value:row=>row.margin===null?null:Number(row.margin),format:'0.00%;[Red](0.00%);0.00%'}
  ]},
  {title:'记录信息',columns:[
   {header:'操作人',width:20,value:row=>String(row.operator_name??'未记录')},
   {header:'当前版本',width:14,value:row=>Number(row.version)},
   {header:'保存时间（北京时间）',width:28,value:row=>new Date(new Date(String(row.updated_at)).getTime()+8*60*60*1000),format:'yyyy-mm-dd hh:mm:ss'}
  ]}
 ];
 const columns=groups.flatMap(group=>group.columns),widths=columns.map(column=>column.width);
 const sheet=workbook.addWorksheet('历史测算',{properties:{tabColor:{argb:'FFEE640C'}}});
 sheet.columns=widths.map(width=>({width}));
 sheet.addRow([]);sheet.addRow(columns.map(column=>column.header));
 rows.forEach((row,index)=>sheet.addRow(columns.map(column=>column.value(row,index))));
 sheet.eachRow((row,index)=>{
  for(let column=1;column<=columns.length;column++)styleCell(row.getCell(column),index===2?'FFFFE9CF':index%2===1?'FFFFFEFA':'FFFFF5E6',index===2,index===2?'FF8D4219':ink);
  fitRow(row,widths,index===2?46:32);
 });
 let start=1;
 groups.forEach((group,index)=>{
  const end=start+group.columns.length-1;
  sheet.mergeCells(1,start,1,end);
  const heading=sheet.getCell(1,start);heading.value=group.title;
  styleCell(heading,group.result?'FF2E7654':index%2===0?orange:'FFD67738',true,'FFFFFFFF',13);
  for(let column=start;column<=end;column++){
   if(group.result){
    styleCell(sheet.getCell(2,column),'FFE7F0E8',true,'FF286448');
    for(let row=3;row<=sheet.rowCount;row++){
     const cell=sheet.getCell(row,column),value=cell.value;
     styleCell(cell,row%2===1?'FFF2F8F0':'FFEAF3E7',true,typeof value==='number'&&value>0?'FF23714D':ink);
    }
   }
   for(let row=2;row<=sheet.rowCount;row++){
    const cell=sheet.getCell(row,column);
    if(column===start)cell.border={...cell.border,left:{style:'medium',color:{argb:'FFCCAC85'}}};
    if(column===end)cell.border={...cell.border,right:{style:'medium',color:{argb:'FFCCAC85'}}};
   }
  }
  start=end+1;
 });
 sheet.getRow(1).height=32;
 columns.forEach((column,index)=>{if(column.format)sheet.getColumn(index+1).numFmt=column.format});
 sheet.views=[{state:'frozen',xSplit:2,ySplit:2,showGridLines:false,zoomScale:85}];
 sheet.autoFilter={from:{row:2,column:1},to:{row:Math.max(2,sheet.rowCount),column:columns.length}};
 sheet.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:2'};
}
type ReportStyle='body'|'label'|'section'|'channel'|'record';
function buildConfigSheet(workbook:ExcelJS.Workbook,rows:HistoryRow[]){
 const sheet=workbook.addWorksheet('物流配置',{properties:{tabColor:{argb:'FFE3A751'},outlineProperties:{summaryBelow:false,summaryRight:false}}});
 sheet.columns=Array.from({length:8},()=>({width:15}));
 const addRow=(values:ExcelJS.CellValue[],kind:ReportStyle='body')=>{
  const row=sheet.addRow(values),background={body:row.number%2===0?'FFFFFEFA':'FFFFF5E6',label:'FFFFE9CF',section:orange,channel:'FFFFD9AE',record:'FFF3E4CD'}[kind];
  for(let column=1;column<=8;column++)styleCell(row.getCell(column),background,kind!=='body',kind==='section'?'FFFFFFFF':kind==='body'?ink:'FF8D4219',kind==='record'?13:11);
  row.height=kind==='record'?38:kind==='section'?30:32;
  row.outlineLevel=kind==='record'?0:1;
  return row;
 };
 const band=(text:string,kind:ReportStyle)=>{
  const row=addRow([text],kind);sheet.mergeCells(row.number,1,row.number,8);
  row.height=Math.max(row.height??32,Math.ceil([...text].reduce((sum,char)=>sum+(char.charCodeAt(0)>255?2:1),0)/116)*18+12);
  return row;
 };
 const pairs=(values:ExcelJS.CellValue[],kind:ReportStyle='body',formats:Record<number,string>={})=>{
  const row=addRow(values.flatMap(value=>[value,null]),kind);
  values.forEach((value,index)=>{
   const column=index*2+1;sheet.mergeCells(row.number,column,row.number,column+1);if(formats[index])row.getCell(column).numFmt=formats[index];
   if(typeof value==='string')row.height=Math.max(row.height??32,Math.ceil([...value].reduce((sum,char)=>sum+(char.charCodeAt(0)>255?2:1),0)/28)*17+10);
  });
  return row;
 };
 const title=band('物流配置','record');title.height=34;title.getCell(1).fill=fill('FFFFFEFA');
 rows.forEach((record,index)=>{
  sheet.addRow([]).height=10;
  band(`${index+1} · ${String(record.name??'')} · 第 ${Number(record.version)} 版`,'record');
  pairs(['商品编码',String(record.product_code??''),'规格编码',String(record.spec_code??'')],'label');
  const freight=(record.snapshot as Snapshot)?.freight;
  if(!freight){band('此版本未记录物流配置。','body');return}
  band('01  商品规则','section');
  pairs(['商品属性','默认渠道','裸货尺寸倍数','裸货重量倍数'],'label');
  for(const [attribute,route] of Object.entries(freight.routes)){
   const pack=freight.pack[attribute as keyof typeof freight.pack];
   pairs([attribute,route,pack.size,pack.weight],'body',{2:preciseFormat,3:preciseFormat});
  }
  band('02  渠道运价','section');
  for(const [channel,values] of Object.entries(freight.channels)){
   band(`${channel}  ·  计费方式：${modeLabel(values.mode)}`,'channel');
   pairs(['材积除数',values.volumeDivisor,'最低计费重（kg）',values.minWeight],'label',{1:preciseFormat,3:preciseFormat});
   pairs(['起始重量（kg）','结束重量（kg）','运价（元/kg）','票费（元）'],'label');
   for(const tier of values.tiers)pairs([tier.min,tier.max,tier.rate,tier.fee],'body',{0:preciseFormat,1:preciseFormat,2:numberFormat,3:numberFormat});
  }
  band('03  店铺与限制','section');
  pairs(['香港改走渠道',freight.hongKong.overrideChannel,'保留原渠道',freight.hongKong.preserveChannel]);
  pairs(['香港附加费（RMB）',freight.hongKong.extraFee,'最大计费重（kg）',freight.maxWeight],'body',{1:numberFormat,3:preciseFormat});
 });
 sheet.views=[{state:'frozen',ySplit:1,showGridLines:false,zoomScale:90}];
 sheet.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0};
}
export async function exportHistoryWorkbook(rows:HistoryRow[]){
 const workbook=new ExcelJS.Workbook();workbook.creator='CHAOREN AI';workbook.created=new Date();
 buildHistorySheet(workbook,rows);buildConfigSheet(workbook,rows);
 return Buffer.from(await workbook.xlsx.writeBuffer() as unknown as Uint8Array);
}
