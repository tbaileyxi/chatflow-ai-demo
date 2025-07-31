import { Navigate } from 'react-router-dom';
import { FeedTabs } from "@/components/FeedTabs";
import { HuddleBar } from "@/components/HuddleBar";
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <FeedTabs />
      </div>

      {/* Bottom Huddle Bar */}
      <HuddleBar />
    </div>
  );
};

export default Index;
