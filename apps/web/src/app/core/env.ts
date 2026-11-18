/**
 * Build-time variables (SPEC §8.3), injected through the `define` option in project.json.
 * API_BASE_URL is empty locally: the dev server proxies /api to localhost:3000.
 */
declare const KS_API_BASE_URL: string;
declare const KS_PUBLIC_IMPORT_ENABLED: boolean;

export const ENV = {
  apiBaseUrl: typeof KS_API_BASE_URL === 'string' ? KS_API_BASE_URL : '',
  publicImportEnabled: typeof KS_PUBLIC_IMPORT_ENABLED === 'boolean' ? KS_PUBLIC_IMPORT_ENABLED : true,
} as const;
