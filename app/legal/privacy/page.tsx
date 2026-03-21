export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <article className="rounded-2xl bg-white/90 p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-600">Last updated: March 21, 2026</p>

        <section className="mt-6 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">Information we collect</h2>
          <p className="text-sm leading-6 text-slate-700">
            We collect information you provide directly, such as display names, account identifiers,
            and gameplay activity needed to operate Bingra.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            <li>Account data (email and/or phone when enabled)</li>
            <li>Gameplay records and score history</li>
            <li>Operational logs for reliability and security</li>
          </ul>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">How we use information</h2>
          <p className="text-sm leading-6 text-slate-700">
            We use data to run the service, attach gameplay to your account, improve product quality,
            and protect against abuse.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">SMS verification</h2>
          <p className="text-sm leading-6 text-slate-700">
            If phone verification is enabled, your phone number is used to deliver one-time security
            codes. Message frequency varies. Message and data rates may apply.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
          <p className="text-sm leading-6 text-slate-700">
            Questions about privacy can be directed to the Bingra team through your normal project
            support channels.
          </p>
        </section>
      </article>
    </main>
  );
}
