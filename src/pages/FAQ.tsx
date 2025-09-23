import React from 'react';
import { GlassHeader } from '@/components/mobile/GlassHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const FAQ = () => {
  const faqs = [
    {
      question: "What is Side Huddle?",
      answer: "Side Huddle is your private, AI-powered sports chat platform where you can create invite-only huddles with your crew to discuss games, get live scores, polls, and curated sports content."
    },
    {
      question: "How do I create a huddle?",
      answer: "Simply click the '+' button to create a new huddle, select your team, and invite your friends using the invite link."
    },
    {
      question: "Are huddles free?",
      answer: "Yes! Creating and joining huddles is completely free. Some premium features may require a subscription."
    },
    {
      question: "How do I get live game updates?",
      answer: "Our Game Bot automatically posts live scores, updates, and final results to your team's huddles during games."
    },
    {
      question: "Can I share content from my huddle?",
      answer: "Yes! You can make messages public by using the megaphone button to share epic moments with the world on our Spotlight feed."
    },
    {
      question: "How do Pick 'Em games work?",
      answer: "Huddle owners can create Pick 'Em contests where members predict game winners for their favorite teams. Points are awarded for correct picks."
    },
    {
      question: "What teams are supported?",
      answer: "We support NFL, NCAA football, and more sports leagues. New teams and leagues are added regularly."
    },
    {
      question: "How do I report inappropriate content?",
      answer: "Use the report button on any post or message to flag inappropriate content. Our moderation team reviews all reports."
    },
    {
      question: "Can I customize my huddle?",
      answer: "Yes! Huddle owners can customize settings, enable Pick 'Em games, set pricing for exclusive huddles, and manage member permissions."
    },
    {
      question: "How do I leave a huddle?",
      answer: "You can leave any huddle from the huddle settings menu. Note that you cannot leave huddles you own - you must transfer ownership first."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <GlassHeader 
        title="Frequently Asked Questions"
        subtitle="Get answers to common questions"
      />
      
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              How can we help you?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent>
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
        
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Still have questions?</h3>
              <p className="text-muted-foreground mb-4">
                Can't find what you're looking for? We're here to help!
              </p>
              <a 
                href="mailto:support@sidehuddle.app" 
                className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Contact Support
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FAQ;