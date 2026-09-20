import React, { useEffect, useState } from "react";
import { api, ROLES } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AuditLogs() {
  const [rows, setRows] = useState([]);
  useEffect(() => { (async () => { const { data } = await api.get("/audit-logs"); setRows(data); })(); }, []);
  return (
    <div className="space-y-5" data-testid="audit-page">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground text-sm">Every important action, forever traceable.</p>
      </div>
      <Card className="card-elev">
        <div className="divide-y divide-border/50">
          {rows.length===0 && <div className="p-6 text-center text-muted-foreground text-sm">No activity yet.</div>}
          {rows.map(l => (
            <div key={l.id} className="p-4 flex items-start gap-4 hover:bg-white/[0.02]">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400 text-xs font-bold">
                {(l.user_name || "?")[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm"><b>{l.user_name}</b> <span className="text-muted-foreground">({ROLES[l.user_role] || l.user_role})</span> <span className="text-yellow-400">{l.action}</span> {l.entity} <span className="font-mono text-xs text-muted-foreground">{l.entity_id?.slice(0,8)}</span></div>
                {l.details && <div className="text-xs text-muted-foreground mt-1">{l.details}</div>}
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
