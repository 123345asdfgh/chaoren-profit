(function(root){
 'use strict';
 const KEY='cross-border-daily.product-archives.v1';
 function read(storage){
  const raw=storage.getItem(KEY);
  if(raw===null)return [];
  const data=JSON.parse(raw);
  if(data.version!==1||!Array.isArray(data.records)||data.records.some(record=>!record||typeof record.id!=='string'||typeof record.savedAt!=='string'||!['name','specCode','productCode'].every(key=>typeof record[key]==='string')||!record.snapshot||typeof record.snapshot!=='object'))throw Error('存档格式异常，未覆盖原有数据。');
  return data.records;
 }
 function save(storage,identity,snapshot){
  const clean=Object.fromEntries(['name','specCode','productCode'].map(key=>[key,String(identity[key]??'').trim()]));
  if(Object.values(clean).some(value=>!value||value.length>200))throw Error('请完整填写商品名称、规格编码、商品编码，每项不超过200字。');
  const records=read(storage);
  const sameIdentity=record=>['name','specCode','productCode'].every(key=>record[key].trim()===clean[key]);
  const existing=records.find(sameIdentity);
  const record={...clean,id:existing?.id||root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),savedAt:new Date().toISOString(),snapshot};
  storage.setItem(KEY,JSON.stringify({version:1,records:[record,...records.filter(record=>!sameIdentity(record))]}));
  return record;
 }
 function remove(storage,id){
  const records=read(storage);
  const remaining=records.filter(record=>record.id!==id);
  if(remaining.length===records.length)return false;
  storage.setItem(KEY,JSON.stringify({version:1,records:remaining}));
  return true;
 }
 function search(records,query){
  const needle=String(query).trim().toLocaleLowerCase();
  if(!needle)return [];
  return records.filter(record=>['name','specCode','productCode'].some(key=>record[key].toLocaleLowerCase().includes(needle)));
 }
 const api={KEY,read,save,remove,search};root.ArchiveCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
