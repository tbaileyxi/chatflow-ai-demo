// Public FAQ.
//
// Replaces a stub whose own body read "Check out our comprehensive FAQ page for
// answers to common questions" — pointing at itself, answering nothing.
//
// Two answers here are load-bearing beyond marketing and should not be softened
// without a matching change elsewhere:
//   • Chips: described as free, virtual, no cash value and no cash out. The App
//     Store age rating is filed as Simulated Gambling = None, and this page is
//     public evidence of what the mechanic actually is.
//   • Contacts: describes hashing on-device. That has to keep matching what
//     `mobile/src/lib/contactMatch.ts` really does.

import React from 'react';
import { Link } from 'react-router-dom';
import { SitePage, SUPPORT_EMAIL } from '@/components/site/SiteChrome';

type QA = { q: string; a: React.ReactNode };

const SECTIONS: { heading: string; items: QA[] }[] = [
  {
    heading: 'The basics',
    items: [
      {
        q: 'What is Side Huddle?',
        a: 'A group chat built for watching sports with your friends. You make a room for your team, your people join it, and the game comes to the room — scores, news, big plays and clips — so the conversation keeps up without anyone having to go look things up.',
      },
      {
        q: 'Is it free?',
        a: 'Yes. Making rooms, inviting people, chatting, the Coach, and picks are all free. There is nothing to buy to use the app.',
      },
      {
        q: 'What does it cost to start a room?',
        a: 'Nothing. Name it, pick the team it follows, and send one link to your crew.',
      },
      {
        q: 'Which sports are covered?',
        a: 'NFL, college football, NBA, MLB and NHL today, with more added as we go. You can make a room for any team in those leagues.',
      },
    ],
  },
  {
    heading: 'Rooms and privacy',
    items: [
      {
        q: 'Who can see my room?',
        a: 'Rooms are not listed in a public directory. Search only shows rooms where somebody you know is already inside, plus team rooms. Someone with no connection to you and your friends will not stumble into your room.',
      },
      {
        q: 'Can I make a room approval-only?',
        a: 'Yes, and it is free. In room settings, turn on "Ask to join" — people then request access and you approve or deny each one. Room owners can also remove or ban members.',
      },
      {
        q: 'Can people read my messages before they join?',
        a: 'No. Someone who is not a member can see the room name, team and member count so they can recognise it and ask in. Not a single message is visible until they are a member.',
      },
    ],
  },
  {
    heading: 'Finding your people',
    items: [
      {
        q: 'How do I find friends who are already on Side Huddle?',
        a: 'Profile → "People you know" checks which of your contacts already have an account. You can also invite anyone with a link, which works whether or not they have the app.',
      },
      {
        q: 'What do you do with my contacts?',
        a: 'Your address book never leaves your phone. Names, numbers and emails are scrambled into one-way codes on your device, and only those codes are sent to check for matches. We do not store your contacts, and we never message anyone in them.',
      },
      {
        q: 'Why do you ask for my phone number?',
        a: 'Only so people who already have your number can find you. We never text you — there is no outbound SMS in the app at all. It is optional, and you can skip it.',
      },
      {
        q: 'Do you post anything or message my friends for me?',
        a: 'Never. Nothing is sent to anyone unless you send it.',
      },
    ],
  },
  {
    heading: 'The Coach and notifications',
    items: [
      {
        q: 'What is the Coach?',
        a: 'The AI that lives in your room. It brings in scores, news, roster moves and clips as they happen, and you can ask it things directly by typing @coach — the score, the record, what you missed, who somebody is.',
      },
      {
        q: 'What is "Rally the huddle"?',
        a: 'One tap that pings everyone in the room that a game is starting, and then offers to pull in the people you know who are not in the room yet. Capped at once per game so it cannot be used to spam.',
      },
      {
        q: 'Can I turn notifications off?',
        a: (
          <>
            Yes, individually. Profile → Notifications has separate switches for
            friends watching, someone you know joining, game-day pings and room
            invites. Banners, sounds and badges are controlled by iOS in
            Settings → Notifications → Side Huddle.
          </>
        ),
      },
    ],
  },
  {
    heading: 'Picks and Chips',
    items: [
      {
        q: 'Is this gambling?',
        a: 'No. Chips are a free, virtual score for bragging rights. They cannot be bought, sold, cashed out, or exchanged for anything of value, and there is no real money anywhere in the app. Everyone starts with chips and they exist purely to settle arguments between friends.',
      },
      {
        q: 'How do picks work?',
        a: 'A pick is a call on something in the game, written in plain English. You take a side, a friend can take the other, and it settles when the game does. Winning moves chips between you. That is the whole mechanic.',
      },
    ],
  },
  {
    heading: 'Account',
    items: [
      {
        q: 'How do I sign in?',
        a: 'With your email. We send a one-time code — there is no password to remember.',
      },
      {
        q: 'How do I change my name or photo?',
        a: 'Profile → edit your display name, username and avatar. Your display name is what people see in rooms.',
      },
      {
        q: 'How do I delete my account?',
        a: (
          <>
            Profile → Account → Delete Account removes your account and your
            data. If you get stuck, email us at{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-[#FFD700] hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>{' '}
            and we will take care of it.
          </>
        ),
      },
    ],
  },
];

export default function FAQ() {
  return (
    <SitePage
      title="Frequently asked questions"
      subtitle="How Side Huddle works, what we do with your data, and what Chips actually are."
    >
      <div className="flex flex-col gap-12">
        {SECTIONS.map(({ heading, items }) => (
          <section key={heading}>
            <h2 className="font-orbitron text-sm font-bold text-[#FFD700] uppercase tracking-widest mb-6">
              {heading}
            </h2>
            <div className="flex flex-col gap-7">
              {items.map(({ q, a }) => (
                <div key={q}>
                  <h3 className="text-white font-semibold text-base mb-1.5">
                    {q}
                  </h3>
                  <p className="text-white/55 text-sm leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="border-t border-white/5 pt-8">
          <h3 className="text-white font-semibold text-base mb-1.5">
            Still stuck?
          </h3>
          <p className="text-white/55 text-sm leading-relaxed">
            <Link to="/contact" className="text-[#FFD700] hover:underline">
              Get in touch
            </Link>{' '}
            — a real person reads it.
          </p>
        </section>
      </div>
    </SitePage>
  );
}
