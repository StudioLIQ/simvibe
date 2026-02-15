import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'simvi.be',
    short_name: 'simvi.be',
    description: 'Predict nad.fun launch reaction before you go live.',
    start_url: '/',
    display: 'standalone',
    background_color: '#081226',
    theme_color: '#111B33',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/favicon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
