"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import {
  ShoppingCart, TrendingUp, TrendingDown, Users,
  LogOut, Plus, Moon, Sun, Home, List, FileText, Settings, BarChart2
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#E26D5C", "#4E8770", "#E29578", "#97A3B0", "#6B8DD6"];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);

      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(prof);

      const now = new Date();
      const { data: exp } = await supabase
        .from("expenses")
        .select("*, profiles(full_name)")
        .gte("expense_date", new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
        .lte("expense_date", new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString());
      setExpenses(exp || []);

      // শুধু regular users (admin বাদে)
      const { data: profs } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "user");
      setAllProfiles(profs || []);

      setLoading(false);
    };
    init();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--accent)", fontSize: "1.2rem" }}>Loading...</div>
    </div>
  );

  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.total_amount), 0);
  const perPerson = allProfiles.length > 0 ? totalExpense / allProfiles.length : 0;

  const userExpenses = {};
  allProfiles.forEach(p => { userExpenses[p.id] = { name: p.full_name, spent: 0 }; });
  expenses.forEach(e => {
    if (userExpenses[e.user_id]) userExpenses[e.user_id].spent += Number(e.total_amount);
  });

  const settlements = Object.values(userExpenses).map(u => ({
    ...u,
    balance: u.spent - perPerson
  }));

  const categoryData = expenses.reduce((acc, e) => {
    const cat = e.category || "other";
    const existing = acc.find(a => a.name === cat);
    if (existing) existing.value += Number(e.total_amount);
    else acc.push({ name: cat, value: Number(e.total_amount) });
    return acc;
  }, []);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonth = new Date().getMonth();
  const fmt = (amount) => `CA$${Number(amount).toFixed(2)}`;

  // Admin হলে তার spent দেখাবে না
  const isAdmin = profile?.role === "admin";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", paddingBottom: "5rem" }}>
      {/* Header */}
      <div style={{ backgroundColor: "var(--bg-card)", padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: "36px", height: "36px", backgroundColor: "var(--accent)", borderRadius: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Home size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--text-primary)" }}>Family Expense</h1>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              {isAdmin ? "👑 Admin" : "Member"} · {monthNames[currentMonth]}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button onClick={() => setDarkMode(!darkMode)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: "0.5rem" }}>
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: "0.5rem" }}>
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div style={{ padding: "1.5rem", maxWidth: "800px", margin: "0 auto" }}>

        {/* Admin view */}
        {isAdmin ? (
          <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid var(--accent)", textAlign: "center" }}>
            <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👑</p>
            <p style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: "1rem" }}>Admin Panel</p>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              You are managing this app. Go to Settings to approve users or manage expenses.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", justifyContent: "center" }}>
              <button onClick={() => router.push("/settings")}
                style={{ padding: "0.6rem 1.25rem", borderRadius: "0.75rem", border: "none", backgroundColor: "var(--accent)", color: "white", fontWeight: "600", cursor: "pointer", fontSize: "0.875rem" }}>
                ⚙️ Settings
              </button>
              <button onClick={() => router.push("/expenses")}
                style={{ padding: "0.6rem 1.25rem", borderRadius: "0.75rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)", fontWeight: "600", cursor: "pointer", fontSize: "0.875rem" }}>
                📋 All Expenses
              </button>
            </div>
          </div>
        ) : (
          /* Regular User view */
          <>
            {/* Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
              {[
                { label: "Total This Month", value: fmt(totalExpense), icon: <TrendingDown size={20} />, color: "var(--expense)" },
                { label: "Your Share", value: fmt(perPerson), icon: <Users size={20} />, color: "var(--accent)" },
                { label: "You Spent", value: fmt(userExpenses[user?.id]?.spent || 0), icon: <ShoppingCart size={20} />, color: "var(--income)" },
                { label: "Your Balance", value: fmt((userExpenses[user?.id]?.spent || 0) - perPerson), icon: <TrendingUp size={20} />, color: ((userExpenses[user?.id]?.spent || 0) - perPerson) >= 0 ? "var(--income)" : "var(--expense)" },
              ].map((card, i) => (
                <div key={i} style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1.25rem", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.5rem" }}>{card.label}</p>
                      <p style={{ color: card.color, fontSize: "1.25rem", fontWeight: "700" }}>{card.value}</p>
                    </div>
                    <div style={{ color: card.color, opacity: 0.8 }}>{card.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Settlement Summary */}
            <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1.5rem", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h2 style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: "1rem" }}>💸 Settlement Summary</h2>
                <button onClick={() => router.push("/settlement")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" }}>
                  View All
                </button>
              </div>
              {settlements.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>No expenses this month</p>
              ) : (
                settlements.map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 0", borderBottom: i < settlements.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", color: "var(--accent)" }}>
                        {s.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.875rem" }}>{s.name}</p>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>Spent: {fmt(s.spent)}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: s.balance >= 0 ? "var(--income)" : "var(--expense)", fontWeight: "700", fontSize: "0.875rem" }}>
                        {s.balance >= 0 ? `+${fmt(s.balance)}` : `-${fmt(Math.abs(s.balance))}`}
                      </p>
                      <p style={{ color: "var(--text-secondary)", fontSize: "0.7rem" }}>
                        {s.balance >= 0 ? "will receive" : "needs to pay"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Category Pie Chart */}
            {categoryData.length > 0 && (
              <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1.5rem", border: "1px solid var(--border)" }}>
                <h2 style={{ color: "var(--text-primary)", fontWeight: "700", marginBottom: "1rem", fontSize: "1rem" }}>
                  📊 Spending by Category
                </h2>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(val) => fmt(val)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Recent Expenses */}
            <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1.25rem", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h2 style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: "1rem" }}>🧾 Recent Expenses</h2>
                <button onClick={() => router.push("/expenses")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" }}>
                  View All
                </button>
              </div>
              {expenses.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>No expenses yet. Add your first expense!</p>
              ) : (
                expenses.slice(0, 5).map((exp, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 0", borderBottom: i < Math.min(expenses.length, 5) - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "0.75rem", backgroundColor: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>
                        {exp.category === "grocery" ? "🛒" : exp.category === "bill" ? "💡" : exp.category === "transport" ? "🚗" : exp.category === "medicine" ? "💊" : "📦"}
                      </div>
                      <div>
                        <p style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.875rem" }}>{exp.shop_name || "Unknown Shop"}</p>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{exp.profiles?.full_name} · {exp.expense_date}</p>
                      </div>
                    </div>
                    <p style={{ color: "var(--expense)", fontWeight: "700" }}>{fmt(exp.total_amount)}</p>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: "var(--bg-card)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-around", padding: "0.75rem 0", zIndex: 100 }}>
        {[
          { icon: <Home size={22} />, label: "Home", path: "/dashboard" },
          { icon: <List size={22} />, label: "Expenses", path: "/expenses" },
          { icon: <Plus size={22} />, label: "Add", path: "/add-expense" },
          { icon: <FileText size={22} />, label: "Settlement", path: "/settlement" },
          { icon: <BarChart2 size={22} />, label: "Report", path: "/report" },
          { icon: <Settings size={22} />, label: "Settings", path: "/settings" },
        ].map((item, i) => (
          <button key={i} onClick={() => router.push(item.path)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", background: "none", border: "none", cursor: "pointer", color: item.path === "/dashboard" ? "var(--accent)" : "var(--text-secondary)", padding: "0.25rem 0.5rem" }}>
            {item.icon}
            <span style={{ fontSize: "0.6rem", fontWeight: "600" }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}