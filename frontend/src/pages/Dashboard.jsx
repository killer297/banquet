import React, { useEffect, useState } from "react";
import { api, fmtINR, STATUS_META } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend } from "recharts";
import { TrendingUp, Calendar, IndianRupee, Clock, CheckCircle2, AlertCircle } from "lucide-react";

const COLORS = ["#D4AF37", "#10B981", "#6366F1", "#F59E0B", "#F43F5E", "#8B5CF6"];

function Kpi({ icon: Icon, label, value, sub, tone = "gold" }) {
  const tones = {
    gold: "from-yellow-500/20 to-yellow-500/5 text-yellow-400 border-yellow-500/20",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20",
    rose: "from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/20",
    indigo: "from-indigo-500/20 to-indigo-500/5 text-indigo-400 border-indigo-500/20",
  };
  return (
    <Card className={`p-5 card-elev hover-lift border bg-gradient-to-br ${tones[tone]}`} data-testid={`kpi-${label.toLowerCase().replace(/\s+/g,"-")}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-3xl font-display font-semibold mt-2 tabular">{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </div>
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
          <Icon size={18} />
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    (async () => {
      try { const r = await api.get("/dashboard"); setD(r.data); } catch (e) { console.error(e); }
    })();
  }, []);

  if (!d) return <div className="text-muted-foreground">Loading dashboard…</div>;

  const statusData = Object.entries(d.status_counts).map(([k,v]) => ({ name: STATUS_META[k]?.label || k, value: v }));

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">Command Center</h1>
          <div className="text-muted-foreground mt-1">Live performance across every hall, booking and rupee.</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Kpi icon={IndianRupee} label="Total Revenue" value={fmtINR(d.kpis.total_revenue)} sub={`Paid ${fmtINR(d.kpis.paid_revenue)}`} tone="gold"/>
        <Kpi icon={AlertCircle} label="Pending Payments" value={fmtINR(d.kpis.pending_revenue)} tone="rose"/>
        <Kpi icon={TrendingUp} label="Net Profit" value={fmtINR(d.kpis.net_profit)} sub={`Expenses ${fmtINR(d.kpis.total_expenses)}`} tone="emerald"/>
        <Kpi icon={Calendar} label="Upcoming Events" value={d.kpis.upcoming_events} sub={`Today: ${d.kpis.today_bookings}`} tone="indigo"/>
        <Kpi icon={CheckCircle2} label="Confirmed" value={d.kpis.confirmed} sub={`Pending: ${d.kpis.pending}`} tone="emerald"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5 card-elev">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Monthly Trend</div>
              <div className="font-display text-lg mt-1">Revenue vs Expenses</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={d.monthly}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.6}/>
                  <stop offset="100%" stopColor="#D4AF37" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.5}/>
                  <stop offset="100%" stopColor="#F43F5E" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3"/>
              <XAxis dataKey="month" stroke="#6B7280" tick={{ fontSize: 11 }}/>
              <YAxis stroke="#6B7280" tick={{ fontSize: 11 }}/>
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }}/>
              <Area dataKey="revenue" stroke="#D4AF37" fill="url(#rev)" strokeWidth={2}/>
              <Area dataKey="expenses" stroke="#F43F5E" fill="url(#exp)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 card-elev">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Booking Status</div>
          <div className="font-display text-lg mb-3">Distribution</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
            {statusData.map((s, i) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i%COLORS.length] }}/>
                <span className="text-muted-foreground">{s.name}</span>
                <span className="tabular">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 card-elev">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Hall Performance</div>
          <div className="font-display text-lg mb-3">Revenue by Hall</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.hall_performance}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3"/>
              <XAxis dataKey="hall" stroke="#6B7280" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60}/>
              <YAxis stroke="#6B7280" tick={{ fontSize: 11 }}/>
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }}/>
              <Bar dataKey="revenue" fill="#D4AF37" radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 card-elev">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Next Events</div>
              <div className="font-display text-lg">Upcoming</div>
            </div>
            <Clock size={16} className="text-muted-foreground"/>
          </div>
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {d.upcoming.length === 0 && <div className="text-sm text-muted-foreground">No upcoming events</div>}
            {d.upcoming.map(b => (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-border/50 hover-lift" data-testid={`upcoming-${b.id}`}>
                <div className="text-center min-w-[52px]">
                  <div className="text-xs text-muted-foreground uppercase">{new Date(b.event_date).toLocaleDateString(undefined,{month:"short"})}</div>
                  <div className="text-lg font-display font-semibold">{new Date(b.event_date).getDate()}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{b.event_name || b.event_type}</div>
                  <div className="text-xs text-muted-foreground truncate">{b.customer_name} · {b.hall_name} · {b.start_time}–{b.end_time}</div>
                </div>
                <Badge variant="outline" className={STATUS_META[b.status]?.cls}>{STATUS_META[b.status]?.label}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
