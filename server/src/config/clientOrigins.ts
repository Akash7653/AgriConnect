const productionClientOrigin = 'https://agri-connect-seven-snowy.vercel.app';

export function getAllowedClientOrigins(): string[] {
  const configuredOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...configuredOrigins, productionClientOrigin])];
}
