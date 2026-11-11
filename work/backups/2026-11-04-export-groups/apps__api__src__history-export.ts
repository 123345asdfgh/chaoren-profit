import ExcelJS from 'exceljs';
import type {z} from 'zod';
import type {freightConfigSchema} from './freight-config.js';
import type {FreightQuote} from './snapshot.js';

type FreightConfig=z.infer<typeof freightConfigSchema>;
type HistoryRow=Record<string,unknown>;
type Snapshot={fields?:Record<string,string>;freight?:FreightConfig;quote?:FreightQuote|null};
type Column={header:string;width:number;value:(row:HistoryRow,index:number)=>ExcelJS.CellValue;format?:string};
const numberFormat='#,##0.00;[Red](#,##0.00);0.00';
const fields=(row:HistoryRow)=>(row.snapshot as Snapshot)?.fields??{};
const labels:[string,string,number][]=[
 ['length','长（cm）',15],['width','宽（cm）',15],['height','高（cm）',15],['weight','实重（kg）',16],['packType','尺寸类型',18],['store','店铺',18],
 ['chinaPrice','中国组合价（RMB）',22],['salePrice','美区商品售价（USD）',24],['buyerShipping','买家运费（USD）',22],['receipt','最终含税实收（USD）',24],['logistics','实际物流成本',20],['currency','物流成本币种',18],
 ['fx','结算汇率（RMB/USD）',24],['multiplier','参考售价倍率',20],['costRate','产品成本比例（%）',22],['divisor','去税除数',18],['tax','所得税率（%）',20],['promotion','推广费率（%）',20],['operation','代运营费率（%）',20],['platform','平台佣金率（%）',22],['royalty','版权费率（%）',20],['labor','人工成本率（%）',22],['other','其他费率（%）',20],['zone','美国时区',26]
];
const textKeys=new Set(['packType','store','currency','zone']);
function fieldValue(row:HistoryRow,key:string):ExcelJS.CellValue{
 const value=fields(row)[key];if(value===undefined||value==='')return null;
 if(key==='packType')return value==='naked'?'裸货尺寸':'包裹尺寸';
 return textKeys.has(key)?value:Number(value);
}
const modeLabel=(mode:string)=>mode==='actual'?'仅按实重':'实重与材积重取大';
function styleSheet(sheet:ExcelJS.Worksheet,widths:number[],freezeColumns=0){
 sheet.views=[{state:'frozen',xSplit:freezeColumns,ySplit:1,showGridLines:false}];
 sheet.columns=widths.map(width=>({width}));
 sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:widths.length}};
 sheet.eachRow((row,index)=>{
  let lines=1;
  for(let column=1;column<=widths.length;column++){
   const cell=row.getCell(column);
   if(typeof cell.value==='string')lines=Math.max(lines,Math.ceil([...cell.value].reduce((count,char)=>count+(char.charCodeAt(0)>255?2:1),0)/Math.max(1,widths[column-1]-2)));
   cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
   cell.font={name:'Microsoft YaHei',size:11,color:{argb:index===1?'FF9C4208':'FF172440'},bold:index===1};
   cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:index===1?'FFFFDAB1':index%2===0?'FFFFFEFA':'FFFFF5E6'}};
   const line:Partial<ExcelJS.Border>={style:'thin',color:{argb:'FFE6D5BB'}};
   cell.border={top:line,bottom:line,left:line,right:line};
  }
  row.height=Math.min(409,Math.max(index===1?42:30,lines*17+10));
 });
 sheet.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:1'};
}
export async function exportHistoryWorkbook(rows:HistoryRow[]){
 const workbook=new ExcelJS.Workbook();workbook.creator='CHAOREN AI';workbook.created=new Date();
 const columns:Column[]=[
  {header:'记录序号',width:12,value:(_row,index)=>index+1},
  {header:'商品名称',width:30,value:row=>String(row.name??'')},
  {header:'商品属性',width:16,value:row=>String(row.category??'')},
  {header:'商品编码',width:24,value:row=>String(row.product_code??'')},
  {header:'规格编码',width:24,value:row=>String(row.spec_code??'')},
  {header:'操作人',width:20,value:row=>String(row.operator_name??'未记录')},
  {header:'市场',width:12,value:row=>String(row.market??'US')},
  {header:'当前版本',width:14,value:row=>Number(row.version)},
  {header:'保存时间（北京时间）',width:28,value:row=>new Date(new Date(String(row.updated_at)).getTime()+8*60*60*1000),format:'yyyy-mm-dd hh:mm:ss'},
  {header:'净利润（RMB）',width:22,value:row=>Number(row.net_rmb),format:numberFormat},
  {header:'净利润（USD）',width:22,value:row=>Number(row.net_usd),format:numberFormat},
  {header:'净利润率',width:18,value:row=>row.margin===null?null:Number(row.margin),format:'0.00%;[Red](0.00%);0.00%'},
  ...labels.map(([key,header,width]):Column=>({header,width,value:row=>fieldValue(row,key),format:textKeys.has(key)?undefined:key==='weight'?'0.######':numberFormat})),
  ...(['code','cny','chargeWeight','volumeWeight','rate','fee','extra'] as const).map((key,index):Column=>({header:['测算渠道','预计物流成本（RMB）','计费重（kg）','材积重（kg）','命中运价（元/kg）','命中票费（元）','店铺附加费（RMB）'][index],width:24,value:row=>(row.snapshot as Snapshot)?.quote?.[key]??null,format:key==='code'?undefined:numberFormat}))
 ];
 const sheet=workbook.addWorksheet('历史测算',{properties:{tabColor:{argb:'FFEE640C'}}});
 sheet.addRow(columns.map(column=>column.header));
 rows.forEach((row,index)=>sheet.addRow(columns.map(column=>column.value(row,index))));
 styleSheet(sheet,columns.map(column=>column.width),5);
 columns.forEach((column,index)=>{if(column.format)sheet.getColumn(index+1).numFmt=column.format});
 const config=workbook.addWorksheet('物流配置',{properties:{tabColor:{argb:'FFE3A751'}}});
 config.addRow(['记录序号','商品名称','商品编码','规格编码','当前版本','配置分类','商品属性 / 渠道','配置项','保存值','单位']);
 rows.forEach((row,index)=>{
  const freight=(row.snapshot as Snapshot)?.freight;
  const add=(group:string,scope:string,item:string,value:ExcelJS.CellValue,unit:string|null=null)=>config.addRow([index+1,String(row.name??''),String(row.product_code??''),String(row.spec_code??''),Number(row.version),group,scope,item,value,unit]);
  if(!freight){add('历史说明','—','本版本未记录物流配置',null);return}
  for(const [attribute,route] of Object.entries(freight.routes)){
   add('商品规则',attribute,'默认渠道',route);
   add('商品规则',attribute,'裸货尺寸倍数',freight.pack[attribute as keyof typeof freight.pack].size,'倍');
   add('商品规则',attribute,'裸货重量倍数',freight.pack[attribute as keyof typeof freight.pack].weight,'倍');
  }
  for(const [channel,values] of Object.entries(freight.channels)){
   add('渠道运价',channel,'计费方式',modeLabel(values.mode));add('渠道运价',channel,'材积除数',values.volumeDivisor);add('渠道运价',channel,'最低计费重',values.minWeight,'kg');
   values.tiers.forEach((tier,tierIndex)=>{
    const title='第'+(tierIndex+1)+'档 · ';
    add('渠道运价',channel,title+'起始重量',tier.min,'kg');add('渠道运价',channel,title+'结束重量',tier.max,'kg');
    add('渠道运价',channel,title+'运价',tier.rate,'元/kg');add('渠道运价',channel,title+'票费',tier.fee,'元');
   });
  }
  add('店铺与限制','香港店铺','香港改走渠道',freight.hongKong.overrideChannel);add('店铺与限制','香港店铺','保留原渠道',freight.hongKong.preserveChannel);
  add('店铺与限制','香港店铺','香港附加费',freight.hongKong.extraFee,'RMB');add('店铺与限制','全部','最大计费重',freight.maxWeight,'kg');
 });
 styleSheet(config,[12,30,24,24,14,18,22,28,30,16],5);
 return Buffer.from(await workbook.xlsx.writeBuffer() as unknown as Uint8Array);
}
