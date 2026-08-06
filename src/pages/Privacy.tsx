import React from "react";

const UPDATED = "June 29, 2026";
const CONTACT = "support@sidehuddlesports.com";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {UPDATED}</p>

        <div className="mt-8 space-y-6 text-foreground/90 leading-relaxed">
          <p>
            This Privacy Policy explains how Side Huddle Sports (“Side Huddle,”
            “we,” “us”) collects, uses, and shares information when you use the
            Side Huddle Sports mobile app and website (the “Service”). By using
            the Service, you agree to this Policy.
          </p>

          <Section title="Information We Collect">
            <ul className="list-disc space-y-1 pl-5">
              <li><b>Account information:</b> your email address, and an optional phone number, used to sign in and secure your account.</li>
              <li><b>Profile information:</b> your display name, username, and an optional profile photo.</li>
              <li><b>Content you create:</b> messages you post in huddles (group chats) and the predictions/picks you make.</li>
              <li><b>Game activity:</b> your in-app virtual “chips” balance and prediction history. Chips are a free, virtual currency with no real-world or monetary value.</li>
              <li><b>Device &amp; notification data:</b> a push-notification token so we can send you alerts, and basic device/usage information to operate and improve the Service.</li>
              <li><b>Purchases:</b> if you buy an optional premium subscription, payment is processed by our payment providers (Apple and/or Stripe). We do not store your full payment card details.</li>
            </ul>
          </Section>

          <Section title="How We Use Information">
            <ul className="list-disc space-y-1 pl-5">
              <li>To create and operate your account and the Service.</li>
              <li>To deliver huddle chats, predictions, scores, and notifications.</li>
              <li>To process optional premium subscriptions.</li>
              <li>To maintain security, prevent abuse, and comply with law.</li>
              <li>To improve and develop features.</li>
            </ul>
          </Section>

          <Section title="How We Share Information">
            <p>We do not sell your personal information. We share information only with service providers who help us run the Service, including:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><b>Supabase</b> — hosting, database, and authentication.</li>
              <li><b>Apple Push Notification service</b> — to deliver notifications.</li>
              <li><b>Apple and Stripe</b> — to process optional subscription payments.</li>
              <li><b>SportsGameOdds</b> — sports and odds data (no personal data is shared with them).</li>
            </ul>
            <p className="mt-2">We may also disclose information if required by law or to protect the rights and safety of our users.</p>
          </Section>

          <Section title="Data Retention &amp; Account Deletion">
            <p>
              We keep your information for as long as your account is active. You
              can permanently delete your account at any time from the app:
              go to <b>Profile → Account → Delete Account</b>. This removes your
              account, profile, picks, chips, huddle memberships, and the
              messages associated with your account. Deletion is permanent and
              cannot be undone.
            </p>
          </Section>

          <Section title="Security">
            <p>We use industry-standard safeguards to protect your information. No method of transmission or storage is 100% secure, but we work to protect your data and limit access to it.</p>
          </Section>

          <Section title="Children">
            <p>The Service is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided us information, contact us and we will delete it.</p>
          </Section>

          <Section title="Your Choices">
            <p>You can edit your profile, control notification permissions in your device settings, and delete your account in the app. To request access to or deletion of your data, contact us at the email below.</p>
          </Section>

          <Section title="Changes to This Policy">
            <p>We may update this Policy from time to time. We will update the “Last updated” date above and, where appropriate, notify you in the app.</p>
          </Section>

          <Section title="Contact Us">
            <p>
              Questions about this Policy or your data? Email us at{" "}
              <a className="text-primary underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xl font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default Privacy;
