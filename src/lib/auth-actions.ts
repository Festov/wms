"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

function isNextRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function loginAction(formData: FormData) {
  const login = String(formData.get("login") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/");

  try {
    await signIn("credentials", {
      login,
      password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    // Successful sign-in throws a Next.js redirect — must not treat as failure.
    if (isNextRedirect(error)) throw error;

    if (error instanceof AuthError) {
      redirect(
        `/login?error=credentials&callbackUrl=${encodeURIComponent(callbackUrl)}`,
      );
    }

    // Some bundling cases break instanceof AuthError for CredentialsSignin
    const type =
      typeof error === "object" && error && "type" in error
        ? String((error as { type: unknown }).type)
        : "";
    if (type === "CredentialsSignin" || type === "CallbackRouteError") {
      redirect(
        `/login?error=credentials&callbackUrl=${encodeURIComponent(callbackUrl)}`,
      );
    }

    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
