'use client';
export type AuthUser={id:string;account:string;displayName:string;role:'admin'|'user';mustChangePassword:boolean};
export {safeNext} from './auth-return';
export async function authRequest(path:string,options:RequestInit={}){
 const response=await fetch('/api/profit'+path,{...options,headers:{...(options.body?{'content-type':'application/json'}:{}),...options.headers},cache:'no-store'});
 const body=await response.json().catch(()=>({error:'服务暂时不可用，请稍后重试'}));
 if(!response.ok){const error=Object.assign(Error(body.error||'操作未完成'),{status:response.status,code:body.code});throw error}
 return body;
}
