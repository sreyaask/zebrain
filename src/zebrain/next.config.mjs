/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next", // lets a production build run beside the dev server
  // /api/runs reads the training job from disk; make sure deploys ship it.
  experimental: { outputFileTracingIncludes: { "/api/runs": ["./lib/zebrain_train.py"] } },
};
export default nextConfig;
