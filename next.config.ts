import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    // Prevent OpenTelemetry SDK from trying to load optional exporters
    OTEL_TRACES_EXPORTER: 'none',
  },
  webpack: (config) => {
    // Silence optional OpenTelemetry exporter resolution warnings
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@opentelemetry/exporter-jaeger': false as any,
    } as any;

    // Ignore noisy warnings from handlebars about require.extensions
    // These are harmless in our usage and safe to ignore.
    (config.ignoreWarnings ||= []).push({
      message: /require\.extensions is not supported by webpack/,
    } as any);

    return config;
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
      {
        source: '/transfers-report',
        destination: '/transactions-log',
        permanent: true,
      },
      {
        source: '/transfers-report/:path*',
        destination: '/transactions-log',
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
