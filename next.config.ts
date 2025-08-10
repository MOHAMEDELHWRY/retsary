import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: '/customer-cycle',
        destination: '/customers-log',
        permanent: true,
      },
      {
        source: '/customer-sales',
        destination: '/customers-log',
        permanent: true,
      },
      {
        source: '/customer-sales-report',
        destination: '/customers-log',
        permanent: true,
      },
      {
        source: '/customer-sales-report/:path*',
        destination: '/customers-log',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
