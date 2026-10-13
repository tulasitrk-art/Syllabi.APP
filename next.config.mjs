/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Required for pdfjs-dist / canvas loading in client components
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
