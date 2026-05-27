import { Layout } from "@/components/layout";
import { useGetRunbook, useDeleteRunbook, getListRunbooksQueryKey, getGetRunbookStatsQueryKey } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { ArrowLeft, Edit, Trash2, Clock, Terminal, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "./runbook-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export function RunbookDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: runbook, isLoading, isError } = useGetRunbook(Number(id), {
    query: {
      enabled: !!id
    }
  });

  const deleteMutation = useDeleteRunbook();

  const handleDelete = () => {
    deleteMutation.mutate({ id: Number(id) }, {
      onSuccess: () => {
        toast({
          title: "Runbook deleted",
          description: "The runbook was successfully removed.",
        });
        queryClient.invalidateQueries({ queryKey: getListRunbooksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRunbookStatsQueryKey() });
        setLocation("/");
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to delete runbook. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64 bg-muted" />
          <Skeleton className="h-64 w-full bg-muted" />
        </div>
      </Layout>
    );
  }

  if (isError || !runbook) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-bold">Runbook not found</h2>
          <p className="text-muted-foreground">The requested runbook may have been deleted or doesn't exist.</p>
          <Button asChild variant="outline" className="mt-4 rounded-sm">
            <Link href="/">Back to Index</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6 font-mono max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <ArrowLeft className="h-3 w-3" /> BACK TO INDEX
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 text-xs rounded-sm border-border bg-card hover:bg-muted/50 hover:text-foreground">
              <Link href={`/runbooks/${runbook.id}/edit`}>
                <Edit className="h-3 w-3 mr-2" /> EDIT
              </Link>
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs rounded-sm border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3 w-3 mr-2" /> DELETE
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border rounded-md font-mono">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-foreground">Delete Runbook?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                    This action cannot be undone. This will permanently delete the 
                    <span className="text-foreground font-bold"> {runbook.title} </span> runbook.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-sm text-xs bg-transparent border-border hover:bg-muted/50">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm text-xs">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="flex flex-col gap-6 bg-card border border-border rounded-md p-6">
          <div className="flex flex-col gap-4 border-b border-border pb-6">
            <div className="flex flex-wrap items-center gap-3">
              <SeverityBadge severity={runbook.severity} />
              <span className="text-primary font-bold text-sm tracking-wide bg-primary/10 px-2 py-0.5 rounded-sm border border-primary/20">
                {runbook.system}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">{runbook.title}</h1>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Updated {new Date(runbook.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Terminal className="h-4 w-4" /> Execution Steps
              </h3>
              <div className="bg-[#0f1420] border border-border p-4 rounded-md overflow-x-auto">
                <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                  {runbook.steps}
                </pre>
              </div>
            </div>

            {runbook.rollback && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Rollback Procedure
                </h3>
                <div className="bg-[#1f1414] border border-red-900/30 p-4 rounded-md overflow-x-auto">
                  <pre className="text-sm text-red-200/90 whitespace-pre-wrap font-mono leading-relaxed">
                    {runbook.rollback}
                  </pre>
                </div>
              </div>
            )}

            {runbook.tags && runbook.tags.length > 0 && (
              <div className="space-y-3 border-t border-border pt-6">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {runbook.tags.map(tag => (
                    <span key={tag} className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-sm border border-border">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
