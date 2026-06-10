import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript (main: ./src/index.ts) with
  // NodeNext-style `.js` import specifiers. transpilePackages makes Next
  // compile them in-place and resolve those specifiers back to .ts source.
  transpilePackages: [
    "@relai/db",
    "@relai/pii",
    "@relai/embedding",
    "@relai/ontology",
    "@relai/inference",
    "@relai/intent",
    "@relai/rerank",
    "@relai/packet",
    "@relai/mls-adapter",
  ],
};

export default nextConfig;
