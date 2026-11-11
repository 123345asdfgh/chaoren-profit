// Accept only local return paths, after URL normalization removes control characters.
export function safeNext(value:string|null,fallback='/history'){
 if(!value||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return fallback;
 try{const url=new URL(value,'http://auth.local');if(url.origin!=='http://auth.local'||/^\/(?:login|account\/password)(?:[/?#]|$)/.test(url.pathname))return fallback;return url.pathname+url.search+url.hash}catch{return fallback}
}
