import { Layout } from "@/components/layout";
import { 
  useCreateRunbook, 
  useUpdateRunbook, 
  useGetRunbook,
  getListRunbooksQueryKey,
  getGetRunbookStatsQueryKey
} from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const runbookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  system: z.string().min(1, "System is required"),
  severity: z.enum(["low", "medium", "high", "critical"]),
  steps: z.string().min(1, "Steps are required"),
  rollback: z.string(),
  tags: z.string().transform(val => 
    val.split(',').map(t => t.trim()).filter(Boolean)
  ).or(z.array(z.string()))
});

type RunbookFormValues = z.infer<typeof runbookSchema>;

export function RunbookForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: runbook, isLoading } = useGetRunbook(Number(id), {
    query: {
      enabled: isEdit,
    }
  });

  const createMutation = useCreateRunbook();
  const updateMutation = useUpdateRunbook();

  const form = useForm<RunbookFormValues>({
    resolver: zodResolver(runbookSchema),
    defaultValues: {
      title: "",
      system: "",
      severity: "low",
      steps: "",
      rollback: "",
      tags: "",
    },
  });

  const initializedRef = useRef(false);

  useEffect(() => {
    if (isEdit && runbook && !initializedRef.current) {
      form.reset({
        title: runbook.title,
        system: runbook.system,
        severity: runbook.severity,
        steps: runbook.steps,
        rollback: runbook.rollback || "",
        tags: runbook.tags ? runbook.tags.join(", ") : "",
      });
      initializedRef.current = true;
    }
  }, [isEdit, runbook, form]);

  const onSubmit = (values: RunbookFormValues) => {
    // tags is already transformed by zod if it's a string from input
    const data = {
      ...values,
      tags: Array.isArray(values.tags) ? values.tags : []
    };

    if (isEdit) {
      updateMutation.mutate({ id: Number(id), data }, {
        onSuccess: (updated) => {
          toast({ title: "Runbook updated successfully" });
          queryClient.invalidateQueries({ queryKey: getListRunbooksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRunbookStatsQueryKey() });
          setLocation(`/runbooks/${updated.id}`);
        },
        onError: () => {
          toast({ title: "Failed to update", variant: "destructive" });
        }
      });
    } else {
      createMutation.mutate({ data }, {
        onSuccess: (created) => {
          toast({ title: "Runbook created successfully" });
          queryClient.invalidateQueries({ queryKey: getListRunbooksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRunbookStatsQueryKey() });
          setLocation(`/runbooks/${created.id}`);
        },
        onError: () => {
          toast({ title: "Failed to create", variant: "destructive" });
        }
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isEdit && isLoading) {
    return (
      <Layout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-10 w-full bg-muted" />
          <Skeleton className="h-64 w-full bg-muted" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6 font-mono max-w-4xl mx-auto">
        <div className="flex items-center gap-4 border-b border-border pb-4">
          <Link href={isEdit ? `/runbooks/${id}` : "/"} className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-sm hover:bg-muted/50">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">
            {isEdit ? "EDIT RUNBOOK" : "NEW RUNBOOK"}
          </h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-card border border-border p-6 rounded-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Database Failover Procedure" className="bg-background border-border rounded-sm font-sans" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="system"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">System</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. PostgreSQL, EKS, Redis" className="bg-background border-border rounded-sm font-sans" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Severity</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border rounded-sm uppercase text-xs">
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-sm uppercase text-xs font-mono">
                        <SelectItem value="low" className="text-green-500">Low</SelectItem>
                        <SelectItem value="medium" className="text-yellow-500">Medium</SelectItem>
                        <SelectItem value="high" className="text-orange-500">High</SelectItem>
                        <SelectItem value="critical" className="text-red-500">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Tags</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. database, tier-1, networking (comma separated)" className="bg-background border-border rounded-sm font-sans" {...field} value={Array.isArray(field.value) ? field.value.join(", ") : field.value} />
                    </FormControl>
                    <FormDescription className="text-[10px]">Comma separated list of tags</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="steps"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Execution Steps (Markdown)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="# Step 1..." 
                        className="bg-background border-border rounded-sm font-mono min-h-[200px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rollback"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold text-red-400/80">Rollback Procedure (Markdown)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Instructions to revert..." 
                        className="bg-background border-red-900/30 rounded-sm font-mono min-h-[150px] focus-visible:ring-red-500/50" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t border-border">
              <Button type="button" variant="outline" asChild className="rounded-sm border-border bg-transparent hover:bg-muted/50">
                <Link href={isEdit ? `/runbooks/${id}` : "/"}>CANCEL</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90">
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? "SAVING..." : "SAVE RUNBOOK"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </Layout>
  );
}
