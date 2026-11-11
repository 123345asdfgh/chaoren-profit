import ExcelJS from 'exceljs';
import {createRequire} from 'node:module';
import {expect,it} from 'vitest';
import {exportHistoryWorkbook} from './history-export.js';
const core=createRequire(import.meta.url)('../../web/public/legacy/freight-core.js');
it('exports horizontal history, complete shipping configuration, styled cells and literal product codes',async()=>{
 const row={name:'=商品测试',category:'普货',product_code:'000012',spec_code:'000034',version:2,updated_at:'2026-11-04T03:00:00Z',net_rmb:25.25,net_usd:3.7,margin:.15,snapshot:{fields:{length:'20',width:'15',height:'10',weight:'0.2',packType:'naked',store:'香港店铺',logistics:'70',currency:'RMB'},freight:structuredClone(core.DEFAULT_CONFIG),quote:{code:'USFC',cny:62.22,chargeWeight:.46,volumeWeight:.46,rate:107,fee:12,extra:1}}};
 const buffer=await exportHistoryWorkbook([row]),book=new ExcelJS.Workbook();await book.xlsx.load(Uint8Array.from(buffer).buffer);
 expect(book.worksheets.map(sheet=>sheet.name)).toEqual(['历史测算','物流配置']);
 const sheet=book.worksheets[0],head=sheet.getRow(1).values as string[],column=(label:string)=>head.indexOf(label);
 expect(sheet.rowCount).toBe(2);expect(sheet.getCell(2,column('商品编码')).value).toBe('000012');expect(sheet.getCell(2,column('商品名称')).value).toBe('=商品测试');
 expect(sheet.getCell(2,column('长（cm）')).value).toBe(20);expect(sheet.getCell(2,column('尺寸类型')).value).toBe('裸货尺寸');expect(sheet.getCell(2,column('实际物流成本')).value).toBe(70);
 expect(sheet.getCell(2,column('预计物流成本（RMB）')).value).toBe(62.22);expect(sheet.getCell(2,column('净利润率')).numFmt).toContain('%');
 expect(sheet.getCell('B2').alignment.horizontal).toBe('center');expect(sheet.getCell('B2').border.bottom?.style).toBe('thin');expect(sheet.getCell('A1').font.bold).toBe(true);
 expect(sheet.views[0].state).toBe('frozen');expect(book.worksheets[1].rowCount).toBe(141);
 expect(book.worksheets[1].getCell('J2').value).toBeNull();expect(book.worksheets[1].getCell('J3').value).toBe('倍');
});
