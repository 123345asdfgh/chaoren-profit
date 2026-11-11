import ExcelJS from 'exceljs';
import {createRequire} from 'node:module';
import {expect,it} from 'vitest';
import {exportHistoryWorkbook} from './history-export.js';
const core=createRequire(import.meta.url)('../../web/public/legacy/freight-core.js');
it('exports grouped horizontal history with centered borders and literal product codes',async()=>{
 const row={name:'=商品测试',category:'普货',product_code:'000012',spec_code:'000034',version:2,updated_at:'2026-11-04T03:00:00Z',net_rmb:25.25,net_usd:3.7,margin:.15,snapshot:{fields:{length:'20',width:'15',height:'10',weight:'0.2',packType:'naked',store:'香港店铺',logistics:'70',currency:'RMB'},freight:structuredClone(core.DEFAULT_CONFIG),quote:{code:'USFC',cny:62.22,chargeWeight:.46,volumeWeight:.46,rate:107,fee:12,extra:1}}};
 const buffer=await exportHistoryWorkbook([row]),book=new ExcelJS.Workbook();await book.xlsx.load(Uint8Array.from(buffer).buffer);
 expect(book.worksheets.map(sheet=>sheet.name)).toEqual(['历史测算','物流配置']);
 const sheet=book.worksheets[0],head=sheet.getRow(2).values as string[],column=(label:string)=>head.indexOf(label);
 expect(sheet.rowCount).toBe(3);expect(sheet.getCell(3,column('商品编码')).value).toBe('000012');expect(sheet.getCell(3,column('商品名称')).value).toBe('=商品测试');
 expect(sheet.getCell(3,column('长（cm）')).value).toBe(20);expect(sheet.getCell(3,column('尺寸类型')).value).toBe('裸货尺寸');expect(sheet.getCell(3,column('实际物流成本')).value).toBe(70);
 expect(sheet.getCell(3,column('预计物流成本（RMB）')).value).toBe(62.22);expect(sheet.getCell(3,column('净利润率')).numFmt).toContain('%');
 expect(sheet.getCell(1,column('商品名称')).value).toBe('产品信息');expect(sheet.getCell(1,column('长（cm）')).value).toBe('物流信息');expect(sheet.getCell(1,column('实际物流成本')).value).toBe('物流信息');expect(sheet.getCell(1,column('净利润率')).value).toBe('利润结果');
 expect(sheet.getCell('B3').alignment.horizontal).toBe('center');expect(sheet.getCell('B3').border.bottom?.style).toBe('thin');expect(sheet.getCell('A1').font.bold).toBe(true);
 expect(sheet.views[0]).toMatchObject({state:'frozen',ySplit:2,xSplit:2});expect(sheet.autoFilter).toBe('A2:AQ3');
 const config=book.worksheets[1],find=(label:string)=>{for(let row=1;row<=config.rowCount;row++)if(config.getCell(row,1).value===label)return row;throw Error('Missing configuration: '+label)};
 expect(config.getCell('C4').value).toBe('000012');
 for(const [attribute,route] of Object.entries(core.DEFAULT_CONFIG.routes)){
  const index=find(attribute),pack=core.DEFAULT_CONFIG.pack[attribute];
  expect([config.getCell(index,3).value,config.getCell(index,5).value,config.getCell(index,7).value]).toEqual([route,pack.size,pack.weight]);
 }
 for(const [channel,values] of Object.entries(core.DEFAULT_CONFIG.channels) as [string,{mode:string;volumeDivisor:number;minWeight:number;tiers:{min:number;max:number;rate:number;fee:number}[]}][]){
  const heading=find(`${channel}  ·  计费方式：${values.mode==='actual'?'仅按实重':'实重与材积重取大'}`);
  expect(config.getCell(heading+1,3).value).toBe(values.volumeDivisor);expect(config.getCell(heading+1,7).value).toBe(values.minWeight);
  values.tiers.forEach((tier,index)=>expect([1,3,5,7].map(column=>config.getCell(heading+3+index,column).value)).toEqual([tier.min,tier.max,tier.rate,tier.fee]));
 }
 const store=find('香港改走渠道');expect([config.getCell(store,3).value,config.getCell(store,7).value,config.getCell(store+1,3).value,config.getCell(store+1,7).value]).toEqual(['USFC','USTM',1,10]);
 expect(config.getCell(store,3).alignment.horizontal).toBe('center');expect(config.getCell(store,3).border.bottom?.style).toBe('thin');
});
it('keeps legacy configuration and missing shipping values explicit',async()=>{
 const buffer=await exportHistoryWorkbook([{name:'旧记录',version:1,updated_at:'2026-11-04T03:00:00Z',net_rmb:0,net_usd:0,margin:null,snapshot:{fields:{}}}]),book=new ExcelJS.Workbook();await book.xlsx.load(Uint8Array.from(buffer).buffer);
 const sheet=book.worksheets[0],head=sheet.getRow(2).values as string[];
 expect(sheet.getCell(3,head.indexOf('实重（kg）')).value).toBeNull();expect(sheet.getCell(3,head.indexOf('净利润率')).value).toBeNull();expect(book.worksheets[1].getCell('A5').value).toBe('此版本未记录物流配置。');
});
it('exports readable group headers when the filter has no matches',async()=>{
 const buffer=await exportHistoryWorkbook([]),book=new ExcelJS.Workbook();await book.xlsx.load(Uint8Array.from(buffer).buffer);
 expect(book.worksheets[0].rowCount).toBe(2);expect(book.worksheets[0].getCell('B2').value).toBe('商品名称');expect(book.worksheets[1].getCell('A1').value).toBe('物流配置');
});
