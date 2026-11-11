'use client';
import {useEffect,useRef} from 'react';
import {usePathname} from 'next/navigation';
declare global {interface Window {ProfitAuth?:{mount:(node:HTMLElement)=>void};}}
export default function AuthAccount(){
 const ref=useRef<HTMLDivElement>(null),pathname=usePathname();
 useEffect(()=>{const mount=()=>{if(ref.current)window.ProfitAuth?.mount(ref.current)};mount();window.addEventListener('profit:auth-ready',mount);return()=>window.removeEventListener('profit:auth-ready',mount)},[pathname]);
 return <div className="tool-account" data-account-menu ref={ref}/>;
}
