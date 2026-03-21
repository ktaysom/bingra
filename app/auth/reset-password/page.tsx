import Link from "next/link";
import { AuthDialog } from "../../../components/auth/AuthDialog";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col justify-center px-4 py-12 sm:px-6">
      <section className="rounded-2xl bg-white/90 p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Continue with email</h1>
        <p className="mt-2 text-sm text-slate-600">
          Password reset is temporarily unavailable. Enter your email and we&apos;ll send you a secure login link.
        </p>

        <div className="mt-5">
          <AuthDialog label="Continue with email" nextPath="/me" emphasis="prominent" />
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Back to <Link href="/" className="underline">home</Link>
        </p>
      </section>
    </main>
  );
}
