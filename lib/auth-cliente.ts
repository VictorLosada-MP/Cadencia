"use client";

import { createAuthClient } from "better-auth/react";

export const cuentas = createAuthClient();
export const { signIn, signUp, signOut, useSession } = cuentas;
