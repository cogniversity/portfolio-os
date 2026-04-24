import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { Rocket } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
    reason?: string;
  }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const { callbackUrl, error, reason } = await searchParams;
  const sessionMessage =
    reason === "session_expired"
      ? "Your session has expired or is no longer valid. Please sign in again."
      : undefined;
  const googleEnabled = !!(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Rocket className="h-5 w-5" />
          </div>
          <div className="text-lg font-semibold tracking-tight">Portfolio OS</div>
        </div>
        <LoginForm
          callbackUrl={callbackUrl ?? "/dashboard"}
          googleEnabled={googleEnabled}
          initialError={error ?? sessionMessage}
        />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
