import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { formatErr } from "@/lib/api";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("ankursharma12092002@gmail.com");
  const [password, setPassword] = useState("Admin@12345");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      nav("/");
      toast.success("Welcome back!");
    } catch (err) {
      toast.error(formatErr(err));
    } finally { setLoading(false); }
  };

  const demo = (em) => { setEmail(em); setPassword("Admin@12345"); };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2">
      <div className="hidden lg:block relative overflow-hidden">
        <img src="https://images.unsplash.com/photo-1780593116478-c46838f86523?crop=entropy&cs=srgb&fm=jpg&q=85"
             alt="banquet" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-tr from-black/95 via-black/60 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10">
          <div className="text-5xl font-display font-bold tracking-tight gold-gradient-text">GrandImperia</div>
          <div className="text-2xl font-display text-white/90 mt-2">Banquet Management System</div>
          <div className="text-white/60 mt-4 max-w-md text-sm leading-relaxed">
            Command every event, hall, payment and report from one high-precision console designed for premium venues.
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12 bg-background">
        <Card className="w-full max-w-md p-8 card-elev">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-700 flex items-center justify-center font-bold text-black">GB</div>
            <div>
              <div className="font-display text-xl gold-gradient-text font-bold">GrandImperia</div>
              <div className="text-xs text-muted-foreground">Sign in to your workspace</div>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input data-testid="login-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/>
            </div>
            <div>
              <Label>Password</Label>
              <Input data-testid="login-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/>
            </div>
            <Button data-testid="login-submit" type="submit" disabled={loading} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-semibold">
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
          <div className="mt-6 border-t border-border pt-4">
            <div className="text-xs text-muted-foreground mb-2">Quick role login (password: Admin@12345):</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button type="button" onClick={()=>demo("ankursharma12092002@gmail.com")} className="px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-left" data-testid="demo-admin">Super Admin</button>
              <button type="button" onClick={()=>demo("manager@bms.com")} className="px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-left" data-testid="demo-manager">Manager</button>
              <button type="button" onClick={()=>demo("staff@bms.com")} className="px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-left" data-testid="demo-staff">Booking Staff</button>
              <button type="button" onClick={()=>demo("accountant@bms.com")} className="px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-left" data-testid="demo-accountant">Accountant</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
