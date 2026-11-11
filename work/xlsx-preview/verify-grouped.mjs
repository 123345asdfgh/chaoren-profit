import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const workbook=await SpreadsheetFile.importXlsx(await FileBlob.load(fileURLToPath(new URL('grouped-export.xlsx',import.meta.url))));
console.log((await workbook.inspect({kind:'sheet',include:'id,name',maxChars:1000})).ndjson);
console.log((await workbook.inspect({kind:'region',sheetId:'历史测算',range:'A1:N3',tableMaxRows:3,tableMaxCols:14,maxChars:2400})).ndjson);
for(const [sheetName,range,file] of [['历史测算','A1:N3','历史导出-分层表头'],['历史测算','O1:AD3','历史导出-成交与参数'],['历史测算','AE1:AQ3','历史导出-计费与利润'],['物流配置','A1:H25','物流配置-商品与渠道'],['物流配置','A44:H55','物流配置-店铺规则']]){
 const preview=await workbook.render({sheetName,range,scale:1.2,format:'png'});
 await fs.writeFile(new URL(file+'.png',import.meta.url),new Uint8Array(await preview.arrayBuffer()));
}
