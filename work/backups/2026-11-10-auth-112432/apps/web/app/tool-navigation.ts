export const toolNavigation=[
 {id:'calculator',href:'/history',label:'跨境测算',icon:'M5 3h14v18H5V3Zm3 4h8M8 11h2m4 0h2M8 15h2m4 0h2M8 18h2m4 0h2'},
 {id:'creator-sampling',href:'/creator-sampling',label:'达人寄样数据看板',icon:'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z'},
 {id:'feishu',href:'/feishu',label:'飞书连接',icon:'m5 4 6 6-3 4-5-6 2-4Zm6 6 8-6 3 4-11 12H5l6-10Z'}
] as const;

export function toolSidebarHtml(active:string){
 return `<aside class="tool-sidebar" aria-label="业务工具侧边栏"><div class="tool-sidebar-brand"><span class="tool-brand-symbol" aria-hidden="true">C</span><span>业务工具</span></div><nav class="tool-sidebar-nav" aria-label="工具导航">${toolNavigation.map(item=>`<a href="${item.href}"${item.id===active?' aria-current="page"':''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${item.icon}"/></svg><span>${item.label}</span></a>`).join('')}</nav></aside>`;
}
