// vite.config.ts
import { defineConfig } from "file:///C:/Users/lk/Downloads/NOVO-ATUALIZADO-PO/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/lk/Downloads/NOVO-ATUALIZADO-PO/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\lk\\Downloads\\NOVO-ATUALIZADO-PO";
var securityHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https://i.ibb.co https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://mufcryvjppadwvqospgd.supabase.co https://api.pay.hoopay.com.br ws://localhost:8080 ws://127.0.0.1:8080",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests"
  ].join("; "),
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Strict-Transport-Security": "max-age=15552000; includeSubDomains"
};
var vite_config_default = defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
    },
    headers: securityHeaders
  },
  preview: {
    headers: securityHeaders
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  build: {
    sourcemap: false,
    minify: "esbuild"
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxsa1xcXFxEb3dubG9hZHNcXFxcTk9WTy1BVFVBTElaQURPLVBPXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxsa1xcXFxEb3dubG9hZHNcXFxcTk9WTy1BVFVBTElaQURPLVBPXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9say9Eb3dubG9hZHMvTk9WTy1BVFVBTElaQURPLVBPL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuXHJcbmNvbnN0IHNlY3VyaXR5SGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcclxuICBcIkNvbnRlbnQtU2VjdXJpdHktUG9saWN5XCI6IFtcclxuICAgIFwiZGVmYXVsdC1zcmMgJ3NlbGYnXCIsXHJcbiAgICBcInNjcmlwdC1zcmMgJ3NlbGYnXCIsXHJcbiAgICBcInN0eWxlLXNyYyAnc2VsZicgJ3Vuc2FmZS1pbmxpbmUnIGh0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb21cIixcclxuICAgIFwiaW1nLXNyYyAnc2VsZicgZGF0YTogaHR0cHM6Ly9pLmliYi5jbyBodHRwczovL3B1Yi1iYjJlMTAzYTMyZGI0ZTE5ODUyNGEyZTllZDhmMzViNC5yMi5kZXZcIixcclxuICAgIFwiZm9udC1zcmMgJ3NlbGYnIGh0dHBzOi8vZm9udHMuZ3N0YXRpYy5jb21cIixcclxuICAgIFwiY29ubmVjdC1zcmMgJ3NlbGYnIGh0dHBzOi8vbXVmY3J5dmpwcGFkd3Zxb3NwZ2Quc3VwYWJhc2UuY28gaHR0cHM6Ly9hcGkucGF5Lmhvb3BheS5jb20uYnIgd3M6Ly9sb2NhbGhvc3Q6ODA4MCB3czovLzEyNy4wLjAuMTo4MDgwXCIsXHJcbiAgICBcImZyYW1lLWFuY2VzdG9ycyAnbm9uZSdcIixcclxuICAgIFwiYmFzZS11cmkgJ3NlbGYnXCIsXHJcbiAgICBcImZvcm0tYWN0aW9uICdzZWxmJ1wiLFxyXG4gICAgXCJvYmplY3Qtc3JjICdub25lJ1wiLFxyXG4gICAgXCJ1cGdyYWRlLWluc2VjdXJlLXJlcXVlc3RzXCIsXHJcbiAgXS5qb2luKFwiOyBcIiksXHJcbiAgXCJYLUZyYW1lLU9wdGlvbnNcIjogXCJERU5ZXCIsXHJcbiAgXCJYLUNvbnRlbnQtVHlwZS1PcHRpb25zXCI6IFwibm9zbmlmZlwiLFxyXG4gIFwiUmVmZXJyZXItUG9saWN5XCI6IFwibm8tcmVmZXJyZXJcIixcclxuICBcIlBlcm1pc3Npb25zLVBvbGljeVwiOiBcImdlb2xvY2F0aW9uPSgpLCBtaWNyb3Bob25lPSgpLCBjYW1lcmE9KClcIixcclxuICBcIlN0cmljdC1UcmFuc3BvcnQtU2VjdXJpdHlcIjogXCJtYXgtYWdlPTE1NTUyMDAwOyBpbmNsdWRlU3ViRG9tYWluc1wiLFxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCgpID0+ICh7XHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjo6XCIsXHJcbiAgICBwb3J0OiA4MDgwLFxyXG4gICAgaG1yOiB7XHJcbiAgICAgIG92ZXJsYXk6IGZhbHNlLFxyXG4gICAgfSxcclxuICAgIGhlYWRlcnM6IHNlY3VyaXR5SGVhZGVycyxcclxuICB9LFxyXG4gIHByZXZpZXc6IHtcclxuICAgIGhlYWRlcnM6IHNlY3VyaXR5SGVhZGVycyxcclxuICB9LFxyXG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBidWlsZDoge1xyXG4gICAgc291cmNlbWFwOiBmYWxzZSxcclxuICAgIG1pbmlmeTogXCJlc2J1aWxkXCIsXHJcbiAgfSxcclxufSkpO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW9ULFNBQVMsb0JBQW9CO0FBQ2pWLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFGakIsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTSxrQkFBMEM7QUFBQSxFQUM5QywyQkFBMkI7QUFBQSxJQUN6QjtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNGLEVBQUUsS0FBSyxJQUFJO0FBQUEsRUFDWCxtQkFBbUI7QUFBQSxFQUNuQiwwQkFBMEI7QUFBQSxFQUMxQixtQkFBbUI7QUFBQSxFQUNuQixzQkFBc0I7QUFBQSxFQUN0Qiw2QkFBNkI7QUFDL0I7QUFFQSxJQUFPLHNCQUFRLGFBQWEsT0FBTztBQUFBLEVBQ2pDLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLEtBQUs7QUFBQSxNQUNILFNBQVM7QUFBQSxJQUNYO0FBQUEsSUFDQSxTQUFTO0FBQUEsRUFDWDtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsU0FBUztBQUFBLEVBQ1g7QUFBQSxFQUNBLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxXQUFXO0FBQUEsSUFDWCxRQUFRO0FBQUEsRUFDVjtBQUNGLEVBQUU7IiwKICAibmFtZXMiOiBbXQp9Cg==
