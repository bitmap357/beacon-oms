/** POST sign-out. Calls logoutAction in src/app/(auth)/actions.ts. */
import { logoutAction } from "@/app/(auth)/actions";

export async function POST() {
  await logoutAction();
}
