'use client';

import {useState} from 'react';
import './export-excel.css';

export default function ExportExcel({recordId,name,version}:{recordId:string;name:string;version?:number}){
 const [exporting,setExporting]=useState(false),[error,setError]=useState('');
 async function download(){
  setExporting(true);setError('');
  try{
   const response=await fetch('/api/profit/records/'+encodeURIComponent(recordId)+'/export'+(version===undefined?'':'?version='+version));
   if(!response.ok){const data=await response.json();throw Error(data.error||'导出失败')}
   const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=(name||'本单测算').replace(/[\\/:*?"<>|]/g,'_')+(version===undefined?'-测算记录':'-第'+version+'版')+'.xlsx';link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(reason){setError(reason instanceof Error?reason.message:'导出失败')}finally{setExporting(false)}
 }
 return <div className="order-export"><button type="button" className="order-export-button" disabled={exporting} onClick={()=>void download()}>{exporting?'导出中…':'导出 Excel'}</button>{error&&<span className="order-export-error" role="alert">{error}</span>}</div>;
}
