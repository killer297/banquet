import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Attach token from localStorage if present (mobile-safe fallback for cookies)
api.interceptors.request.use((config) => {
  const t = localStorage.getItem("bms_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export function formatErr(e) {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map(x => x.msg || JSON.stringify(x)).join(" ");
  return e?.message || "Something went wrong";
}

export const fmtINR = (n) => {
  const v = Number(n || 0);
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

export const ROLES = {
  super_admin: "Super Admin",
  manager: "Manager",
  booking_staff: "Booking Staff",
  accountant: "Accountant",
};

export const STATUS_META = {
  inquiry: { label: "Inquiry", cls: "bg-sky-500/10 text-sky-400 border-sky-500/30" },
  hold: { label: "Hold", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  pending: { label: "Pending", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  confirmed: { label: "Confirmed", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  checked_in: { label: "Checked-In", cls: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" },
  completed: { label: "Completed", cls: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  cancelled: { label: "Cancelled", cls: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
  no_show: { label: "No Show", cls: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
};
