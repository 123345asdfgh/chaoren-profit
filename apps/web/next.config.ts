import type {NextConfig} from 'next';
const nextConfig:NextConfig={experimental:{proxyTimeout:310000},async rewrites(){return [{source:'/api/profit/:path*',destination:'http://127.0.0.1:'+String(process.env.API_PORT||'3002')+'/api/profit/:path*'}]}};
export default nextConfig;
