import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with only the files the server needs, so the image
  // doesn't have to carry node_modules.
  output: "standalone",
  // Caddy terminates compression via `encode`. Next's default gzip would get
  // there first, and Caddy passes through responses that already carry a
  // Content-Encoding, which pins every client to gzip and burns CPU here.
  compress: false,
  // Tracing defaults to this app's directory, which would miss the workspace
  // packages hoisted to the repo root.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
