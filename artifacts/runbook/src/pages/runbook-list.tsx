import { Layout } from "@/components/layout";
import { 
  useListRunbooks, 
  useGetRunbookStats, 
  useSeedRunbooks,
  getListRunbooksQueryKey,
  getGetRunbookStatsQueryKey
} from "@workspace/api-client-react";
import { useState } from "react";
import { Link } from "wouter";
import { Search, AlertCircle, Database, ShieldAlert, Activity, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

export function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500/10 text-red-500 border-red-500/20",
    high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    low: "bg-green-500/10 text-green-500 border-green-500/20"
  };
  return (
    <Badge variant="outline" className={`font-mono uppercase text-[10px] tracking-wider border rounded-sm px-2 ${colors[severity] || colors.low}`}>
      {severity}
    </Badge>
  );
}

export function RunbookList() {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [systemFilter, setSystemFilter] = useState<string>("all");
  
  const { data: runbooks, isLoading } = useListRunbooks({
    search: search || undefined,
    severity: severityFilter !== "all" ? severityFilter as any : undefined,
    system: systemFilter !== "all" ? systemFilter : undefined,
  });

  const { data: stats } = useGetRunbookStats();
  
  const queryClient = useQueryClient();
  const seedRunbooks = useSeedRunbooks();
  
  const handleSeed = () => {
    seedRunbooks.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRunbooksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRunbookStatsQueryKey() });
      }
    });
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6 font-mono">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1 md:col-span-4 lg:col-span-1 flex flex-col gap-4">
            <div className="bg-card border border-border p-4 rounded-md">
              <h3 className="text-xs uppercase text-muted-foreground font-bold tracking-wider mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4" /> System Status
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-3xl font-bold text-foreground">{stats?.total || 0}</div>
                  <div className="text-xs text-muted-foreground uppercase mt-1">Total Runbooks</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-red-500">{stats?.bySeverity?.critical || 0}</div>
                  <div className="text-xs text-muted-foreground uppercase mt-1">Critical</div>
                </div>
              </div>
            </div>
            
            {stats && stats.total === 0 && (
              <div className="bg-card border border-border p-4 rounded-md flex flex-col items-center justify-center text-center gap-3">
                <Database className="h-8 w-8 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">Database is empty</div>
                <Button 
                  onClick={handleSeed} 
                  disabled={seedRunbooks.isPending}
                  size="sm"
                  variant="outline"
                  className="w-full font-mono text-xs"
                >
                  {seedRunbooks.isPending ? "Seeding..." : "Seed Example Data"}
                </Button>
              </div>
            )}
          </div>
          
          <div className="col-span-1 md:col-span-4 lg:col-span-3 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search title, steps, tags..." 
                  className="pl-9 bg-card border-border font-mono h-10 rounded-sm focus-visible:ring-1 focus-visible:ring-primary"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full md:w-[160px] bg-card border-border rounded-sm h-10 font-mono text-xs uppercase">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent className="font-mono text-xs uppercase rounded-sm">
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical" className="text-red-500">Critical</SelectItem>
                  <SelectItem value="high" className="text-orange-500">High</SelectItem>
                  <SelectItem value="medium" className="text-yellow-500">Medium</SelectItem>
                  <SelectItem value="low" className="text-green-500">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="bg-card border border-border rounded-md overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-4 p-3 bg-muted/30 border-b border-border text-xs uppercase font-bold text-muted-foreground tracking-wider">
                <div className="col-span-5">Title & System</div>
                <div className="col-span-2">Severity</div>
                <div className="col-span-3">Tags</div>
                <div className="col-span-2 text-right">Updated</div>
              </div>
              
              <div className="divide-y divide-border">
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <div key={i} className="p-4 grid grid-cols-12 gap-4">
                      <div className="col-span-12 md:col-span-5">
                        <Skeleton className="h-5 w-3/4 mb-2 bg-muted" />
                        <Skeleton className="h-4 w-1/2 bg-muted" />
                      </div>
                      <div className="col-span-12 md:col-span-2 hidden md:block">
                        <Skeleton className="h-6 w-20 bg-muted" />
                      </div>
                    </div>
                  ))
                ) : runbooks?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <ShieldAlert className="h-8 w-8 opacity-50" />
                    <p>No runbooks found matching criteria.</p>
                  </div>
                ) : (
                  runbooks?.map((rb) => (
                    <Link key={rb.id} href={`/runbooks/${rb.id}`} className="block hover:bg-muted/20 transition-colors p-4 md:p-3">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        <div className="col-span-1 md:col-span-5 flex flex-col gap-1">
                          <div className="font-bold text-foreground text-sm truncate">{rb.title}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="text-primary">[{rb.system}]</span>
                          </div>
                        </div>
                        <div className="col-span-1 md:col-span-2">
                          <SeverityBadge severity={rb.severity} />
                        </div>
                        <div className="col-span-1 md:col-span-3 hidden md:flex flex-wrap gap-1">
                          {rb.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded-sm border border-border">
                              {tag}
                            </span>
                          ))}
                          {rb.tags.length > 3 && (
                            <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">+{rb.tags.length - 3}</span>
                          )}
                        </div>
                        <div className="col-span-1 md:col-span-2 text-left md:text-right text-xs text-muted-foreground">
                          {new Date(rb.updatedAt).toISOString().split('T')[0]}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
