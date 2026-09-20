import React, { useEffect, useState } from "react";
import { api, formatErr } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function Settings() {
  const [f, setF] = useState(null);
  useEffect(() => { (async () => { const { data } = await api.get("/settings"); setF(data); })(); }, []);
  const save = async () => {
    try { await api.put("/settings", f); toast.success("Settings saved"); }
    catch (e) { toast.error(formatErr(e)); }
  };
  if (!f) return null;
  return (
    <div className="space-y-5" data-testid="settings-page">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Venue identity, tax rates and branding.</p>
      </div>
      <Card className="p-6 card-elev max-w-3xl">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Business Name</Label><Input value={f.business_name} onChange={e=>setF({...f,business_name:e.target.value})} data-testid="setting-name"/></div>
          <div><Label>GSTIN</Label><Input value={f.gstin} onChange={e=>setF({...f,gstin:e.target.value})}/></div>
          <div><Label>Phone</Label><Input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></div>
          <div><Label>Email</Label><Input value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></div>
          <div className="col-span-2"><Label>Address</Label><Textarea value={f.address} onChange={e=>setF({...f,address:e.target.value})}/></div>
          <div><Label>Default Tax %</Label><Input type="number" value={f.default_tax} onChange={e=>setF({...f,default_tax:+e.target.value})}/></div>
          <div><Label>Currency Symbol</Label><Input value={f.currency_symbol} onChange={e=>setF({...f,currency_symbol:e.target.value})}/></div>
          <div className="col-span-2"><Label>Logo URL</Label><Input value={f.logo_url} onChange={e=>setF({...f,logo_url:e.target.value})}/></div>
        </div>
        <div className="mt-6"><Button onClick={save} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="settings-save">Save Settings</Button></div>
      </Card>
    </div>
  );
}
