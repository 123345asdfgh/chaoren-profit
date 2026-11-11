'use client';
import {usePathname} from 'next/navigation';
import AuthAccount from './auth-account';
import {toolNavigation} from './tool-navigation';

export default function ToolSidebar(){
 const pathname=usePathname();
 if(pathname==='/login')return null;
 const active=pathname.startsWith('/admin/')?'admin':pathname.startsWith('/feishu')?'feishu':pathname.startsWith('/creator-sampling')?'creator-sampling':'calculator';
 return <aside className="tool-sidebar" aria-label="业务工具侧边栏">
  <div className="tool-sidebar-brand"><span className="tool-brand-symbol" aria-hidden="true">C</span><span>业务工具</span></div>
  <nav className="tool-sidebar-nav" aria-label="工具导航" hidden={pathname==='/account/password'}>{toolNavigation.map(item=><a key={item.id} href={item.href} aria-current={item.id===active?'page':undefined}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.icon}/></svg><span>{item.label}</span></a>)}</nav>
  <AuthAccount/>
 </aside>;
}
