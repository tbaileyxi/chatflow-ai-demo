import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, CheckCircle, Clock, Users, MessageSquare, Award, ChevronDown, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';

interface Team {
  id: string;
  name: string;
  city: string;
  logo_url?: string;
  league?: string;
  is_reserved: boolean;
}

interface WaitlistFormData {
  name: string;
  email: string;
  company: string;
}

export default function Sponsor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [teams, setTeams] = useState<Team[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [reservedTeamName, setReservedTeamName] = useState('');
  const [waitlistForm, setWaitlistForm] = useState<WaitlistFormData>({ name: '', email: '', company: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check for success/cancelled params
    const success = searchParams.get('success');
    const teamName = searchParams.get('team');
    const cancelled = searchParams.get('cancelled');

    if (success === 'true' && teamName) {
      setReservedTeamName(decodeURIComponent(teamName));
      setShowSuccessModal(true);
      // Clear URL params
      setSearchParams({});
    } else if (cancelled === 'true') {
      toast.info('Reservation cancelled');
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      // Fetch all active teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, city, logo_url, league')
        .eq('status', 'active')
        .order('league', { ascending: true })
        .order('city', { ascending: true });

      if (teamsError) throw teamsError;

      // Fetch reservations to check status
      const { data: reservations } = await supabase
        .from('sponsor_reservations')
        .select('team_id')
        .eq('status', 'reserved');

      const reservedTeamIds = new Set(reservations?.map(r => r.team_id) || []);

      const formatted = teamsData?.map(team => ({
        ...team,
        is_reserved: reservedTeamIds.has(team.id)
      })) || [];

      setTeams(formatted);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const filterTeams = (league: string | null) => {
    let filtered = teams;

    if (searchQuery.trim()) {
      filtered = filtered.filter(team =>
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.city.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (league) {
      filtered = filtered.filter(team => team.league === league);
    }

    return filtered;
  };

  const handleReserveTeam = async (team: Team) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-sponsor-checkout', {
        body: { teamId: team.id, teamName: `${team.city} ${team.name}` }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast.error(error.message || 'Failed to create checkout session');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!selectedTeam || !waitlistForm.name || !waitlistForm.email || !waitlistForm.company) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('sponsor_waitlist')
        .insert({
          team_id: selectedTeam.id,
          name: waitlistForm.name,
          email: waitlistForm.email,
          company: waitlistForm.company
        });

      if (error) throw error;

      toast.success('You\'ve been added to the waitlist!');
      setShowWaitlistModal(false);
      setWaitlistForm({ name: '', email: '', company: '' });
      setSelectedTeam(null);
    } catch (error: any) {
      console.error('Error joining waitlist:', error);
      toast.error(error.message || 'Failed to join waitlist');
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToTeams = () => {
    document.getElementById('team-directory')?.scrollIntoView({ behavior: 'smooth' });
  };

  const getEstimatedPricing = (league?: string) => {
    if (league === 'NCAA') {
      return '$599–$899 / month (year-round)';
    }
    return '$499–$699 / month (in-season)';
  };

  const TeamCard = ({ team }: { team: Team }) => (
    <Card className="bg-card/50 border-border hover:border-primary/30 transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          {team.logo_url ? (
            <img src={team.logo_url} alt={team.name} className="w-12 h-12 object-contain" />
          ) : (
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
              <span className="text-lg font-bold text-muted-foreground">
                {team.city[0]}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{team.city} {team.name}</h3>
            <p className="text-sm text-muted-foreground">{team.league}</p>
          </div>
        </div>

        <div className="mb-3">
          {team.is_reserved ? (
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              <Clock className="w-3 h-3 mr-1" /> Reserved
            </Badge>
          ) : (
            <Badge className="bg-primary/20 text-primary border-primary/30">
              <CheckCircle className="w-3 h-3 mr-1" /> Available
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Estimated launch pricing: {getEstimatedPricing(team.league)}
        </p>

        {team.is_reserved ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setSelectedTeam(team);
              setShowWaitlistModal(true);
            }}
          >
            Join Waitlist
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => handleReserveTeam(team)}
            disabled={submitting}
          >
            {submitting ? 'Loading...' : 'Reserve This Team'}
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Own the Official Fan Huddle for Your Team
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            One exclusive sponsor per team. Reserve your spot before launch.
          </p>
          <Button
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-6 text-lg"
            onClick={scrollToTeams}
          >
            View Available Teams
            <ChevronDown className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-foreground mb-10">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">One Founding Sponsor Per Team</h3>
              <p className="text-sm text-muted-foreground">
                Exclusive sponsorship rights for your chosen team's fan community.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Brand Visibility Everywhere</h3>
              <p className="text-sm text-muted-foreground">
                Your brand appears in fan chats, AI recaps, and badges.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                <Award className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Priority Access & Pricing</h3>
              <p className="text-sm text-muted-foreground">
                Founding partners lock priority access and launch pricing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Directory */}
      <section id="team-directory" className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Team Directory</h2>
              <p className="text-muted-foreground">Reserve your exclusive sponsorship today</p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading teams...</div>
          ) : (
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="flex w-full overflow-x-auto gap-1 h-auto p-1 mb-6">
                <TabsTrigger value="all" className="flex-shrink-0 px-4">All</TabsTrigger>
                <TabsTrigger value="NFL" className="flex-shrink-0 px-4">NFL</TabsTrigger>
                <TabsTrigger value="NBA" className="flex-shrink-0 px-4">NBA</TabsTrigger>
                <TabsTrigger value="MLB" className="flex-shrink-0 px-4">MLB</TabsTrigger>
                <TabsTrigger value="NCAA" className="flex-shrink-0 px-4">College</TabsTrigger>
              </TabsList>

              {['all', 'NFL', 'NBA', 'MLB', 'NCAA'].map(tab => (
                <TabsContent key={tab} value={tab} className="mt-0">
                  {filterTeams(tab === 'all' ? null : tab).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filterTeams(tab === 'all' ? null : tab).map(team => (
                        <TeamCard key={team.id} team={team} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No {tab === 'all' ? '' : tab} teams found
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </section>

      {/* Deposit Info */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Founding Partner Deposit</h2>
          <div className="text-4xl font-bold text-primary mb-4">$149</div>
          <p className="text-muted-foreground mb-2">One-time, non-refundable deposit</p>
          <p className="text-sm text-muted-foreground">
            Deposit is applied to your first invoice at launch. Secures exclusive sponsorship rights for your team.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="refundable">
              <AccordionTrigger className="text-left">Is the deposit refundable?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                No. The deposit secures exclusivity and is applied to your first invoice at launch.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="billing">
              <AccordionTrigger className="text-left">When does billing start?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Billing begins when the huddle officially launches. Your $149 deposit will be credited toward your first invoice.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="plans-change">
              <AccordionTrigger className="text-left">What if plans change?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Founding sponsors retain exclusivity until launch or may be contacted about alternative sponsorship opportunities.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 px-4 bg-primary/10">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Ready to claim your team?</h2>
          <p className="text-muted-foreground mb-6">
            Don't miss your chance to be the exclusive sponsor for your favorite team's fan community.
          </p>
          <Button
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={scrollToTeams}
          >
            View Available Teams
          </Button>
        </div>
      </section>

      {/* Waitlist Modal */}
      <Dialog open={showWaitlistModal} onOpenChange={setShowWaitlistModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join Waitlist</DialogTitle>
            <DialogDescription>
              {selectedTeam && `The ${selectedTeam.city} ${selectedTeam.name} sponsorship is currently reserved. Join the waitlist to be notified if it becomes available.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Your Name"
              value={waitlistForm.name}
              onChange={(e) => setWaitlistForm({ ...waitlistForm, name: e.target.value })}
            />
            <Input
              type="email"
              placeholder="Email Address"
              value={waitlistForm.email}
              onChange={(e) => setWaitlistForm({ ...waitlistForm, email: e.target.value })}
            />
            <Input
              placeholder="Company Name"
              value={waitlistForm.company}
              onChange={(e) => setWaitlistForm({ ...waitlistForm, company: e.target.value })}
            />
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleJoinWaitlist}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Join Waitlist'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md text-center">
          <div className="py-6">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center">
              <PartyPopper className="w-10 h-10 text-primary" />
            </div>
            <DialogTitle className="text-2xl mb-4">You're Locked In!</DialogTitle>
            <DialogDescription className="text-base space-y-4">
              <p>
                You're now the founding sponsor for <strong className="text-foreground">{reservedTeamName}</strong>.
              </p>
              <p>
                We'll contact you before launch to activate your sponsorship. Your $149 deposit will be applied to your first invoice.
              </p>
            </DialogDescription>
            <Button
              className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setShowSuccessModal(false)}
            >
              Got It!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
