import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const workbook=await SpreadsheetFile.importXlsx(await FileBlob.load(fileURLToPath(new URL('verified-export.xlsx',import.meta.url))));
console.log((await workbook.inspect({kind:'sheet',include:'id,name',maxChars:1000})).ndjson);
console.log((await workbook.inspect({kind:'region',sheetId:'历史测算',range:'M1:X2',tableMaxRows:2,tableMaxCols:12,maxChars:2400})).ndjson);
console.log((await workbook.inspect({kind:'region',sheetId:'历史测算',range:'AK1:AQ2',tableMaxRows:2,tableMaxCols:7,maxChars:1600})).ndjson);
for(const [sheetName,range,file] of [['历史测算','M1:X2','物流输入'],['历史测算','AK1:AQ2','预计运费'],['物流配置','F1:J14','物流配置']]){
 const preview=await workbook.render({sheetName,range,scale:1.5,format:'png'});
 await fs.writeFile(new URL(file+'.png',import.meta.url),new Uint8Array(await preview.arrayBuffer()));
}
