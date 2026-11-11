'use client';
import {useState} from 'react';
import Image from 'next/image';
import {ArrowRight,LockKeyhole} from 'lucide-react';
import PasswordField from '../password-field';
import {authRequest,safeNext} from '../auth-client';
import '../auth.css';
export default function Login(){
 const [phone,setPhone]=useState(''),[password,setPassword]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState('');
 async function submit(event:React.FormEvent){event.preventDefault();if(pending)return;setPending(true);setError('');try{const data=await authRequest('/auth/login',{method:'POST',body:JSON.stringify({phone:phone.trim(),password})});const next=safeNext(new URLSearchParams(window.location.search).get('next'));window.location.replace(data.user.mustChangePassword?'/account/password?required=1&next='+encodeURIComponent(next):next)}catch(reason){setError((reason as Error).message);setPending(false)}}
 return <main className="auth-login"><section className="auth-brand"><Image src="/legacy/assets/chaoren-logo.png" width={300} height={169} alt="超韧 AI" priority/><span className="auth-eyebrow">CHAOREN AI · 工作台</span><h1>让每一次出海，<br/><em>更有底气。</em></h1><p>商品测算、历史追踪与达人寄样，<br/>在同一个工作台里协作。</p><Image className="auth-mascot" src="/legacy/assets/chaoren-mascot.png" width={370} height={278} alt="超韧猫咪" priority/></section><section className="auth-login-card"><div className="auth-card-symbol"><LockKeyhole size={25}/></div><h2>登录工作台</h2><p className="auth-subtitle">使用手机号登录工作台</p><form onSubmit={event=>void submit(event)}><label className="auth-field" htmlFor="login-phone">手机号<input id="login-phone" type="tel" inputMode="tel" value={phone} onChange={event=>setPhone(event.target.value)} required pattern="1[3-9][0-9]{9}" title="请输入有效的 11 位中国大陆手机号" maxLength={11} autoComplete="username" autoFocus disabled={pending} placeholder="请输入 11 位手机号"/></label><PasswordField id="login-password" label="密码" value={password} onChange={setPassword} disabled={pending}/>{error&&<p className="auth-feedback error" role="alert">{error}</p>}<button className="auth-primary" type="submit" disabled={pending}>{pending?'登录中…':'登录'}<ArrowRight size={18}/></button></form><p className="auth-login-note">忘记密码？请联系管理员重置。</p></section></main>;
}
