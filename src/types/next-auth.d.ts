/** Extends Auth.js session with Beacon role. Values: src/lib/db-types.ts UserRole. */
import type { UserRole } from "@/lib/db-types";
import NextAuth from "next-auth";

declare module "next-auth" {
  interface User {
    role: UserRole;
    mustResetPassword?: boolean;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      mustResetPassword?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    mustResetPassword?: boolean;
  }
}

export type { NextAuth };
