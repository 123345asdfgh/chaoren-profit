import {NextRequest,NextResponse} from 'next/server';

import {safeNext} from './app/auth-return';
export async function proxy(request:NextRequest){
 const {pathname,search}=request.nextUrl;
 const headers={'cookie':request.headers.get('cookie')||''};
 let user:{role:string;mustChangePassword:boolean}|null=null;
 let verificationUnavailable=false;
 try{
  const response=await fetch('http://127.0.0.1:'+String(process.env.API_PORT||3002)+'/api/profit/auth/session',{headers,cache:'no-store'});
  if(response.ok){user=(await response.json()).user;if(!user)verificationUnavailable=true}
  else if(response.status!==401)verificationUnavailable=true;
 }catch{
  verificationUnavailable=true;
 }
 if(verificationUnavailable){
  if(pathname==='/login')return NextResponse.next();
  return new NextResponse('服务暂时不可用，请稍后刷新重试。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Retry-After':'5'}});
 }
 const target=safeNext(request.nextUrl.searchParams.get('next'));
 if(!user){
  if(pathname==='/login')return NextResponse.next();
  const login=new URL('/login',request.url);login.searchParams.set('next',pathname+search);return NextResponse.redirect(login);
 }
 if(user.mustChangePassword&&pathname!=='/account/password'){
  const password=new URL('/account/password',request.url);password.searchParams.set('required','1');password.searchParams.set('next',pathname==='/login'?target:safeNext(pathname+search));return NextResponse.redirect(password);
 }
 if(pathname==='/login')return NextResponse.redirect(new URL(target,request.url));
 if(pathname.startsWith('/admin')&&user.role!=='admin')return NextResponse.redirect(new URL('/history',request.url));
 const response=NextResponse.next();response.headers.set('Cache-Control','no-store');return response;
}
export const config={matcher:['/','/login','/history/:path*','/calculator','/creator-sampling','/feishu','/account/:path*','/admin/:path*']};
