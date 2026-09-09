import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los perfiles y los prompts se leen por ruta en tiempo de ejecución, así que
  // el rastreo estático no los ve. Sin esto el despliegue arranca sin ellos.
  outputFileTracingIncludes: {
    "/api/**": ["./perfiles/**", "./prompts/**"],
  },
};

export default nextConfig;
