import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { RunbookList } from "@/pages/runbook-list";
import { RunbookDetail } from "@/pages/runbook-detail";
import { RunbookForm } from "@/pages/runbook-form";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={RunbookList} />
      <Route path="/runbooks/new" component={RunbookForm} />
      <Route path="/runbooks/:id/edit" component={RunbookForm} />
      <Route path="/runbooks/:id" component={RunbookDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
