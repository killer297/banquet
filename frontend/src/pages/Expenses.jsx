import React, { useEffect, useState } from "react";
import { api, fmtINR, formatErr } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const CATS = ["Staff","Electricity","Maintenance","Decoration","Catering","Marketing","Rent","Equipment","Other"];
const EMPTY = { date: new Date().toISOString().slice(0,10), category:"Catering", description:"", amount:0, method:"cash", vendor:"", notes:"" };

export default function Expenses() {
  const { hasRole } = useAuth();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = async () => { const { data } = await api.get("/expenses"); setRows(data); };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try { await api.post("/expenses", form); toast.success("Expense saved"); setOpen(false); setForm(EMPTY); load(); }
    catch (e) { toast.error(formatErr(e)); }
  };
  const del = async (id) => { if (window.confirm("Delete expense?")) { await api.delete(`/expenses/${id}`); load(); } };

  const total = rows.reduce((s, e) => s + (e.amount||0), 0);

  return (
    <div className="space-y-5" data-testid="expenses-page">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground text-sm">Total tracked: <span className="tabular text-rose-400 font-semibold">{fmtINR(total)}</span></p>
        </div>
        {hasRole("super_admin","manager","accountant") && (
          <Button onClick={()=>{setForm(EMPTY); setOpen(true);}} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="new-expense-btn"><Plus size={16} className="mr-1"/>New Expense</Button>
        )}
      </div>
      <Card className="p-4 card-elev">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Ref#</TableHead><TableHead>Date</TableHead><TableHead>Category</TableHead>
            <TableHead>Description</TableHead><TableHead>Vendor</TableHead><TableHead>Method</TableHead>
            <TableHead className="text-right">Amount</TableHead><TableHead/>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{e.expense_number}</TableCell>
                <TableCell>{e.date}</TableCell>
                <TableCell>{e.category}</TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell>{e.vendor}</TableCell>
                <TableCell className="uppercase text-xs">{e.method}</TableCell>
                <TableCell className="text-right tabular text-rose-400 font-semibold">{fmtINR(e.amount)}</TableCell>
                <TableCell>{hasRole("super_admin","manager") && <Button size="icon" variant="ghost" onClick={()=>del(e.id)}><Trash2 size={14} className="text-rose-400"/></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={open} onOpenChange={(o)=>!o&&setOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Expense</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={v=>setForm({...form,category:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{CATS.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="col-span-2"><Label>Description</Label><Input value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
            <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={e=>setForm({...form,amount:+e.target.value})} data-testid="expense-amount"/></div>
            <div><Label>Method</Label>
              <Select value={form.method} onValueChange={v=>setForm({...form,method:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{["cash","upi","card","bank","cheque","other"].map(m=><SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="col-span-2"><Label>Vendor</Label><Input value={form.vendor} onChange={e=>setForm({...form,vendor:e.target.value})}/></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
          </div>
          <DialogFooter><Button onClick={submit} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="expense-save">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
