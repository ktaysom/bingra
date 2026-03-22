import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service – Bingra",
  robots: {
    index: true,
  },
};

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <article className="rounded-2xl bg-white/90 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Bingra</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Terms of Service for Bingra</h1>
        <p className="mt-3 text-sm text-slate-600">Last updated: March 22, 2026</p>

        <section className="mt-8 space-y-2">
          <p className="text-sm leading-6 text-slate-700">
            Welcome to Bingra. By accessing or using our platform, you agree to be bound by these Terms of Service.
            If you do not agree to these Terms, do not use the service.
          </p>
        </section>

        <section className="mt-8 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">1. Use of the Service</h2>
          <p className="text-sm leading-6 text-slate-700">
            Bingra provides an interactive game experience where users can join games, build cards, and participate
            in live events.
          </p>
          <p className="text-sm leading-6 text-slate-700">You agree to:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            <li>Use the service only for lawful purposes</li>
            <li>Provide accurate information when creating or joining games</li>
            <li>Not interfere with or disrupt the platform or its services</li>
          </ul>
        </section>

        <section className="mt-8 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">2. Accounts and Authentication</h2>
          <p className="text-sm leading-6 text-slate-700">To access certain features, you may be required to sign in.</p>
          <p className="text-sm leading-6 text-slate-700">You are responsible for:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            <li>Maintaining the confidentiality of your login credentials</li>
            <li>All activity that occurs under your account</li>
          </ul>
          <p className="text-sm leading-6 text-slate-700">
            Bingra is not liable for unauthorized access resulting from your failure to safeguard your credentials.
          </p>
        </section>

        <section className="mt-8 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">3. SMS Authentication (One-Time Passcodes)</h2>
          <p className="text-sm leading-6 text-slate-700">
            Bingra may send a one-time SMS message to verify your identity during login.
          </p>
          <p className="text-sm leading-6 text-slate-700">By providing your phone number, you agree to receive:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            <li>A single-use authentication code via SMS</li>
          </ul>
          <p className="text-sm leading-6 text-slate-700">Additional details:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            <li>Message frequency: one message per login attempt</li>
            <li>Message &amp; data rates may apply</li>
            <li>Bingra does not send marketing or promotional SMS messages</li>
          </ul>
          <p className="text-sm leading-6 text-slate-700">
            You can choose not to use phone-based login if you do not wish to receive SMS messages.
          </p>
        </section>

        <section className="mt-8 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">4. User Conduct</h2>
          <p className="text-sm leading-6 text-slate-700">You agree not to:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            <li>Abuse, harass, or harm other users</li>
            <li>Attempt to manipulate game outcomes unfairly</li>
            <li>Use bots, scripts, or automated methods to gain an advantage</li>
          </ul>
          <p className="text-sm leading-6 text-slate-700">
            Bingra reserves the right to suspend or terminate accounts that violate these rules.
          </p>
        </section>

        <section className="mt-8 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">5. Game Results and Scoring</h2>
          <p className="text-sm leading-6 text-slate-700">
            Bingra provides scoring and game outcomes based on recorded events.
          </p>
          <p className="text-sm leading-6 text-slate-700">We do not guarantee:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            <li>Accuracy of all recorded events</li>
            <li>Availability or uninterrupted access to the platform</li>
          </ul>
          <p className="text-sm leading-6 text-slate-700">All results are final as displayed within the application.</p>
        </section>

        <section className="mt-8 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">6. Intellectual Property</h2>
          <p className="text-sm leading-6 text-slate-700">
            All content, branding, and functionality of Bingra are the property of Bingra and may not be copied,
            reproduced, or distributed without permission.
          </p>
        </section>

        <section className="mt-8 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">7. Limitation of Liability</h2>
          <p className="text-sm leading-6 text-slate-700">Bingra is provided “as is” without warranties of any kind.</p>
          <p className="text-sm leading-6 text-slate-700">To the fullest extent permitted by law, Bingra is not liable for:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            <li>Loss of data</li>
            <li>Service interruptions</li>
            <li>Any indirect, incidental, or consequential damages arising from use of the platform</li>
          </ul>
        </section>

        <section className="mt-8 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">8. Changes to These Terms</h2>
          <p className="text-sm leading-6 text-slate-700">
            We may update these Terms from time to time. Continued use of the service after changes are posted
            constitutes your acceptance of the updated Terms.
          </p>
        </section>

        <section className="mt-8 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">9. Contact</h2>
          <p className="text-sm leading-6 text-slate-700">If you have questions about these Terms, please contact us at:</p>
          <p className="text-sm leading-6 text-slate-700">support@bingra.com</p>
        </section>
      </article>
    </main>
  );
}
