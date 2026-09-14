/** Login route. UI lives in src/components/login-form.tsx */
import { Suspense } from "react";
import { LoginPanel } from "@/components/login-form";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPanel />
    </Suspense>
  );
}
