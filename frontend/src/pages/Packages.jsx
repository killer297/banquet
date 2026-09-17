import React, { useEffect, useState } from "react";
import { api, fmtINR, formatErr } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const EMPTY = { name:"", description:"", price:0, per_plate:true, services:[], tax_percent:18, discount_percent:0, status:"active" };

export default function Packages() {
  const { hasRole } = useAuth();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [servicesText, setServicesText] = useState("");

  const load = async () => { const { data } = await api.get("/packages"); setRows(data); };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      const payload = { ...form, services: servicesText.split(",").map(s=>s.trim()).filter(Boolean) };
      if (form.id) await api.put(`/packages/${form.id}`, payload);
      else await api.post("/packages", payload);
      toast.success("Package saved"); setOpen(false); load();
    } catch (e) { toast.error(formatErr(e)); }
  };

  return (
    <div className="space-y-5" data-testid="packages-page">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Packages & Services</h1>
          <p className="text-muted-foreground text-sm">Bundle catering, décor and services into signature offerings.</p>
        </div>
        {hasRole("super_admin","manager") && (
          <Button onClick={()=>{setForm(EMPTY); setServicesText(""); setOpen(true);}} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="new-package-btn">
            <Plus size={16} className="mr-1"/> New Package
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {rows.map(p => (
          <Card key={p.id} className="card-elev p-5 hover-lift" data-testid={`pkg-card-${p.id}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="font-display text-lg font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{p.description}</div>
              </div>
              <Badge className={p.status==="active"?"bg-emerald-500/15 text-emerald-400 border-emerald-500/30":"bg-rose-500/15 text-rose-400"}>{p.status}</Badge>
            </div>
            <div className="mt-4 text-2xl font-display font-bold gold-gradient-text tabular">
              {fmtINR(p.price)}<span className="text-xs text-muted-foreground font-normal ml-1">{p.per_plate ? "/plate" : "/package"}</span>
            </div>
            <div className="flex flex-wrap gap-1 mt-3">
              {p.services?.map(s => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
            </div>
            <div className="flex justify-between mt-4 text-xs text-muted-foreground">
              <div>Tax: {p.tax_percent}%</div>
              <div>Discount: {p.discount_percent}%</div>
              {hasRole("super_admin","manager") && (
                <Button size="icon" variant="ghost" onClick={()=>{setForm(p); setServicesText((p.services||[]).join(", ")); setOpen(true);}} data-testid={`edit-pkg-${p.id}`}><Edit size={14}/></Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o)=>!o&&setOpen(false)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{form.id ? "Edit Package" : "New Package"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Price</Label><Input type="number" value={form.price} onChange={e=>setForm({...form,price:+e.target.value})}/></div>
              <div><Label>Tax %</Label><Input type="number" value={form.tax_percent} onChange={e=>setForm({...form,tax_percent:+e.target.value})}/></div>
              <div><Label>Discount %</Label><Input type="number" value={form.discount_percent} onChange={e=>setForm({...form,discount_percent:+e.target.value})}/></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.per_plate} onCheckedChange={v=>setForm({...form,per_plate:v})}/>
              <Label>Price is per plate</Label>
            </div>
            <div><Label>Services (comma-separated)</Label>
              <Textarea value={servicesText} onChange={e=>setServicesText(e.target.value)} placeholder="Welcome drinks, Buffet, DJ"/></div>
          </div>
          <DialogFooter><Button onClick={submit} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="pkg-save">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
