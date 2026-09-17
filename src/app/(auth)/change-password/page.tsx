/** Change password when mustResetPassword is set (or voluntary). */
import { requireUser } from "@/lib/session";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function ChangePasswordPage() {
  await requireUser({ allowPasswordReset: true });
  return <ChangePasswordForm />;
}
