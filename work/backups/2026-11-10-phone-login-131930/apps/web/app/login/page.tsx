'use client';
import {useState} from 'react';
import Image from 'next/image';
import {ArrowRight,LockKeyhole} from 'lucide-react';
import PasswordField from '../password-field';
import {authRequest,safeNext} from '../auth-client';
import '../auth.css';
export default function Login(){
 const [account,setAccount]=useState(''),[password,setPassword]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState('');
 async function submit(event:React.FormEvent){event.preventDefault();if(pending)return;setPending(true);setError('');try{const data=await authRequest('/auth/login',{method:'POST',body:JSON.stringify({account:account.trim(),password})});const next=safeNext(new URLSearchParams(window.location.search).get('next'));window.location.replace(data.user.mustChangePassword?'/account/password?required=1&next='+encodeURIComponent(next):next)}catch(reason){setError((reason as Error).message);setPending(false)}}
 return <main className="auth-login"><section className="auth-brand"><Image src="/legacy/assets/chaoren-logo.png" width={300} height={169} alt="超韧 AI" priority/><span className="auth-eyebrow">CHAOREN AI · 工作台</span><h1>让每一次出海，<br/><em>更有底气。</em></h1><p>商品测算、历史追踪与达人寄样，<br/>在同一个工作台里协作。</p><Image className="auth-mascot" src="/legacy/assets/chaoren-mascot.png" width={370} height={278} alt="超韧猫咪" priority/></section><section className="auth-login-card"><div className="auth-card-symbol"><LockKeyhole size={25}/></div><h2>登录工作台</h2><p className="auth-subtitle">使用管理员分配的账号登录</p><form onSubmit={event=>void submit(event)}><label className="auth-field" htmlFor="login-account">账号<input id="login-account" value={account} onChange={event=>setAccount(event.target.value)} required maxLength={64} autoComplete="username" autoFocus disabled={pending} placeholder="请输入账号"/></label><PasswordField id="login-password" label="密码" value={password} onChange={setPassword} disabled={pending}/>{error&&<p className="auth-feedback error" role="alert">{error}</p>}<button className="auth-primary" type="submit" disabled={pending}>{pending?'登录中…':'登录'}<ArrowRight size={18}/></button></form><p className="auth-login-note">忘记密码？请联系管理员重置。</p></section></main>;
}
