import {rowDate,type SamplingRecord} from './creator-sampling-core.js';
import type {CostedSamplingRecord} from './creator-sampling-costs.js';
const unshipped=/^(否|未邮寄|未寄样|未寄出|未发货|未寄|待寄样|待邮寄|待寄出|待发货|待寄|未邮寄样品|no|false|0)$/i;
const shipped=/^(是|已邮寄|已寄样|已寄出|已发货|已寄|已邮寄样品|yes|true|1)$/i;
/** Classify the entire row before any metric is computed. Never mutate source data. */
export function validateSamplingRecord<T extends SamplingRecord>(record:T):T&SamplingRecord{
 if(record.sourceType==='secondary')return record;
 const reasons:string[]=[];
 if(!rowDate(record.date,'',{from:'1900-01-01',to:'2100-01-01'}))reasons.push('日期缺失或无效');
 if(!record.creator.trim())reasons.push('缺少达人账号');
 if(!/^L[1-7]$/.test(record.level))reasons.push(record.raw?.level?'达人等级无效':'缺少达人等级');
 if(!record.product.trim())reasons.push('缺少商品名称');
 if(record.category.trim()&&!['常规','盲盒','毛绒'].includes(record.category))reasons.push('品类无效');
 if(typeof record.quantity!=='number'||!Number.isFinite(record.quantity)||record.quantity<0)reasons.push('数量缺失或无效');
 if(record.raw?.shipped!==undefined&&!shipped.test(record.raw.shipped)&&!unshipped.test(record.raw.shipped))reasons.push(record.raw.shipped?'寄样状态无效':'缺少寄样状态');
 const cost=record as unknown as CostedSamplingRecord;
 if(record.shipped&&record.product.trim()&&(typeof cost.unitCostRmb!=='number'||!Number.isFinite(cost.unitCostRmb)||cost.unitCostRmb<0))reasons.push(cost.costStatus==='missing-product'?'商品未匹配到商品表':'缺少有效中国组合价');
 return {...record,invalidReasons:reasons,fulfilled:reasons.length?false:record.fulfilled};
}
