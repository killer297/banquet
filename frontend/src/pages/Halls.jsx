import React, { useEffect, useState } from "react";
import { api, fmtINR, formatErr } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const FACILITIES = ["AC","Projector","Sound System","Stage","Parking","Catering","Wi-Fi","Decoration","LED Wall"];
const EMPTY = { name:"", code:"", capacity:200, location:"", description:"", base_price:0, hourly_price:0, status:"available", facilities:[], image:"" };

export default function Halls() {
  const { hasRole } = useAuth();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = async () => { const { data } = await api.get("/halls"); setRows(data); };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      if (form.id) await api.put(`/halls/${form.id}`, form);
      else await api.post("/halls", form);
      toast.success("Hall saved"); setOpen(false); load();
    } catch (e) { toast.error(formatErr(e)); }
  };

  const toggleFac = (f) => setForm({...form, facilities: form.facilities.includes(f) ? form.facilities.filter(x=>x!==f) : [...form.facilities, f]});

  return (
    <div className="space-y-5" data-testid="halls-page">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Banquet Halls</h1>
          <p className="text-muted-foreground text-sm">Your signature spaces and facilities.</p>
        </div>
        {hasRole("super_admin","manager") && (
          <Button onClick={()=>{setForm(EMPTY); setOpen(true);}} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="new-hall-btn">
            <Plus size={16} className="mr-1"/> New Hall
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {rows.map(h => (
          <Card key={h.id} className="card-elev overflow-hidden hover-lift" data-testid={`hall-card-${h.id}`}>
            <div className="h-40 bg-cover bg-center relative" style={{ backgroundImage: `url(${h.image})` }}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"/>
              <Badge className={`absolute top-3 right-3 ${h.status==="available"?"bg-emerald-500/20 text-emerald-400 border-emerald-500/40":"bg-rose-500/20 text-rose-400 border-rose-500/40"}`}>{h.status}</Badge>
              <div className="absolute bottom-3 left-3 right-3">
                <div className="font-display text-xl font-bold">{h.name}</div>
                <div className="text-xs text-white/70 flex items-center gap-1"><Users size={12}/> Capacity {h.capacity}</div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-2">{h.description}</p>
              <div className="flex flex-wrap gap-1">
                {h.facilities?.map(f => <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>)}
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border/50">
                <div className="tabular text-yellow-400 font-semibold">{fmtINR(h.base_price)}</div>
                {hasRole("super_admin","manager") && (
                  <Button size="sm" variant="ghost" onClick={()=>{setForm(h); setOpen(true);}} data-testid={`edit-hall-${h.id}`}><Edit size={14}/></Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o)=>!o&&setOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit Hall" : "New Hall"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
            <div><Label>Code</Label><Input value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></div>
            <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={e=>setForm({...form,capacity:+e.target.value})}/></div>
            <div><Label>Location</Label><Input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></div>
            <div><Label>Base Price</Label><Input type="number" value={form.base_price} onChange={e=>setForm({...form,base_price:+e.target.value})}/></div>
            <div><Label>Hourly Price</Label><Input type="number" value={form.hourly_price} onChange={e=>setForm({...form,hourly_price:+e.target.value})}/></div>
            <div className="col-span-2"><Label>Image URL</Label><Input value={form.image} onChange={e=>setForm({...form,image:e.target.value})}/></div>
            <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v=>setForm({...form,status:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{["available","maintenance","inactive"].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="col-span-2">
              <Label>Facilities</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {FACILITIES.map(f => (
                  <button key={f} type="button" onClick={()=>toggleFac(f)}
                    className={`text-xs px-2.5 py-1 rounded border ${form.facilities.includes(f)?"bg-yellow-500/20 text-yellow-400 border-yellow-500/40":"border-border text-muted-foreground"}`}>{f}</button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={submit} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="hall-save">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
