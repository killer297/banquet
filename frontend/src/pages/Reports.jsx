import React, { useEffect, useState } from "react";
import { api, fmtINR } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { Download } from "lucide-react";

const COLORS = ["#D4AF37","#10B981","#6366F1","#F59E0B","#F43F5E","#8B5CF6","#0EA5E9"];

function exportCSV(rows, name) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g,'""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(url);
}

export default function Reports() {
  const today = new Date().toISOString().slice(0,10);
  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth()-3);
  const [start, setStart] = useState(monthAgo.toISOString().slice(0,10));
  const [end, setEnd] = useState(today);
  const [preset, setPreset] = useState("3m");
  const [d, setD] = useState(null);

  const setRange = (p) => {
    setPreset(p);
    const now = new Date(); let s = new Date();
    if (p==="today") s = now;
    else if (p==="week") s.setDate(now.getDate()-7);
    else if (p==="month") s = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (p==="last_month") { s = new Date(now.getFullYear(), now.getMonth()-1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); setEnd(e.toISOString().slice(0,10)); }
    else if (p==="year") s = new Date(now.getFullYear(), 0, 1);
    else if (p==="3m") s.setMonth(now.getMonth()-3);
    setStart(s.toISOString().slice(0,10));
    if (p!=="last_month") setEnd(now.toISOString().slice(0,10));
  };

  const load = async () => { const { data } = await api.get("/reports/summary", { params: { start, end } }); setD(data); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [start, end]);

  if (!d) return <div className="text-muted-foreground">Loading…</div>;

  const catData = Object.entries(d.expenses.by_category).map(([k,v])=>({name:k, value:v}));
  const eventData = Object.entries(d.event_types).map(([k,v])=>({name:k, value:v}));
  const statusData = Object.entries(d.bookings.by_status).map(([k,v])=>({name:k, value:v}));

  return (
    <div className="space-y-5" data-testid="reports-page">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm">Complete business intelligence at your fingertips.</p>
        </div>
      </div>

      <Card className="p-4 card-elev">
        <div className="flex flex-wrap gap-2 items-end">
          {[["today","Today"],["week","This Week"],["month","This Month"],["last_month","Last Month"],["3m","Last 3 Months"],["year","This Year"]].map(([k,l])=>(
            <Button key={k} size="sm" variant={preset===k?"default":"outline"} onClick={()=>setRange(k)} className={preset===k?"bg-yellow-500 text-black":""} data-testid={`preset-${k}`}>{l}</Button>
          ))}
          <div className="flex gap-2 items-end ml-auto">
            <div><Label>From</Label><Input type="date" value={start} onChange={e=>{setStart(e.target.value); setPreset("custom");}}/></div>
            <div><Label>To</Label><Input type="date" value={end} onChange={e=>{setEnd(e.target.value); setPreset("custom");}}/></div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 card-elev"><div className="text-xs uppercase text-muted-foreground">Total Revenue</div><div className="text-2xl font-display font-bold tabular mt-1">{fmtINR(d.revenue.total)}</div></Card>
        <Card className="p-4 card-elev"><div className="text-xs uppercase text-muted-foreground">Paid</div><div className="text-2xl font-display font-bold tabular text-emerald-400 mt-1">{fmtINR(d.revenue.paid)}</div></Card>
        <Card className="p-4 card-elev"><div className="text-xs uppercase text-muted-foreground">Pending</div><div className="text-2xl font-display font-bold tabular text-rose-400 mt-1">{fmtINR(d.revenue.pending)}</div></Card>
        <Card className="p-4 card-elev"><div className="text-xs uppercase text-muted-foreground">Net Profit</div><div className="text-2xl font-display font-bold tabular text-yellow-400 mt-1">{fmtINR(d.profit.net)}</div></Card>
        <Card className="p-4 card-elev"><div className="text-xs uppercase text-muted-foreground">Tax Collected</div><div className="text-2xl font-display font-bold tabular mt-1">{fmtINR(d.revenue.tax)}</div></Card>
        <Card className="p-4 card-elev"><div className="text-xs uppercase text-muted-foreground">Discounts Given</div><div className="text-2xl font-display font-bold tabular mt-1">{fmtINR(d.revenue.discounts)}</div></Card>
        <Card className="p-4 card-elev"><div className="text-xs uppercase text-muted-foreground">Expenses</div><div className="text-2xl font-display font-bold tabular text-rose-400 mt-1">{fmtINR(d.expenses.total)}</div></Card>
        <Card className="p-4 card-elev"><div className="text-xs uppercase text-muted-foreground">Bookings</div><div className="text-2xl font-display font-bold tabular mt-1">{d.bookings.total}</div></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 card-elev">
          <div className="flex justify-between items-center mb-3">
            <div><div className="text-xs uppercase text-muted-foreground">Hall Performance</div><div className="font-display text-lg">Revenue by Hall</div></div>
            <Button size="sm" variant="outline" onClick={()=>exportCSV(d.halls, "halls-report")}><Download size={14} className="mr-1"/>CSV</Button>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.halls}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3"/>
              <XAxis dataKey="hall" stroke="#6B7280" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60}/>
              <YAxis stroke="#6B7280" tick={{ fontSize: 11 }}/>
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }}/>
              <Bar dataKey="revenue" fill="#D4AF37" radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 card-elev">
          <div className="text-xs uppercase text-muted-foreground mb-1">Expenses by Category</div>
          <div className="font-display text-lg mb-3">Breakdown</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={catData} innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={2}>
                {catData.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Pie>
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }}/>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 card-elev">
          <div className="text-xs uppercase text-muted-foreground mb-1">Event Types</div>
          <div className="font-display text-lg mb-3">Distribution</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={eventData} layout="vertical">
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3"/>
              <XAxis type="number" stroke="#6B7280" tick={{ fontSize: 11 }}/>
              <YAxis dataKey="name" type="category" stroke="#6B7280" tick={{ fontSize: 11 }} width={120}/>
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }}/>
              <Bar dataKey="value" fill="#10B981" radius={[0,6,6,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 card-elev">
          <div className="text-xs uppercase text-muted-foreground mb-1">Booking Status</div>
          <div className="font-display text-lg mb-3">Overview</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusData} innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={2}>
                {statusData.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Pie>
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }}/>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
