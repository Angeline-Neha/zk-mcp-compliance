/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ISSUER_URL?: string;
  readonly VITE_GATEWAY_URL?: string;
  readonly VITE_FINANCE_URL?: string;
  readonly VITE_PROVING_URL?: string;
  readonly VITE_ADMIN_URL?: string;
  readonly VITE_SUPPORT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}