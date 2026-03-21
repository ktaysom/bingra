import { PhoneAuthForm } from "../../../components/auth/PhoneAuthForm";

export default function PhoneAuthPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center px-4 py-12 sm:px-6">
      <section className="rounded-2xl bg-white/90 p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sign in with your phone</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your phone number to receive a one-time verification code.
        </p>

        <PhoneAuthForm />
      </section>
    </main>
  );
}
