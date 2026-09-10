import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Se resuelve en cada petición y no al importar: si se armara aquí arriba,
// compilar exigiría DATABASE_URL.
export function GET(request: Request) {
  return toNextJsHandler(auth()).GET(request);
}

export function POST(request: Request) {
  return toNextJsHandler(auth()).POST(request);
}
