import ExcelJS from 'exceljs';
import type {FreightQuote} from './snapshot.js';

type HistoryRow=Record<string,unknown>;
type Snapshot={fields?:Record<string,string>;quote?:FreightQuote|null};
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
export async function exportHistoryWorkbook(rows:HistoryRow[]){
 const workbook=new ExcelJS.Workbook();workbook.creator='CHAOREN AI';workbook.created=new Date();
 buildHistorySheet(workbook,rows);
 return Buffer.from(await workbook.xlsx.writeBuffer() as unknown as Uint8Array);
}
