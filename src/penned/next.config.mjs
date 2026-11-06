/**
 * Static export so the site can be hosted on GitHub Pages.
 * PAGES_BASE_PATH is set when building for a project site (e.g. "/zebrain").
 */
const basePath = process.env.PAGES_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};
export default nextConfig;
