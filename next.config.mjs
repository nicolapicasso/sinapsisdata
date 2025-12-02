/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone para Docker
  output: 'standalone',

  // Dominios permitidos para imágenes externas
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
