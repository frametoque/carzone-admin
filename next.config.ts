/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Enable React Strict Mode for better debugging and lifecycle checks
  reactStrictMode: true,
  compress: true,

  // 2. Configure external image domains safely & formats
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // 3. Optimize imports for fast client-side navigation
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion'],
  },

  // 4. Clean up URLs by removing trailing slashes
  trailingSlash: false,

  // 4. Custom redirects (optional)
  async redirects() {
    return [];
  },

  // 5. Custom rewrites to support /admin/... and /admin/invoice_id/... URL formats
  async rewrites() {
    return [
      {
        source: '/admin/invoice_id/:id',
        destination: '/invoice/:id',
      },
      {
        source: '/admin/:path*',
        destination: '/:path*',
      },
    ];
  },

  // 5. Environment variables accessible on the client side (optional)
  env: {
    // CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

export default nextConfig;