export const DEPLOYED_API_BASE_URL = 'https://agriconnect-api-ajoq.onrender.com';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${DEPLOYED_API_BASE_URL}/api`;

export const AppConfig = {
  name: 'AgriConnect',
  tagline: 'From Farm to Every Table.',
  email: 'hello@agriconnect.example',
  // Use env if set, otherwise fallback to deployed URL
  isBackendConfigured: Boolean(API_BASE_URL),
} as const;

export const BRAND_COLORS = {
  forest: '#163D2B',
  agriGreen: '#246B45',
  emerald: '#38A169',
  ivory: '#F7F5ED',
  soil: '#75533A',
  charcoal: '#18231C',
} as const;
