import React, { useEffect, useMemo, useState } from "react";
import { api, fmtINR, formatErr, STATUS_META } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Eye, Edit, Trash2, CreditCard, FileText as FileIcon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const EVENT_TYPES = ["Wedding","Reception","Birthday","Corporate Meeting","Conference","Engagement","Anniversary","Party","Seminar","Other"];
const STATUSES = ["inquiry","hold","pending","confirmed","checked_in","completed","cancelled","no_show"];

function BookingForm({ open, onClose, onSaved, editing }) {
  const [customers, setCustomers] = useState([]);
  const [halls, setHalls] = useState([]);
  const [packages, setPackages] = useState([]);
  const [avail, setAvail] = useState(null);
  const [newCust, setNewCust] = useState(false);
  const [newCustData, setNewCustData] = useState({ name:"", phone:"", email:"", city:"" });
  const empty = {
    customer_id:"", hall_id:"", event_type:"Wedding", event_name:"",
    event_date: new Date().toISOString().slice(0,10),
    start_time:"18:00", end_time:"23:00", guest_count:100, package_id:"",
    seating:"Round Tables", special_requirements:"",
    hall_charges:0, package_charges:0, food_charges:0, decoration_charges:0,
    additional_charges:0, discount:0, tax_percent:18, status:"pending", notes:""
  };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [c, h, p] = await Promise.all([api.get("/customers"), api.get("/halls"), api.get("/packages")]);
      setCustomers(c.data); setHalls(h.data); setPackages(p.data);
    })();
    setForm(editing || empty);
    setAvail(null);
  }, [open, editing]);

  const totals = useMemo(() => {
    const sub = +form.hall_charges + +form.package_charges + +form.food_charges + +form.decoration_charges + +form.additional_charges;
    const disc = +form.discount;
    const taxable = Math.max(0, sub - disc);
    const tax = taxable * (+form.tax_percent) / 100;
    return { subtotal: sub, tax, total: taxable + tax };
  }, [form]);

  const checkAvail = async () => {
    if (!form.hall_id || !form.event_date) return;
    try {
      const q = new URLSearchParams({ hall_id: form.hall_id, event_date: form.event_date,
        start_time: form.start_time, end_time: form.end_time });
      if (editing?.id) q.set("exclude_id", editing.id);
      const { data } = await api.get(`/bookings/availability?${q}`);
      setAvail(data);
    } catch (e) { toast.error(formatErr(e)); }
  };

  const submit = async () => {
    try {
      let cust_id = form.customer_id;
      if (newCust) {
        const { data } = await api.post("/customers", newCustData);
        cust_id = data.id;
      }
      const payload = { ...form, customer_id: cust_id };
      if (editing?.id) await api.put(`/bookings/${editing.id}`, payload);
      else await api.post("/bookings", payload);
      toast.success(editing ? "Booking updated" : "Booking created");
      onSaved(); onClose();
    } catch (e) { toast.error(formatErr(e)); }
  };

  return (
    <Dialog open={open} onOpenChange={(o)=>!o&&onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-2xl">{editing ? "Edit Booking" : "New Booking"}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="text-sm font-semibold text-yellow-400 uppercase tracking-wider">Customer</div>
          {!newCust ? (
            <div className="flex gap-2">
              <Select value={form.customer_id} onValueChange={v=>setForm({...form, customer_id:v})}>
                <SelectTrigger data-testid="booking-customer-select"><SelectValue placeholder="Select customer"/></SelectTrigger>
                <SelectContent>{customers.map(c=><SelectItem key={c.id} value={c.id}>{c.name} · {c.phone}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={()=>setNewCust(true)} data-testid="new-customer-toggle">+ New</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Input placeholder="Name" value={newCustData.name} onChange={e=>setNewCustData({...newCustData,name:e.target.value})} data-testid="new-cust-name"/>
              <Input placeholder="Phone" value={newCustData.phone} onChange={e=>setNewCustData({...newCustData,phone:e.target.value})} data-testid="new-cust-phone"/>
              <Input placeholder="Email" value={newCustData.email} onChange={e=>setNewCustData({...newCustData,email:e.target.value})}/>
              <Input placeholder="City" value={newCustData.city} onChange={e=>setNewCustData({...newCustData,city:e.target.value})}/>
              <Button type="button" variant="outline" onClick={()=>setNewCust(false)} className="col-span-2 md:col-span-4 w-fit">Use existing</Button>
            </div>
          )}

          <div className="text-sm font-semibold text-yellow-400 uppercase tracking-wider pt-2">Event</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><Label>Event Type</Label>
              <Select value={form.event_type} onValueChange={v=>setForm({...form, event_type:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="col-span-2"><Label>Event Name</Label>
              <Input value={form.event_name} onChange={e=>setForm({...form,event_name:e.target.value})} data-testid="booking-event-name"/></div>
            <div><Label>Date</Label>
              <Input type="date" value={form.event_date} onChange={e=>setForm({...form,event_date:e.target.value})} data-testid="booking-date"/></div>
            <div><Label>Start Time</Label>
              <Input type="time" value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})}/></div>
            <div><Label>End Time</Label>
              <Input type="time" value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})}/></div>
            <div><Label>Guest Count</Label>
              <Input type="number" value={form.guest_count} onChange={e=>setForm({...form,guest_count:+e.target.value})} data-testid="booking-guests"/></div>
            <div><Label>Hall</Label>
              <Select value={form.hall_id} onValueChange={v=>setForm({...form, hall_id:v})}>
                <SelectTrigger data-testid="booking-hall-select"><SelectValue placeholder="Select hall"/></SelectTrigger>
                <SelectContent>{halls.map(h=><SelectItem key={h.id} value={h.id}>{h.name} · Cap {h.capacity}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>Package</Label>
              <Select value={form.package_id} onValueChange={v=>setForm({...form, package_id:v})}>
                <SelectTrigger><SelectValue placeholder="Optional"/></SelectTrigger>
                <SelectContent>{packages.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={checkAvail} data-testid="check-availability">Check Availability</Button>
            {avail && (avail.available
              ? <div className="flex items-center gap-2 text-emerald-400 text-sm" data-testid="avail-ok"><CheckCircle2 size={16}/>Hall Available</div>
              : <div className="flex items-center gap-2 text-rose-400 text-sm" data-testid="avail-conflict"><AlertTriangle size={16}/>Conflict with {avail.conflict.booking_number} ({avail.conflict.start_time}–{avail.conflict.end_time})</div>)}
          </div>

          <div className="text-sm font-semibold text-yellow-400 uppercase tracking-wider pt-2">Charges (₹)</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {["hall_charges","package_charges","food_charges","decoration_charges","additional_charges","discount","tax_percent"].map(k=>(
              <div key={k}><Label className="capitalize">{k.replace(/_/g," ")}</Label>
                <Input type="number" value={form[k]} onChange={e=>setForm({...form,[k]:+e.target.value})} data-testid={`charge-${k}`}/></div>
            ))}
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v=>setForm({...form,status:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{STATUSES.map(s=><SelectItem key={s} value={s}>{STATUS_META[s]?.label}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>

          <Card className="p-4 bg-yellow-500/5 border-yellow-500/20">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><div className="text-muted-foreground">Subtotal</div><div className="tabular font-semibold text-lg">{fmtINR(totals.subtotal)}</div></div>
              <div><div className="text-muted-foreground">Tax</div><div className="tabular font-semibold text-lg">{fmtINR(totals.tax)}</div></div>
              <div><div className="text-muted-foreground">Grand Total</div><div className="tabular font-bold text-xl text-yellow-400">{fmtINR(totals.total)}</div></div>
            </div>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="booking-save">Save Booking</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ booking, onClose, onSaved }) {
  const [amt, setAmt] = useState(0);
  const [method, setMethod] = useState("upi");
  const [txn, setTxn] = useState("");
  useEffect(()=>{ setAmt(booking?.due_amount || 0); }, [booking]);
  const submit = async () => {
    try {
      await api.post("/payments", { booking_id: booking.id, amount: +amt,
        payment_date: new Date().toISOString().slice(0,10), method, transaction_id: txn, notes: "" });
      toast.success("Payment recorded");
      onSaved(); onClose();
    } catch (e) { toast.error(formatErr(e)); }
  };
  return (
    <Dialog open={!!booking} onOpenChange={(o)=>!o&&onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Payment · {booking?.booking_number}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Due: <span className="tabular text-rose-400">{fmtINR(booking?.due_amount)}</span></div>
          <div><Label>Amount</Label><Input type="number" value={amt} onChange={e=>setAmt(e.target.value)} data-testid="payment-amount"/></div>
          <div><Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                {["cash","upi","card","bank","cheque","other"].map(m=><SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select></div>
          <div><Label>Transaction ID</Label><Input value={txn} onChange={e=>setTxn(e.target.value)}/></div>
        </div>
        <DialogFooter><Button onClick={submit} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="payment-save">Save Payment</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Bookings() {
  const { hasRole } = useAuth();
  const [rows, setRows] = useState([]);
  const [statusF, setStatusF] = useState("all");
  const [q, setQ] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [payFor, setPayFor] = useState(null);

  const load = async () => {
    const params = {};
    if (statusF !== "all") params.status = statusF;
    if (q) params.q = q;
    const { data } = await api.get("/bookings", { params });
    setRows(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusF]);

  const del = async (id) => {
    if (!window.confirm("Cancel this booking?")) return;
    try { await api.delete(`/bookings/${id}`); toast.success("Cancelled"); load(); }
    catch (e) { toast.error(formatErr(e)); }
  };

  const changeStatus = async (id, status) => {
    try { await api.put(`/bookings/${id}/status`, { status }); toast.success("Status updated"); load(); }
    catch (e) { toast.error(formatErr(e)); }
  };

  return (
    <div className="space-y-5" data-testid="bookings-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground text-sm">Every event, every hall, in real time.</p>
        </div>
        <Button onClick={()=>{setEditing(null); setOpenForm(true);}} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="new-booking-button">
          <Plus size={16} className="mr-1"/> New Booking
        </Button>
      </div>

      <Card className="p-4 card-elev">
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <Input placeholder="Search booking number…" value={q} onChange={e=>setQ(e.target.value)}
                 onKeyDown={e=>e.key==="Enter"&&load()} className="max-w-xs" data-testid="booking-search"/>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="w-44" data-testid="status-filter"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.map(s=><SelectItem key={s} value={s}>{STATUS_META[s]?.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load}>Apply</Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking#</TableHead><TableHead>Customer</TableHead><TableHead>Event</TableHead>
                <TableHead>Hall</TableHead><TableHead>Date · Time</TableHead><TableHead>Guests</TableHead>
                <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Due</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No bookings</TableCell></TableRow>}
              {rows.map(b => (
                <TableRow key={b.id} data-testid={`booking-row-${b.id}`}>
                  <TableCell className="font-mono text-xs">{b.booking_number}</TableCell>
                  <TableCell><div className="font-medium">{b.customer_name}</div><div className="text-xs text-muted-foreground">{b.customer_phone}</div></TableCell>
                  <TableCell><div className="font-medium">{b.event_name || b.event_type}</div><div className="text-xs text-muted-foreground">{b.event_type}</div></TableCell>
                  <TableCell>{b.hall_name}</TableCell>
                  <TableCell><div className="text-sm">{b.event_date}</div><div className="text-xs text-muted-foreground">{b.start_time}–{b.end_time}</div></TableCell>
                  <TableCell className="tabular">{b.guest_count}</TableCell>
                  <TableCell className="text-right tabular">{fmtINR(b.total_amount)}</TableCell>
                  <TableCell className="text-right tabular text-rose-400">{fmtINR(b.due_amount)}</TableCell>
                  <TableCell>
                    <Select value={b.status} onValueChange={v=>changeStatus(b.id, v)}>
                      <SelectTrigger className={`h-8 text-xs w-32 ${STATUS_META[b.status]?.cls}`}><SelectValue/></SelectTrigger>
                      <SelectContent>{STATUSES.map(s=><SelectItem key={s} value={s}>{STATUS_META[s]?.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={()=>{setEditing(b); setOpenForm(true);}} data-testid={`edit-${b.id}`}><Edit size={14}/></Button>
                    <Button size="icon" variant="ghost" onClick={()=>setPayFor(b)} data-testid={`pay-${b.id}`}><CreditCard size={14}/></Button>
                    <Button size="icon" variant="ghost" onClick={async ()=>{
                      try { const inv = await api.post(`/invoices/${b.id}`); toast.success(`Invoice ${inv.data.invoice_number}`); }
                      catch(e){ toast.error(formatErr(e)); }
                    }} data-testid={`invoice-${b.id}`}><FileIcon size={14}/></Button>
                    {hasRole("super_admin") && <Button size="icon" variant="ghost" onClick={()=>del(b.id)} data-testid={`del-${b.id}`}><Trash2 size={14} className="text-rose-400"/></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <BookingForm open={openForm} onClose={()=>setOpenForm(false)} onSaved={load} editing={editing}/>
      <PaymentDialog booking={payFor} onClose={()=>setPayFor(null)} onSaved={load}/>
    </div>
  );
}
