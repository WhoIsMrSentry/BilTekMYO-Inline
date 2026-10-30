import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  transpilePackages: ['@biltekmyo/shared-types'],
};

export default nextConfig;

