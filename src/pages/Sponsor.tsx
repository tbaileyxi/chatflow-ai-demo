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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, CheckCircle, Clock, Users, MessageSquare, Award, ChevronDown, PartyPopper, X, ShoppingCart, Percent, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

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

const DEPOSIT_PER_TEAM = 149;
const BULK_DISCOUNT_THRESHOLD = 3;
const BULK_DISCOUNT_PERCENT = 20;

export default function Sponsor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [teams, setTeams] = useState<Team[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistTeam, setWaitlistTeam] = useState<Team | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [reservedTeamNames, setReservedTeamNames] = useState<string[]>([]);
  const [reservedCount, setReservedCount] = useState(0);
  const [waitlistForm, setWaitlistForm] = useState<WaitlistFormData>({ name: '', email: '', company: '' });
  const [submitting, setSubmitting] = useState(false);
  const isMobile = useIsMobile();

  // Calculate pricing
  const teamCount = selectedTeams.length;
  const subtotal = DEPOSIT_PER_TEAM * teamCount;
  const hasDiscount = teamCount >= BULK_DISCOUNT_THRESHOLD;
  const discountAmount = hasDiscount ? Math.round(subtotal * BULK_DISCOUNT_PERCENT / 100) : 0;
  const total = subtotal - discountAmount;

  useEffect(() => {
    // Check for success/cancelled params
    const success = searchParams.get('success');
    const teamName = searchParams.get('team');
    const count = searchParams.get('count');
    const cancelled = searchParams.get('cancelled');

    if (success === 'true' && teamName) {
      const names = decodeURIComponent(teamName).split(', ');
      setReservedTeamNames(names);
      setReservedCount(parseInt(count || '1', 10));
      setShowSuccessModal(true);
      setSelectedTeams([]); // Clear cart after successful purchase
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
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, city, logo_url, league')
        .eq('status', 'active')
        .order('league', { ascending: true })
        .order('city', { ascending: true });

      if (teamsError) throw teamsError;

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

  const toggleTeamSelection = (team: Team) => {
    setSelectedTeams(prev => {
      const isSelected = prev.some(t => t.id === team.id);
      if (isSelected) {
        return prev.filter(t => t.id !== team.id);
      } else {
        return [...prev, team];
      }
    });
  };

  const isTeamSelected = (teamId: string) => {
    return selectedTeams.some(t => t.id === teamId);
  };

  const handleCheckout = async () => {
    if (selectedTeams.length === 0) {
      toast.error('Please select at least one team');
      return;
    }

    setSubmitting(true);
    try {
      // Re-check availability before checkout
      const { data: reservations } = await supabase
        .from('sponsor_reservations')
        .select('team_id')
        .eq('status', 'reserved');

      const reservedTeamIds = new Set(reservations?.map(r => r.team_id) || []);
      const unavailableTeams = selectedTeams.filter(t => reservedTeamIds.has(t.id));

      if (unavailableTeams.length > 0) {
        const names = unavailableTeams.map(t => `${t.city} ${t.name}`).join(', ');
        toast.error(`Some teams were just reserved: ${names}. They've been removed from your cart.`);
        setSelectedTeams(prev => prev.filter(t => !reservedTeamIds.has(t.id)));
        await fetchTeams(); // Refresh the list
        setSubmitting(false);
        return;
      }

      const teamsPayload = selectedTeams.map(t => ({
        teamId: t.id,
        teamName: `${t.city} ${t.name}`
      }));

      const { data, error } = await supabase.functions.invoke('create-sponsor-checkout', {
        body: { teams: teamsPayload }
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
    if (!waitlistTeam || !waitlistForm.name || !waitlistForm.email || !waitlistForm.company) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('sponsor_waitlist')
        .insert({
          team_id: waitlistTeam.id,
          name: waitlistForm.name,
          email: waitlistForm.email,
          company: waitlistForm.company
        });

      if (error) throw error;

      toast.success('You\'ve been added to the waitlist!');
      setShowWaitlistModal(false);
      setWaitlistForm({ name: '', email: '', company: '' });
      setWaitlistTeam(null);
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

  const TeamCard = ({ team }: { team: Team }) => {
    const isSelected = isTeamSelected(team.id);
    
    return (
      <Card className={`bg-card/50 border-border transition-all duration-300 ${
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/30'
      }`}>
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
                setWaitlistTeam(team);
                setShowWaitlistModal(true);
              }}
            >
              Join Waitlist
            </Button>
          ) : (
            <div 
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                isSelected 
                  ? 'bg-primary/10 border border-primary' 
                  : 'bg-muted/50 border border-transparent hover:bg-muted'
              }`}
              onClick={() => toggleTeamSelection(team)}
            >
              <Checkbox 
                checked={isSelected}
                onCheckedChange={() => toggleTeamSelection(team)}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                {isSelected ? 'Added to Reservation' : 'Add to Reservation'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Floating Cart Bar
  const CartBar = () => {
    if (selectedTeams.length === 0) return null;

    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg animate-in slide-in-from-bottom-5">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <button 
              className="flex items-center gap-2 text-left"
              onClick={() => setShowCartSheet(true)}
            >
              <div className="relative">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {teamCount}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {teamCount} team{teamCount !== 1 ? 's' : ''} selected
                </p>
                {hasDiscount && (
                  <p className="text-xs text-primary flex items-center gap-1">
                    <Percent className="w-3 h-3" /> 20% discount applied!
                  </p>
                )}
              </div>
            </button>
            
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                {hasDiscount && (
                  <p className="text-xs text-muted-foreground line-through">${subtotal}</p>
                )}
                <p className="text-lg font-bold text-foreground">${total}</p>
              </div>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleCheckout}
                disabled={submitting}
              >
                {submitting ? 'Loading...' : 'Checkout'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
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
              <p className="text-muted-foreground">Select multiple teams to reserve – 3+ teams get 20% off!</p>
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

          {/* Discount Banner */}
          {teamCount > 0 && teamCount < BULK_DISCOUNT_THRESHOLD && (
            <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-3">
              <Percent className="w-5 h-5 text-primary flex-shrink-0" />
              <p className="text-sm text-foreground">
                <span className="font-semibold">Add {BULK_DISCOUNT_THRESHOLD - teamCount} more team{BULK_DISCOUNT_THRESHOLD - teamCount !== 1 ? 's' : ''}</span> to unlock <span className="text-primary font-bold">20% off</span> your entire order!
              </p>
            </div>
          )}

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
          <div className="text-4xl font-bold text-primary mb-2">$149 <span className="text-xl font-normal text-muted-foreground">per team</span></div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary font-semibold mb-4">
            <Percent className="w-4 h-4" />
            Reserve 3+ teams and save 20%
          </div>
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
            <AccordionItem value="bulk-discount">
              <AccordionTrigger className="text-left">How does the bulk discount work?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                When you reserve 3 or more teams in a single checkout, you automatically receive 20% off the total deposit amount. The discount is applied at checkout.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="billing">
              <AccordionTrigger className="text-left">When does billing start?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Billing begins when the huddle officially launches. Your deposit(s) will be credited toward your first invoice(s).
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

      {/* Floating Cart Bar */}
      <CartBar />

      {/* Cart Sheet */}
      <Sheet open={showCartSheet} onOpenChange={setShowCartSheet}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "h-[80vh]" : ""}>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Your Reservation ({teamCount} team{teamCount !== 1 ? 's' : ''})
            </SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-4 flex-1 overflow-auto">
            {selectedTeams.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No teams selected</p>
            ) : (
              selectedTeams.map(team => (
                <div key={team.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    {team.logo_url ? (
                      <img src={team.logo_url} alt={team.name} className="w-10 h-10 object-contain" />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-muted-foreground">{team.city[0]}</span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-foreground">{team.city} {team.name}</p>
                      <p className="text-xs text-muted-foreground">{team.league}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => toggleTeamSelection(team)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {selectedTeams.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border space-y-3">
              {hasDiscount && (
                <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/10 text-primary">
                  <PartyPopper className="w-4 h-4" />
                  <span className="text-sm font-semibold">20% bulk discount applied!</span>
                </div>
              )}
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({teamCount} × $149)</span>
                  <span>${subtotal}</span>
                </div>
                {hasDiscount && (
                  <div className="flex justify-between text-primary">
                    <span>Bulk Discount (20%)</span>
                    <span>-${discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-foreground pt-2 border-t border-border">
                  <span>Total</span>
                  <span>${total}</span>
                </div>
              </div>

              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                size="lg"
                onClick={() => {
                  setShowCartSheet(false);
                  handleCheckout();
                }}
                disabled={submitting}
              >
                {submitting ? 'Loading...' : 'Proceed to Checkout'}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Waitlist Modal */}
      <Dialog open={showWaitlistModal} onOpenChange={setShowWaitlistModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join Waitlist</DialogTitle>
            <DialogDescription>
              {waitlistTeam && `The ${waitlistTeam.city} ${waitlistTeam.name} sponsorship is currently reserved. Join the waitlist to be notified if it becomes available.`}
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
                You're now the founding sponsor for {reservedCount === 1 ? (
                  <strong className="text-foreground">{reservedTeamNames[0]}</strong>
                ) : (
                  <strong className="text-foreground">{reservedCount} teams</strong>
                )}:
              </p>
              {reservedCount > 1 && (
                <ul className="text-left list-disc list-inside space-y-1">
                  {reservedTeamNames.map((name, i) => (
                    <li key={i} className="text-foreground">{name}</li>
                  ))}
                </ul>
              )}
              <p>
                We'll contact you before launch to activate your sponsorship{reservedCount > 1 ? 's' : ''}. Your deposit{reservedCount > 1 ? 's' : ''} will be applied to your first invoice{reservedCount > 1 ? 's' : ''}.
              </p>
            </DialogDescription>
            <div className="flex gap-3 mt-6 justify-center">
              <Button
                variant="outline"
                onClick={() => window.location.href = '/'}
              >
                Return Home
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setShowSuccessModal(false)}
              >
                Browse More Teams
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
