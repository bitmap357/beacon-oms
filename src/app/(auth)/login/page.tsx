/** Login route. UI lives in src/components/login-form.tsx */
import { Suspense } from "react";
import { LoginPanel } from "@/components/login-form";
import { PageLoader } from "@/components/page-loader";

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading sign in" />}>
      <LoginPanel />
    </Suspense>
  );
}
