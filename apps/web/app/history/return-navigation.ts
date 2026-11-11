'use client';

import {useEffect,useState} from 'react';

// Only a history list URL can be carried through the detail/edit flow.
export function safeHistoryReturn(value:string|null){
 if(!value)return '/history';
 try{const url=new URL(value,'http://history.local');return url.origin==='http://history.local'&&url.pathname==='/history'?url.pathname+url.search:'/history'}catch{return '/history'}
}
export function withHistoryReturn(destination:string,listHref:string){
 const url=new URL(destination,'http://history.local');
 if(url.pathname==='/history')return safeHistoryReturn(listHref);
 url.searchParams.set('historyReturn',safeHistoryReturn(listHref));
 return url.pathname+url.search;
}
export function useHistoryReturn(){
 const [href,setHref]=useState('/history');
 useEffect(()=>{const update=()=>setHref(safeHistoryReturn(new URLSearchParams(window.location.search).get('historyReturn')));update();window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update)},[]);
 return href;
}
