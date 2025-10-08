import React from 'react';
import { GlassHeader } from '@/components/mobile/GlassHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

const FAQ = () => {
  return (
    <div className="min-h-screen bg-background">
      <GlassHeader 
        title="Frequently Asked Questions"
        subtitle="Get answers to common questions"
      />
      
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card>
          <CardContent className="pt-6 text-center space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Need Help?</h2>
              <p className="text-muted-foreground mb-6">
                Check out our comprehensive FAQ page for answers to common questions.
              </p>
              <Button 
                size="lg"
                onClick={() => window.open('https://sidehuddlefounders.carrd.co/#faqs', '_blank')}
                className="gap-2"
              >
                View FAQs
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Still have questions?</h3>
              <p className="text-muted-foreground mb-4">
                Can't find what you're looking for? We're here to help!
              </p>
              <Button
                variant="outline"
                onClick={() => window.open('https://sidehuddlefounders.carrd.co/#contactus', '_blank')}
                className="gap-2"
              >
                Contact Support
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FAQ;