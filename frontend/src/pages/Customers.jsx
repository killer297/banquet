import React, { useEffect, useState } from "react";
import { api, fmtINR, formatErr } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Edit, Eye } from "lucide-react";

const EMPTY = { name:"", phone:"", email:"", address:"", city:"", gst_number:"", notes:"" };

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [view, setView] = useState(null);

  const load = async () => {
    const { data } = await api.get("/customers", { params: q ? { q } : {} });
    setRows(data);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      if (form.id) await api.put(`/customers/${form.id}`, form);
      else await api.post("/customers", form);
      toast.success("Customer saved"); setOpen(false); setForm(EMPTY); load();
    } catch (e) { toast.error(formatErr(e)); }
  };

  const openView = async (id) => {
    const { data } = await api.get(`/customers/${id}`);
    setView(data);
  };

  return (
    <div className="space-y-5" data-testid="customers-page">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm">Your growing directory of VIPs and families.</p>
        </div>
        <Button onClick={()=>{setForm(EMPTY); setOpen(true);}} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="new-customer-btn">
          <Plus size={16} className="mr-1"/> New Customer
        </Button>
      </div>

      <Card className="p-4 card-elev">
        <div className="flex gap-2 mb-4">
          <Input placeholder="Search name, phone or email…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} className="max-w-md" data-testid="customer-search"/>
          <Button variant="outline" onClick={load}>Search</Button>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead>
            <TableHead>City</TableHead><TableHead className="text-right">Bookings</TableHead>
            <TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Outstanding</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.email}</TableCell>
                <TableCell>{c.city}</TableCell>
                <TableCell className="text-right tabular">{c.total_bookings}</TableCell>
                <TableCell className="text-right tabular">{fmtINR(c.total_revenue)}</TableCell>
                <TableCell className="text-right tabular text-rose-400">{fmtINR(c.outstanding)}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={()=>openView(c.id)} data-testid={`view-cust-${c.id}`}><Eye size={14}/></Button>
                  <Button size="icon" variant="ghost" onClick={()=>{setForm(c); setOpen(true);}}><Edit size={14}/></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={(o)=>!o&&setOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Edit Customer" : "New Customer"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {[["name","Name"],["phone","Phone"],["email","Email"],["city","City"],["gst_number","GST/VAT"]].map(([k,l])=>(
              <div key={k} className={k==="notes"?"col-span-2":""}><Label>{l}</Label>
                <Input value={form[k]||""} onChange={e=>setForm({...form,[k]:e.target.value})} data-testid={`cust-${k}`}/></div>
            ))}
            <div className="col-span-2"><Label>Address</Label>
              <Textarea value={form.address||""} onChange={e=>setForm({...form,address:e.target.value})}/></div>
            <div className="col-span-2"><Label>Notes</Label>
              <Textarea value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
          </div>
          <DialogFooter><Button onClick={submit} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="cust-save">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(o)=>!o&&setView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{view?.name}</DialogTitle></DialogHeader>
          {view && <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><b>Phone:</b> {view.phone}</div>
              <div><b>Email:</b> {view.email}</div>
              <div><b>City:</b> {view.city}</div>
              <div><b>GST:</b> {view.gst_number || "—"}</div>
            </div>
            <div className="text-sm font-semibold text-yellow-400 uppercase tracking-wider pt-2">Booking History</div>
            <div className="max-h-72 overflow-auto space-y-2">
              {view.bookings?.map(b => (
                <div key={b.id} className="p-2 rounded bg-white/[0.03] border border-border/50 text-sm flex justify-between">
                  <div><span className="font-mono text-xs">{b.booking_number}</span> · {b.event_type} · {b.event_date}</div>
                  <div className="tabular">{fmtINR(b.total_amount)}</div>
                </div>
              ))}
              {(!view.bookings || view.bookings.length === 0) && <div className="text-muted-foreground text-sm">No bookings yet.</div>}
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
