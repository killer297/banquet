import React, { useEffect, useState } from "react";
import { api, formatErr, ROLES } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const EMPTY = { name:"", email:"", password:"", role:"booking_staff", phone:"" };

export default function Users() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = async () => { const { data } = await api.get("/users"); setRows(data); };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try { await api.post("/users", form); toast.success("User created"); setOpen(false); setForm(EMPTY); load(); }
    catch (e) { toast.error(formatErr(e)); }
  };
  const del = async (id) => { if (window.confirm("Delete user?")) { await api.delete(`/users/${id}`); load(); } };

  return (
    <div className="space-y-5" data-testid="users-page">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Users & Roles</h1>
          <p className="text-muted-foreground text-sm">Control access, permissions and team membership.</p>
        </div>
        <Button onClick={()=>setOpen(true)} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="new-user-btn"><Plus size={16} className="mr-1"/>New User</Button>
      </div>
      <Card className="p-4 card-elev">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Phone</TableHead><TableHead/>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30">{ROLES[u.role]}</Badge></TableCell>
                <TableCell>{u.phone}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={()=>del(u.id)}><Trash2 size={14} className="text-rose-400"/></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={open} onOpenChange={(o)=>!o&&setOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New User</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
            <div className="col-span-2"><Label>Role</Label>
              <Select value={form.role} onValueChange={v=>setForm({...form,role:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{Object.entries(ROLES).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <DialogFooter><Button onClick={submit} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="user-save">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
