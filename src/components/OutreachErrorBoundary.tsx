import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

function clearStoredAuth() {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("sb-") || key.includes("supabase") || key.includes("auth-token")) {
      localStorage.removeItem(key);
    }
  });
}

export class OutreachErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[OutreachErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-lg space-y-4 p-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Outreach hit an app error</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              The page is still alive. Clear the stored login and sign in again.
            </p>
          </div>
          <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
            {this.state.error.message || "Unknown error"}
          </pre>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                clearStoredAuth();
                window.location.href = "/OUTREACH?logout=1";
              }}
            >
              Clear login
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </Card>
      </div>
    );
  }
}
