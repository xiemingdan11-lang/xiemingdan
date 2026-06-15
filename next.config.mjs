/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/shots/:path*",
        destination: "http://124.222.223.153/shots/:path*",
      },
    ];
  },
};

export default nextConfig;
