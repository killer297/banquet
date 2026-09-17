import React, { useEffect, useState } from "react";
import { api, fmtINR } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Payments() {
  const [rows, setRows] = useState([]);
  useEffect(() => { (async () => { const { data } = await api.get("/payments"); setRows(data); })(); }, []);
  const total = rows.reduce((s, p) => s + (p.amount||0), 0);
  return (
    <div className="space-y-5" data-testid="payments-page">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground text-sm">Total received: <span className="tabular text-yellow-400 font-semibold">{fmtINR(total)}</span> across {rows.length} entries.</p>
      </div>
      <Card className="p-4 card-elev">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Payment#</TableHead><TableHead>Booking</TableHead><TableHead>Customer</TableHead>
            <TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Txn ID</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(p => (
              <TableRow key={p.id} data-testid={`pay-row-${p.id}`}>
                <TableCell className="font-mono text-xs">{p.payment_number}</TableCell>
                <TableCell className="font-mono text-xs">{p.booking_number}</TableCell>
                <TableCell>{p.customer_name}</TableCell>
                <TableCell>{p.payment_date}</TableCell>
                <TableCell><Badge variant="outline">{p.method.toUpperCase()}</Badge></TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{p.transaction_id}</TableCell>
                <TableCell className="text-right tabular text-emerald-400 font-semibold">{fmtINR(p.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
