import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {toolSidebarHtml} from '../tool-navigation';
export const dynamic='force-dynamic';
export async function GET(){const source=await readFile(path.join(process.cwd(),'public/legacy/index.html'),'utf8');const html=source.replace(/(href|src)="([\w-]+\.(?:css|js)|assets\/[^\"]+)"/g,'$1="/legacy/$2"').replace('href="/legacy/history-comparison.css"','href="/legacy/history-comparison.css?v=20261111-9"').replace('src="/legacy/history-comparison.js"','src="/legacy/history-comparison.js?v=20261111-9"').replace('</head>','<link rel="stylesheet" href="/legacy/tool-shell.css"></head>').replace('<body>','<body class="tool-layout" data-legacy-auth><script src="/legacy/auth-session.js"></script>'+toolSidebarHtml('calculator'));return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})}
