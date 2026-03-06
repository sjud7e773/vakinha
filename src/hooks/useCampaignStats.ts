import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_RAISED = 1498;
const DEFAULT_HEARTS = 12;

async function fetchStats(): Promise<{ totalRaised: number; heartCount: number }> {
  try {
    const { data, error } = await supabase
      .from("campaign_stats")
      .select("total_raised, heart_count")
      .eq("id", 1)
      .single();
    if (error) return { totalRaised: DEFAULT_RAISED, heartCount: DEFAULT_HEARTS };
    return {
      totalRaised: Number(data?.total_raised ?? DEFAULT_RAISED),
      heartCount: Number(data?.heart_count ?? DEFAULT_HEARTS),
    };
  } catch {
    return { totalRaised: DEFAULT_RAISED, heartCount: DEFAULT_HEARTS };
  }
}

export function useCampaignStats() {
  const q = useQuery({
    queryKey: ["campaign_stats"],
    queryFn: fetchStats,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    placeholderData: { totalRaised: DEFAULT_RAISED, heartCount: DEFAULT_HEARTS },
  });
  const d = q.data ?? { totalRaised: DEFAULT_RAISED, heartCount: DEFAULT_HEARTS };
  return { totalRaised: d.totalRaised, heartCount: d.heartCount, refetch: q.refetch };
}
