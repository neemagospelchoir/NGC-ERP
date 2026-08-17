/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // packages/ui ships TypeScript source directly (no separate build step at
  // this phase) — transpilePackages tells Next.js to compile it as part of
  // the app build rather than expecting a pre-built dist/.
  transpilePackages: ["@ngc/ui"],
};

module.exports = nextConfig;
