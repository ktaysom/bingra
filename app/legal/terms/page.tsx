export default function TermsOfServicePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <article className="rounded-2xl bg-white/90 p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Terms of Service</h1>
        <p className="mt-3 text-sm text-slate-600">Last updated: March 21, 2026</p>

        <section className="mt-6 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">Use of Bingra</h2>
          <p className="text-sm leading-6 text-slate-700">
            Bingra is a social game experience provided for personal, non-commercial use unless we
            explicitly agree otherwise. You are responsible for your activity while using the product.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">Accounts and access</h2>
          <p className="text-sm leading-6 text-slate-700">
            You may play as a guest, or sign in to attach gameplay and stats to your account. Keep
            your account credentials secure and notify us if you suspect unauthorized use.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            <li>Do not impersonate others or provide misleading identity information.</li>
            <li>Do not abuse, disrupt, or attempt to compromise the service.</li>
            <li>We may suspend access for violations of these terms.</li>
          </ul>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">SMS verification notices</h2>
          <p className="text-sm leading-6 text-slate-700">
            If phone verification is enabled, one-time SMS verification messages may be sent to the
            phone number you provide. Message frequency varies. Message and data rates may apply.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">Disclaimers</h2>
          <p className="text-sm leading-6 text-slate-700">
            The service is provided "as is" without warranties of any kind. To the extent permitted by
            law, Bingra is not liable for indirect or consequential damages arising from your use.
          </p>
        </section>
      </article>
    </main>
  );
}
