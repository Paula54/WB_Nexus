import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link2 } from "lucide-react";
import KpiCards from "@/components/ads/KpiCards";
import CampaignList from "@/components/ads/CampaignList";
import GoogleCampaignList from "@/components/ads/GoogleCampaignList";
import CampaignCreateDialog from "@/components/ads/CampaignCreateDialog";
import MetaAdsConnectModal from "@/components/ads/MetaAdsConnectModal";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useGoogleAdsCampaigns } from "@/hooks/useGoogleAdsCampaigns";
import TrialExpiredBanner from "@/components/TrialExpiredBanner";

interface Campaign {
  id: string;
  platform: "meta" | "google";
  daily_budget: number;
  status: "active" | "paused" | "completed";
  ad_copy: string | null;
  target_audience: string | null;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
  };
  created_at: string;
}

export default function Ads() {
  const { user } = useAuth();
  const trial = useTrialStatus();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaConnected, setMetaConnected] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("google");

  const googleAds = useGoogleAdsCampaigns();

  const fetchCampaigns = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("ads_campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching campaigns:", error);
    } else {
      setCampaigns((data as Campaign[]) || []);
    }
    setLoading(false);
  }, [user]);

  const fetchMetaStatus = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("projects")
      .select("id, meta_ads_account_id, meta_access_token")
      .limit(1)
      .maybeSingle();

    if (data) {
      setProjectId(data.id);
      setMetaConnected(!!data.meta_ads_account_id && !!data.meta_access_token);
    }
  }, [user]);

  useEffect(() => {
    fetchCampaigns();
    fetchMetaStatus();
  }, [fetchCampaigns, fetchMetaStatus]);

  // KPI calculations
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.metrics?.impressions || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.metrics?.clicks || 0), 0);
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.metrics?.spend || 0), 0);
  const costPerLead = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : "0.00";
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";

  return (
    <div className="space-y-6">
      {trial.isExpired && <TrialExpiredBanner plan={trial.plan} />}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Anúncios</h1>
          <p className="text-muted-foreground mt-1">
            Atrai mais clientes com campanhas inteligentes
          </p>
        </div>
        <div className="flex items-center gap-3">
          {metaConnected ? (
            <Badge className="bg-primary/15 text-primary border-primary/30 px-3 py-1.5 text-sm">
              ✅ Meta Ads Conectado
            </Badge>
          ) : (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setConnectModalOpen(true)}
            >
              <Link2 className="h-4 w-4" />
              Conectar API Meta Ads
            </Button>
          )}
          {googleAds.connected && (
            <Badge className="bg-primary/15 text-primary border-primary/30 px-3 py-1.5 text-sm">
              ✅ Google Ads Conectado
            </Badge>
          )}
          {user && !trial.isExpired && (
            <CampaignCreateDialog
              userId={user.id}
              metaConnected={metaConnected}
              projectId={projectId}
              onCreated={fetchCampaigns}
            />
          )}
        </div>
      </div>

      {/* Tabs: Google Ads vs Meta/Local */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="google">Google Ads</TabsTrigger>
          <TabsTrigger value="local">Meta / Local</TabsTrigger>
        </TabsList>

        <TabsContent value="google" className="space-y-6">
          {/* Google Ads KPI Cards */}
          <KpiCards
            totalImpressions={googleAds.totalImpressions}
            totalClicks={googleAds.totalClicks}
            totalSpend={googleAds.totalSpend}
            ctr={googleAds.ctr}
            costPerLead={googleAds.costPerLead}
          />

          {/* Google Ads Campaign List */}
          <GoogleCampaignList
            campaigns={googleAds.campaigns}
            loading={googleAds.loading}
            syncing={googleAds.syncing}
            connected={googleAds.connected}
            customerIdMissing={googleAds.customerIdMissing}
            error={googleAds.error}
            onSync={googleAds.syncNow}
          />
        </TabsContent>

        <TabsContent value="local" className="space-y-6">
          {/* Local/Meta KPI Cards */}
          <KpiCards
            totalImpressions={totalImpressions}
            totalClicks={totalClicks}
            totalSpend={totalSpend}
            ctr={ctr}
            costPerLead={costPerLead}
          />

          {/* Local Campaigns List */}
          <CampaignList
            campaigns={campaigns}
            loading={loading}
            onRefresh={fetchCampaigns}
          />
        </TabsContent>
      </Tabs>

      {/* Meta Ads Connect Modal */}
      <MetaAdsConnectModal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        projectId={projectId}
        onConnected={() => {
          setMetaConnected(true);
          fetchMetaStatus();
        }}
      />
    </div>
  );
}
