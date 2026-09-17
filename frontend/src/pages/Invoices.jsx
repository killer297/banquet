import React, { useEffect, useState } from "react";
import { api, fmtINR, formatErr } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, Eye } from "lucide-react";
import { toast } from "sonner";

export default function Invoices() {
  const [rows, setRows] = useState([]);
  const [inv, setInv] = useState(null);

  const load = async () => { const { data } = await api.get("/invoices"); setRows(data); };
  useEffect(() => { load(); }, []);

  const view = async (id) => {
    try { const { data } = await api.get(`/invoices/${id}`); setInv(data); }
    catch (e) { toast.error(formatErr(e)); }
  };

  return (
    <div className="space-y-5" data-testid="invoices-page">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground text-sm">GST-compliant invoices with print & PDF export.</p>
      </div>
      <Card className="p-4 card-elev">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Invoice#</TableHead><TableHead>Booking</TableHead>
            <TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">Tax</TableHead>
            <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Due</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length===0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No invoices yet — generate from any booking.</TableCell></TableRow>}
            {rows.map(i => (
              <TableRow key={i.id}>
                <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                <TableCell className="font-mono text-xs">{i.booking_number}</TableCell>
                <TableCell className="text-right tabular">{fmtINR(i.subtotal)}</TableCell>
                <TableCell className="text-right tabular">{fmtINR(i.tax)}</TableCell>
                <TableCell className="text-right tabular font-semibold">{fmtINR(i.total_amount)}</TableCell>
                <TableCell className="text-right tabular text-emerald-400">{fmtINR(i.paid_amount)}</TableCell>
                <TableCell className="text-right tabular text-rose-400">{fmtINR(i.due_amount)}</TableCell>
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={()=>view(i.id)} data-testid={`view-inv-${i.id}`}><Eye size={14}/></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!inv} onOpenChange={(o)=>!o&&setInv(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="no-print">
            <DialogTitle className="flex justify-between items-center">
              <span>Invoice {inv?.invoice_number}</span>
              <Button size="sm" onClick={()=>window.print()} className="bg-yellow-500 hover:bg-yellow-400 text-black"><Printer size={14} className="mr-1"/>Print / PDF</Button>
            </DialogTitle>
          </DialogHeader>
          {inv && (
            <div className="print-area bg-white text-black p-8 rounded" data-testid="invoice-print">
              <div className="flex justify-between items-start border-b-2 border-yellow-600 pb-4">
                <div>
                  <div className="text-3xl font-bold" style={{fontFamily:"Outfit"}}>{inv.settings?.business_name || "GrandImperia Banquets"}</div>
                  <div className="text-sm text-gray-600">{inv.settings?.address}</div>
                  <div className="text-sm text-gray-600">{inv.settings?.phone} · {inv.settings?.email}</div>
                  {inv.settings?.gstin && <div className="text-sm text-gray-600">GSTIN: {inv.settings.gstin}</div>}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-yellow-700">TAX INVOICE</div>
                  <div className="text-sm mt-1">No: <b>{inv.invoice_number}</b></div>
                  <div className="text-sm">Date: {inv.created_at?.slice(0,10)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 mt-6 text-sm">
                <div>
                  <div className="uppercase text-xs text-gray-500 mb-1">Bill To</div>
                  <div className="font-semibold">{inv.customer?.name}</div>
                  <div>{inv.customer?.phone}</div>
                  <div>{inv.customer?.email}</div>
                  <div className="text-gray-600">{inv.customer?.address}, {inv.customer?.city}</div>
                  {inv.customer?.gst_number && <div>GSTIN: {inv.customer.gst_number}</div>}
                </div>
                <div className="text-right">
                  <div className="uppercase text-xs text-gray-500 mb-1">Event</div>
                  <div className="font-semibold">{inv.booking?.event_name || inv.booking?.event_type}</div>
                  <div>Hall: {inv.hall?.name}</div>
                  <div>Date: {inv.booking?.event_date} · {inv.booking?.start_time}–{inv.booking?.end_time}</div>
                  <div>Guests: {inv.booking?.guest_count}</div>
                  <div>Booking: {inv.booking?.booking_number}</div>
                </div>
              </div>
              <table className="w-full mt-6 text-sm">
                <thead className="bg-gray-100">
                  <tr><th className="text-left p-2">Description</th><th className="text-right p-2">Amount (₹)</th></tr>
                </thead>
                <tbody>
                  <tr><td className="p-2 border-t">Hall Charges — {inv.hall?.name}</td><td className="p-2 border-t text-right">{fmtINR(inv.booking?.hall_charges)}</td></tr>
                  <tr><td className="p-2 border-t">Package / Catering</td><td className="p-2 border-t text-right">{fmtINR(inv.booking?.package_charges)}</td></tr>
                  <tr><td className="p-2 border-t">Food Charges</td><td className="p-2 border-t text-right">{fmtINR(inv.booking?.food_charges)}</td></tr>
                  <tr><td className="p-2 border-t">Decoration</td><td className="p-2 border-t text-right">{fmtINR(inv.booking?.decoration_charges)}</td></tr>
                  <tr><td className="p-2 border-t">Additional Services</td><td className="p-2 border-t text-right">{fmtINR(inv.booking?.additional_charges)}</td></tr>
                  <tr><td className="p-2 border-t font-semibold">Subtotal</td><td className="p-2 border-t text-right font-semibold">{fmtINR(inv.subtotal)}</td></tr>
                  <tr><td className="p-2 border-t">Discount</td><td className="p-2 border-t text-right">- {fmtINR(inv.discount)}</td></tr>
                  <tr><td className="p-2 border-t">GST @ {inv.booking?.tax_percent}%</td><td className="p-2 border-t text-right">{fmtINR(inv.tax)}</td></tr>
                  <tr className="bg-yellow-50"><td className="p-2 font-bold text-lg">GRAND TOTAL</td><td className="p-2 text-right font-bold text-lg">{fmtINR(inv.total_amount)}</td></tr>
                  <tr><td className="p-2 border-t text-green-700">Paid</td><td className="p-2 border-t text-right text-green-700">{fmtINR(inv.paid_amount)}</td></tr>
                  <tr><td className="p-2 border-t text-red-600 font-semibold">Balance Due</td><td className="p-2 border-t text-right text-red-600 font-semibold">{fmtINR(inv.due_amount)}</td></tr>
                </tbody>
              </table>
              <div className="mt-8 flex justify-between text-xs text-gray-500">
                <div>Payment Terms: Balance due before event date.<br/>Thank you for choosing GrandImperia.</div>
                <div className="text-right">
                  <div className="mt-8 border-t border-gray-400 pt-1 w-40 ml-auto">Authorized Signatory</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
