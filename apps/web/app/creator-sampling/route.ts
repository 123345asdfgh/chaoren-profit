import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {toolSidebarHtml} from '../tool-navigation';
export const dynamic='force-dynamic';
export async function GET(){
 const source=await readFile(path.join(process.cwd(),'public/creator-sampling/index.html'),'utf8');
 const html=source.replace(/(href|src)="([\w-]+\.(?:css|js))"/g,'$1="/creator-sampling/$2"').replace('</head>','<link rel="stylesheet" href="/legacy/tool-shell.css"><link rel="stylesheet" href="/creator-sampling/integration.css"></head>').replace('<body>','<body class="tool-layout creator-dashboard" data-legacy-auth><script src="/legacy/auth-session.js"></script>'+toolSidebarHtml('creator-sampling'));
 return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}
