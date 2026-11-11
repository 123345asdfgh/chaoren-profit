'use client';
import {useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';
export default function PasswordField({label,value,onChange,autoComplete='current-password',id,help,disabled=false}:{label:string;value:string;onChange:(value:string)=>void;autoComplete?:string;id:string;help?:string;disabled?:boolean}){
 const [visible,setVisible]=useState(false);
 return <label className="auth-field" htmlFor={id}>{label}<span className="auth-password"><input id={id} type={visible?'text':'password'} value={value} onChange={event=>onChange(event.target.value)} required maxLength={128} autoComplete={autoComplete} disabled={disabled} aria-describedby={help?id+'-help':undefined}/><button type="button" aria-label={visible?'隐藏'+label:'显示'+label} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></span>{help&&<small id={id+'-help'}>{help}</small>}</label>;
}
