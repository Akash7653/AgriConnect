// vite-env.d.ts – TypeScript typings for Vite import.meta.env
/// <reference types="vite/client" />

interface ImportMetaEnv {
  // VITE_API_URL is injected via Vite's define config
  readonly VITE_API_URL: string;
  // You can add other env variables here as needed
  readonly NODE_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
