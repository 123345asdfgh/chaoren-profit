import type {Metadata} from 'next';
import Script from 'next/script';
import ToolSidebar from './tool-sidebar';
import '../public/legacy/tool-shell.css';
import '../public/legacy/brand-banner.css';
export const metadata:Metadata={title:'跨境利润测算 · chaoren AI'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body className="tool-layout"><Script src="/legacy/auth-session.js" strategy="beforeInteractive"/><ToolSidebar/>{children}</body></html>}
