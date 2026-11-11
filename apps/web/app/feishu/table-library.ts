type LibraryTable={id:string;name:string;documentName:string;sourceType:'primary'|'secondary';updatedAt:string};
const key=(text:string)=>text.normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
function documentMonth(name:string,now:Date):number|null{
 const full=name.match(/((?:19|20)\d{2})\s*(?:年|[-_.\/])\s*(1[0-2]|0?[1-9])(?:月|[-_.\/]|\D|$)/u);
 if(full)return Number(full[1])*12+Number(full[2]);
 const months=[...name.matchAll(/(?<!\d)(1[0-2]|0?[1-9])\s*月/gu)];
 if(months.length!==1)return null;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).formatToParts(now);
 const month=Number(months[0][1]),current=Number(parts.find(part=>part.type==='month')!.value);
 const year=Number(parts.find(part=>part.type==='year')!.value)-(month>current?1:0);
 return year*12+month;
}
/** Search every saved secondary source; the default list shows the newest named month. */
export function secondaryTableChoices<T extends LibraryTable>(tables:T[],query:string,now=new Date()):T[]{
 const secondary=tables.filter(table=>table.sourceType==='secondary').map(table=>({table,month:documentMonth(table.documentName,now)}));
 secondary.sort((a,b)=>(b.month??-1)-(a.month??-1)||b.table.updatedAt.localeCompare(a.table.updatedAt)||a.table.id.localeCompare(b.table.id));
 const search=key(query);
 if(search)return secondary.filter(({table})=>key(table.documentName).includes(search)||key(table.name).includes(search)).map(({table})=>table);
 const newest=secondary.find(item=>item.month!==null)?.month;
 return (newest!==undefined?secondary.filter(item=>item.month===newest):secondary.slice(0,1)).map(({table})=>table);
}
