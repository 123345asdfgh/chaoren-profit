(()=>{
 const originalFetch=window.fetch.bind(window);
 let redirecting=false;
 const redirect=(password=false)=>{
  if(redirecting||location.pathname==='/login'||password&&location.pathname==='/account/password')return;
  redirecting=true;const next=location.pathname+location.search;
  location.replace((password?'/account/password?required=1&next=':'/login?next=')+encodeURIComponent(next));
 };
 window.fetch=async(...args)=>{
  const response=await originalFetch(...args);
  try{
   const input=args[0],url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
   if(url.origin===location.origin&&url.pathname.startsWith('/api/profit/')&&[401,403].includes(response.status)&&response.headers.get('content-type')?.includes('application/json')){
    const data=await response.clone().json();if(data.code==='UNAUTHENTICATED')redirect();if(data.code==='PASSWORD_CHANGE_REQUIRED')redirect(true);
   }
  }catch{}
  return response;
 };
 const nodes=new Set();let user=null;
 async function logout(button){
  const action=async()=>{
   button.disabled=true;
   try{const response=await originalFetch('/api/profit/auth/logout',{method:'POST'});if(!response.ok&&response.status!==401)throw Error('退出失败，请重试');window.MeasurementNavigation?window.MeasurementNavigation.leave('/login'):location.assign('/login')}
   catch(error){button.disabled=false;button.textContent=error.message}
  };
  if(window.MeasurementNavigation)await window.MeasurementNavigation.run(action,{title:'退出登录？',message:'未保存的修改将丢失。',confirmLabel:'放弃修改并退出'});else await action();
 }
 function syncAdminNavigation(){
  for(const nav of document.querySelectorAll('.tool-sidebar-nav')){
   nav.hidden=Boolean(user?.mustChangePassword);
   nav.setAttribute('aria-hidden',String(Boolean(user?.mustChangePassword)));
   let link=nav.querySelector('[data-admin-navigation]');
   if(user?.role!=='admin'||user.mustChangePassword){link?.remove();continue}
   if(!link){
    link=document.createElement('a');link.href='/admin/users';link.dataset.adminNavigation='';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    for(const [key,value]of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.6','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,value);
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z');svg.append(path);
    const label=document.createElement('span');label.textContent='用户管理';link.append(svg,label);nav.append(link);
   }
   if(location.pathname.startsWith('/admin/'))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  }
 }
 function render(node){
  syncAdminNavigation();node.replaceChildren();if(!user)return;
  const details=document.createElement('details'),summary=document.createElement('summary');
  const avatar=document.createElement('span');avatar.className='tool-user-avatar';avatar.textContent=user.displayName.slice(0,1);
  const identity=document.createElement('span');identity.className='tool-user-identity';
  const name=document.createElement('strong');name.textContent=user.displayName;
  const role=document.createElement('small');role.textContent=user.role==='admin'?'管理员':'普通用户';identity.append(name,role);
  const arrow=document.createElement('span');arrow.textContent='⌃';arrow.className='tool-user-chevron';summary.append(avatar,identity,arrow);
  const menu=document.createElement('div');menu.className='tool-user-menu';
  const password=document.createElement('a');password.href='/account/password?next='+encodeURIComponent(location.pathname==='/account/password'?'/history':location.pathname+location.search);password.textContent='修改密码';menu.append(password);
  const exit=document.createElement('button');exit.type='button';exit.textContent='退出登录';exit.addEventListener('click',()=>void logout(exit));menu.append(exit);
  details.append(summary,menu);node.append(details);
 }
 let pending=null;
 async function refresh(){
  if(pending)return pending;
  pending=(async()=>{try{const response=await originalFetch('/api/profit/auth/session',{cache:'no-store'});if(response.status===401){redirect();return}if(!response.ok)return;user=(await response.json()).user;for(const node of nodes)if(node.isConnected)render(node)}catch{}finally{pending=null}})();return pending;
 }
 window.ProfitAuth={mount(node){nodes.add(node);if(user)render(node);else void refresh()}};
 window.addEventListener('profit:session-changed',()=>void refresh());
 window.addEventListener('pageshow',event=>{if(event.persisted&&location.pathname!=='/login')void refresh()});
 if(document.body?.hasAttribute('data-legacy-auth'))document.addEventListener('DOMContentLoaded',()=>{for(const node of document.querySelectorAll('[data-account-menu]'))window.ProfitAuth.mount(node)},{once:true});
 window.dispatchEvent(new Event('profit:auth-ready'));
})();
