import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Users, TrendingUp, TrendingDown, Minus, RefreshCw, Loader2, ArrowUpDown } from "lucide-react";

interface GroupData {
  id: string;
  name: string;
  currentMembers: number;
  maxMembers: number;
  snapshots: { date: string; members: number; displayDate: string }[];
  growth: number;
  growthPercent: number;
}

type SortOption = 'name' | 'members-desc' | 'members-asc' | 'growth-desc' | 'growth-asc';

export function GroupMembersChart() {
  const { user } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('members-desc');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (user) {
      fetchGroupsAndSnapshots();
    }
  }, [user, effectiveUserId]);

  const fetchGroupsAndSnapshots = async () => {
    try {
      setLoading(true);
      
      // Fetch active groups
      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select("id, name, member_count, max_members")
        .eq("user_id", effectiveUserId)
        .eq("is_active", true)
        .order("name");

      if (groupsError) throw groupsError;
      if (!groupsData || groupsData.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      // Fetch snapshots for last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const startDate = sevenDaysAgo.toISOString().split('T')[0];

      const { data: snapshotsData, error: snapshotsError } = await supabase
        .from("group_member_snapshots")
        .select("group_id, member_count, recorded_at")
        .in("group_id", groupsData.map(g => g.id))
        .gte("recorded_at", startDate)
        .order("recorded_at", { ascending: true });

      if (snapshotsError) throw snapshotsError;

      // Process data for each group
      const processedGroups: GroupData[] = groupsData.map(group => {
        const groupSnapshots = (snapshotsData || [])
          .filter(s => s.group_id === group.id)
          .map(s => ({
            date: s.recorded_at,
            members: s.member_count,
            displayDate: new Date(s.recorded_at).toLocaleDateString('pt-BR', { 
              weekday: 'short', 
              day: 'numeric' 
            }),
          }));

        // Add current data if not in snapshots
        const today = new Date().toISOString().split('T')[0];
        const hasTodaySnapshot = groupSnapshots.some(s => s.date === today);
        if (!hasTodaySnapshot) {
          groupSnapshots.push({
            date: today,
            members: group.member_count,
            displayDate: 'Hoje',
          });
        }

        // Calculate growth
        const oldestSnapshot = groupSnapshots[0];
        const growth = oldestSnapshot 
          ? group.member_count - oldestSnapshot.members
          : 0;
        const growthPercent = oldestSnapshot && oldestSnapshot.members > 0
          ? ((growth / oldestSnapshot.members) * 100)
          : 0;

        return {
          id: group.id,
          name: group.name,
          currentMembers: group.member_count,
          maxMembers: group.max_members || 1024,
          snapshots: groupSnapshots,
          growth,
          growthPercent,
        };
      });

      setGroups(processedGroups);
    } catch (error) {
      console.error("Error fetching group snapshots:", error);
    } finally {
      setLoading(false);
    }
  };

  const recordSnapshot = async () => {
    try {
      setRecording(true);
      const { error } = await supabase.rpc('record_daily_group_snapshots');
      if (error) throw error;
      await fetchGroupsAndSnapshots();
    } catch (error) {
      console.error("Error recording snapshot:", error);
    } finally {
      setRecording(false);
    }
  };

  const sortedGroups = [...groups].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'members-desc':
        return b.currentMembers - a.currentMembers;
      case 'members-asc':
        return a.currentMembers - b.currentMembers;
      case 'growth-desc':
        return b.growth - a.growth;
      case 'growth-asc':
        return a.growth - b.growth;
      default:
        return 0;
    }
  });

  const displayedGroups = showAll ? sortedGroups : sortedGroups.slice(0, 6);
  const totalGrowth = groups.reduce((sum, g) => sum + g.growth, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Evolução de Membros
              {totalGrowth !== 0 && (
                <Badge 
                  variant={totalGrowth > 0 ? "default" : "destructive"} 
                  className="ml-2"
                >
                  {totalGrowth > 0 ? '+' : ''}{totalGrowth}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Crescimento dos grupos nos últimos 7 dias
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <ArrowUpDown className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="members-desc">Mais membros</SelectItem>
                <SelectItem value="members-asc">Menos membros</SelectItem>
                <SelectItem value="growth-desc">Maior crescimento</SelectItem>
                <SelectItem value="growth-asc">Maior queda</SelectItem>
                <SelectItem value="name">Nome A-Z</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={recordSnapshot}
              disabled={recording}
              className="h-8"
            >
              {recording ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : groups.length === 0 ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
            <Users className="h-12 w-12 mb-3 opacity-30" />
            <p>Nenhum grupo ativo</p>
            <p className="text-sm">Sincronize grupos para ver a evolução</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedGroups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
            
            {groups.length > 6 && (
              <div className="mt-4 text-center">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Ver menos' : `Ver todos (${groups.length})`}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GroupCard({ group }: { group: GroupData }) {
  const capacityPercent = Math.round((group.currentMembers / group.maxMembers) * 100);
  const hasData = group.snapshots.length > 0;
  
  // Determine chart colors based on growth
  const strokeColor = group.growth > 0 
    ? 'hsl(142, 71%, 45%)' // green
    : group.growth < 0 
      ? 'hsl(0, 84%, 60%)' // red
      : 'hsl(45, 93%, 47%)'; // yellow/orange for neutral
  
  const fillColor = group.growth > 0 
    ? 'hsl(142, 71%, 45%)' 
    : group.growth < 0 
      ? 'hsl(0, 84%, 60%)' 
      : 'hsl(45, 93%, 47%)';

  return (
    <div className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
      {/* Header with name and growth */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-medium text-sm truncate flex-1" title={group.name}>
          {group.name}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          {group.growth > 0 ? (
            <TrendingUp className="h-3 w-3 text-success" />
          ) : group.growth < 0 ? (
            <TrendingDown className="h-3 w-3 text-destructive" />
          ) : (
            <Minus className="h-3 w-3 text-muted-foreground" />
          )}
          <span className={`text-xs font-medium ${
            group.growth > 0 ? 'text-success' : 
            group.growth < 0 ? 'text-destructive' : 
            'text-muted-foreground'
          }`}>
            {group.growth > 0 ? '+' : ''}{group.growth}
          </span>
        </div>
      </div>

      {/* Area Chart */}
      <div className="h-[80px] w-full -mx-2">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={group.snapshots}
              margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id={`gradient-${group.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={fillColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={fillColor} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="displayDate" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                width={35}
                tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '12px'
                }}
                formatter={(value: number) => [value.toLocaleString(), 'Membros']}
                labelFormatter={(label) => label}
              />
              <Area
                type="monotone"
                dataKey="members"
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#gradient-${group.id})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Sem dados ainda</p>
          </div>
        )}
      </div>

      {/* Footer with stats */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{group.currentMembers.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">membros</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {capacityPercent}% de {group.maxMembers.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
