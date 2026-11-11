import fs from 'node:fs/promises';
import {exportHistoryWorkbook} from '../apps/api/src/history-export.js';
const record=JSON.parse(await fs.readFile(new URL('inline-freight-browser-record.json',import.meta.url),'utf8'));
const row={...record,name:'物流测算示例',product_code:record.productCode,spec_code:record.specCode,operator_name:record.operatorName,updated_at:record.savedAt,net_rmb:record.netRmb,net_usd:record.netUsd};
await fs.writeFile(new URL('xlsx-preview/grouped-export.xlsx',import.meta.url),await exportHistoryWorkbook([row]));
