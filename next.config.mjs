/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Disable caching to avoid ENOSPC errors
    config.cache = false
    return config
  },
  experimental: {
    // Reduce build output size
    outputFileTracingIncludes: {
      '/': ['./public/**/*'],
    },
  },
}

export default nextConfig
