import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const securityHeaders: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https://i.ibb.co https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://kedpzpmswblzefavjunt.supabase.co https://api.pay.hoopay.com.br ws://localhost:8080 ws://127.0.0.1:8080",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; "),
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
};

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    headers: securityHeaders,
  },
  preview: {
    headers: securityHeaders,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
    minify: "esbuild",
  },
}));
