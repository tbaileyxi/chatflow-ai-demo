import React from "react";

const UPDATED = "September 10, 2026";
const CONTACT = "support@sidehuddlesports.com";

/**
 * Terms of Service.
 *
 * The "Objectionable content" section is not boilerplate — App Store guideline
 * 1.2 requires a published zero-tolerance policy for any app carrying
 * user-generated content, and reviewers open this page and read that section.
 * It is first, and it is specific about what we do and how fast, because a
 * vague promise reads as no policy at all.
 *
 * The 24-hour window is a commitment. If reports stop being answered inside a
 * day, change the number here rather than let the page lie.
 */
const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {UPDATED}</p>

        <div className="mt-8 space-y-6 text-foreground/90 leading-relaxed">
          <p>
            These Terms govern your use of the Side Huddle Sports mobile app and
            website (the “Service”), operated by Side Huddle Sports (“Side
            Huddle,” “we,” “us”). By creating an account or posting to the
            Service, you agree to these Terms.
          </p>

          <Section title="Objectionable Content and Abusive Behavior">
            <p className="font-semibold text-foreground">
              Side Huddle has zero tolerance for objectionable content or abusive
              users.
            </p>
            <p className="mt-2">
              You may not post content that is unlawful, hateful, harassing,
              threatening, sexually explicit, or that depicts violence or the
              exploitation of any person. You may not impersonate anyone, post
              another person’s private information, or use the Service to
              organize harassment of anyone on or off the Service.
            </p>
            <p className="mt-2">
              <b>Reporting.</b> Anyone can report a message from inside the app by
              pressing and holding it and choosing <b>Report</b>.{" "}
              <b>We review every report within 24 hours</b> and remove content
              and terminate accounts that violate these Terms.
            </p>
            <p className="mt-2">
              <b>Blocking.</b> You can block any other person at any time, from
              the same menu. A blocked person’s messages become invisible to you
              everywhere in Side Huddle, and they are not told that you blocked
              them.
            </p>
            <p className="mt-2">
              <b>Removal.</b> You can delete anything you post. The owner and
              admins of a huddle can remove any message in that huddle, and can
              remove and ban a member from it.
            </p>
            <p className="mt-2">
              We may remove content and suspend or terminate accounts at our
              discretion, without notice, for violating this section.
            </p>
          </Section>

          <Section title="Who Can Use Side Huddle">
            <p>
              You must be at least 13 years old to use the Service. If you are
              under the age of majority where you live, you may use the Service
              only with the involvement of a parent or guardian. You are
              responsible for everything that happens under your account, and for
              keeping access to your phone number and email secure.
            </p>
          </Section>

          <Section title="Your Content">
            <p>
              You keep ownership of what you post. By posting to the Service you
              grant us a non-exclusive, worldwide, royalty-free license to store,
              display, and transmit that content for the purpose of operating the
              Service — showing your message to the other people in your huddle,
              and nothing beyond that.
            </p>
            <p className="mt-2">
              What you post stays in the huddle until you delete it. Nothing
              expires on its own. You can remove any message you posted by
              pressing and holding it; the owner and admins of a huddle can
              remove anything in that huddle; and deleting your account removes
              your messages with it.
            </p>
          </Section>

          <Section title="Huddles">
            <p>
              A huddle is a group chat. Private huddles are visible only to their
              members; public huddles can be read by anyone with the link, which
              is how people find and join them. The person who creates a huddle
              owns it and can set it private, approve or deny requests to join,
              remove members, and delete the huddle.
            </p>
            <p className="mt-2">
              Automated messages from our sports agent (“Coach”) are labeled in
              the thread. They are generated from third-party sports data and may
              be delayed or wrong; nothing the agent posts is advice of any kind.
            </p>
          </Section>

          <Section title="Chips, Picks, and Predictions">
            <p>
              Chips are a free virtual currency with no real-world or monetary
              value. They cannot be purchased, cashed out, transferred, or
              redeemed for anything of value. Picks and predictions are for
              entertainment between friends. <b>Side Huddle is not a gambling
              service</b>, does not accept wagers, and does not pay out winnings.
            </p>
          </Section>

          <Section title="Acceptable Use">
            <ul className="list-disc space-y-1 pl-5">
              <li>Don’t break the law or use the Service to help anyone else do so.</li>
              <li>Don’t send spam, scams, or unsolicited promotions.</li>
              <li>Don’t scrape, reverse-engineer, or attack the Service or the people on it.</li>
              <li>Don’t post content you don’t have the right to post.</li>
              <li>Don’t evade a block, a removal, or an account termination.</li>
            </ul>
          </Section>

          <Section title="Optional Purchases">
            <p>
              Some features may be offered as paid subscriptions or one-time
              purchases, processed by Apple or by our payment providers. Their
              terms govern the transaction, and refunds are handled by them.
              Subscriptions renew until cancelled in your Apple account settings.
            </p>
          </Section>

          <Section title="Ending Your Account">
            <p>
              You can delete your account at any time from{" "}
              <b>Profile → Account → Delete Account</b>. Deletion is permanent.
              We may suspend or terminate an account that violates these Terms,
              and we will do so without notice where the violation is serious.
            </p>
          </Section>

          <Section title="Disclaimers and Liability">
            <p>
              The Service is provided “as is,” without warranties of any kind.
              Scores, odds, and sports data come from third parties and may be
              inaccurate or delayed. To the fullest extent permitted by law,
              Side Huddle is not liable for indirect, incidental, or
              consequential damages, and our total liability to you is limited to
              the greater of the amount you paid us in the past twelve months or
              one hundred U.S. dollars.
            </p>
          </Section>

          <Section title="Changes to These Terms">
            <p>
              We may update these Terms. We will change the “Last updated” date
              above and, where the change is material, notify you in the app.
              Continuing to use the Service after a change means you accept it.
            </p>
          </Section>

          <Section title="Contact Us">
            <p>
              Questions about these Terms, or a report you want to escalate?
              Email us at{" "}
              <a className="text-primary underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </p>
            <p className="mt-2">
              See also our{" "}
              <a className="text-primary underline" href="/privacy">Privacy Policy</a>.
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

export default Terms;
