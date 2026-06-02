"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, History, Calendar } from "lucide-react";

export default function SettlementPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [history, setHistory] = useState([]);
  const [paidTransactions, setPaidTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("current");
  const [marking, setMarking] = useState(null);
  const [dateMode, setDateMode] = useState("monthly");
  const [calculated, setCalculated] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const firstDay = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(currentYear, currentMonth, 0).toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(now.toISOString().split("T")[0]);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);

      const { data: profs } = await supabase.from("profiles").select("*");
      setProfiles(profs || []);

      const { data: hist } = await supabase
        .from("settlement_history")
        .select("*, from_profile:from_user(full_name), to_profile:to_user(full_name)")
        .order("paid_at", { ascending: false })
        .limit(20);
      setHistory(hist || []);

      // এই মাসে কোন payments already done
      const { data: paid } = await supabase
        .from("settlement_history")
        .select("from_user, to_user")
        .eq("month", currentMonth)
        .eq("year", currentYear);
      setPaidTransactions(paid || []);

      await fetchExpenses("monthly", firstDay, lastDay);
      setLoading(false);
    };
    init();
  }, []);

  const fetchExpenses = async (mode, start, end) => {
    const s = mode === "monthly" ? firstDay : start;
    const e = mode === "monthly" ? lastDay : end;
    const { data: exp } = await supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", s)
      .lte("expense_date", e);
    setExpenses(exp || []);
    setCalculated(true);
  };

  const handleDateModeChange = (mode) => {
    setDateMode(mode);
    setCalculated(false);
    if (mode === "monthly") {
      fetchExpenses("monthly", firstDay, lastDay);
    }
  };

  const calculateSettlements = () => {
    if (profiles.length === 0) return [];
    const totalExpense = expenses.reduce((sum, e) => sum + Number(e.total_amount), 0);
    const perPerson = totalExpense / profiles.length;

    const balances = {};
    profiles.forEach(p => { balances[p.id] = { name: p.full_name, balance: -perPerson }; });
    expenses.forEach(e => {
      if (balances[e.user_id]) balances[e.user_id].balance += Number(e.total_amount);
    });

    const creditors = Object.entries(balances).filter(([_, v]) => v.balance > 0.01).map(([id, v]) => ({ id, ...v }));
    const debtors = Object.entries(balances).filter(([_, v]) => v.balance < -0.01).map(([id, v]) => ({ id, ...v }));

    const transactions = [];
    const cred = creditors.map(c => ({ ...c }));
    const debt = debtors.map(d => ({ ...d }));

    let i = 0, j = 0;
    while (i < cred.length && j < debt.length) {
      const amount = Math.min(cred[i].balance, -debt[j].balance);
      if (amount > 0.01) {
        transactions.push({
          from_id: debt[j].id,
          from_name: debt[j].name,
          to_id: cred[i].id,
          to_name: cred[i].name,
          amount,
        });
      }
      cred[i].balance -= amount;
      debt[j].balance += amount;
      if (cred[i].balance < 0.01) i++;
      if (debt[j].balance > -0.01) j++;
    }

    // Already paid transactions filter করো
    return transactions.filter(t =>
      !paidTransactions.some(p => p.from_user === t.from_id && p.to_user === t.to_id)
    );
  };

  const allTransactions = calculateSettlements();
  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.total_amount), 0);
  const perPerson = profiles.length > 0 ? totalExpense / profiles.length : 0;
  const userSpent = expenses.filter(e => e.user_id === user?.id).reduce((sum, e) => sum + Number(e.total_amount), 0);
  const fmt = (amount) => `CA$${Number(amount).toFixed(2)}`;

  const handleMarkPaid = async (transaction) => {
    setMarking(`${transaction.from_id}-${transaction.to_id}`);
    try {
      await supabase.from("settlement_history").insert({
        from_user: transaction.from_id,
        to_user: transaction.to_id,
        amount: transaction.amount,
        month: currentMonth,
        year: currentYear,
        paid_at: new Date().toISOString(),
      });

      // Local state update — reload ছাড়াই সরে যাবে
      setPaidTransactions(prev => [...prev, { from_user: transaction.from_id, to_user: transaction.to_id }]);

      // History তে যোগ করো
      const { data: hist } = await supabase
        .from("settlement_history")
        .select("*, from_profile:from_user(full_name), to_profile:to_user(full_name)")
        .order("paid_at", { ascending: false })
        .limit(20);
      setHistory(hist || []);

    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setMarking(null);
    }
  };

  const inputStyle = {
    padding: "0.6rem 0.75rem", borderRadius: "0.75rem",
    border: "1px solid var(--border)", backgroundColor: "var(--bg-input)",
    color: "var(--text-primary)", fontSize: "0.875rem", outline: "none",
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--accent)" }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", paddingBottom: "2rem" }}>
      <div style={{ backgroundColor: "var(--bg-card)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)" }}>
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-primary)" }}>Settlement</h1>
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            {dateMode === "monthly"
              ? `${monthNames[currentMonth - 1]} ${currentYear}`
              : calculated ? `${startDate} → ${endDate}` : "Select date range"}
          </p>
        </div>
      </div>

      <div style={{ padding: "1rem", maxWidth: "600px", margin: "0 auto" }}>
        <div style={{ display: "flex", backgroundColor: "var(--bg-card)", borderRadius: "0.75rem", padding: "4px", marginBottom: "1rem", border: "1px solid var(--border)" }}>
          {[
            { id: "monthly", label: "📅 This Month" },
            { id: "custom", label: "🗓️ Custom Range" },
          ].map((m) => (
            <button key={m.id} onClick={() => handleDateModeChange(m.id)}
              style={{ flex: 1, padding: "0.6rem", borderRadius: "0.6rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.85rem", transition: "all 0.2s", backgroundColor: dateMode === m.id ? "var(--accent)" : "transparent", color: dateMode === m.id ? "white" : "var(--text-secondary)" }}>
              {m.label}
            </button>
          ))}
        </div>

        {dateMode === "custom" && (
          <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1rem", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <Calendar size={16} color="var(--accent)" />
              <p style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.875rem" }}>Select Date Range</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.35rem" }}>Start Date</p>
                <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCalculated(false); }}
                  style={{ ...inputStyle, width: "100%" }} />
              </div>
              <div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.35rem" }}>End Date</p>
                <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCalculated(false); }}
                  style={{ ...inputStyle, width: "100%" }} />
              </div>
            </div>
            <button onClick={() => fetchExpenses("custom", startDate, endDate)}
              style={{ width: "100%", padding: "0.75rem", borderRadius: "0.75rem", border: "none", backgroundColor: "var(--accent)", color: "white", fontWeight: "700", fontSize: "0.9rem", cursor: "pointer" }}>
              🔍 Calculate Settlement
            </button>
          </div>
        )}

        {calculated && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {[
                { label: "Total", value: fmt(totalExpense), color: "var(--text-primary)" },
                { label: "Per Person", value: fmt(perPerson), color: "var(--accent)" },
                { label: "You Spent", value: fmt(userSpent), color: userSpent >= perPerson ? "var(--income)" : "var(--expense)" },
              ].map((card, i) => (
                <div key={i} style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1rem", border: "1px solid var(--border)", textAlign: "center" }}>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.7rem", marginBottom: "0.35rem" }}>{card.label}</p>
                  <p style={{ color: card.color, fontSize: "0.9rem", fontWeight: "700" }}>{card.value}</p>
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1.5rem", border: "1px solid var(--border)" }}>
              <h3 style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: "0.95rem", marginBottom: "1rem" }}>👥 Everyone's Summary</h3>
              {profiles.map((p, i) => {
                const spent = expenses.filter(e => e.user_id === p.id).reduce((sum, e) => sum + Number(e.total_amount), 0);
                const balance = spent - perPerson;
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 0", borderBottom: i < profiles.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", color: "var(--accent)" }}>
                        {p.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.875rem" }}>{p.full_name}</p>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>Spent: {fmt(spent)}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: balance >= 0 ? "var(--income)" : "var(--expense)", fontWeight: "700", fontSize: "0.875rem" }}>
                        {balance >= 0 ? `+${fmt(balance)}` : `-${fmt(Math.abs(balance))}`}
                      </p>
                      <p style={{ color: "var(--text-secondary)", fontSize: "0.7rem" }}>
                        {balance >= 0 ? "will receive" : "needs to pay"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", backgroundColor: "var(--bg-card)", borderRadius: "0.75rem", padding: "4px", marginBottom: "1.5rem", border: "1px solid var(--border)" }}>
              {[
                { id: "current", label: "💸 To Pay" },
                { id: "history", label: "📋 History" },
              ].map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{ flex: 1, padding: "0.6rem", borderRadius: "0.6rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.85rem", transition: "all 0.2s", backgroundColor: activeTab === tab.id ? "var(--accent)" : "transparent", color: activeTab === tab.id ? "white" : "var(--text-secondary)" }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "current" && (
              <div>
                {allTransactions.length === 0 ? (
                  <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "2rem", textAlign: "center", border: "1px solid var(--border)" }}>
                    <CheckCircle size={48} color="var(--income)" style={{ margin: "0 auto 1rem" }} />
                    <p style={{ color: "var(--income)", fontWeight: "700", fontSize: "1rem" }}>All Settled! 🎉</p>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.5rem" }}>No pending payments</p>
                  </div>
                ) : (
                  allTransactions.map((t, i) => {
                    const isMe = t.from_id === user?.id;
                    const isPaying = marking === `${t.from_id}-${t.to_id}`;
                    return (
                      <div key={i} style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1.25rem", marginBottom: "0.75rem", border: `1px solid ${isMe ? "var(--expense)" : "var(--border)"}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isMe ? "1rem" : "0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: isMe ? "var(--expense)" : "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", color: isMe ? "white" : "var(--text-secondary)", fontSize: "0.875rem" }}>
                                {t.from_name?.charAt(0)}
                              </div>
                              <span style={{ color: "var(--text-secondary)" }}>→</span>
                              <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "var(--income)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", color: "white", fontSize: "0.875rem" }}>
                                {t.to_name?.charAt(0)}
                              </div>
                            </div>
                            <div>
                              <p style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.875rem" }}>
                                {isMe ? "You" : t.from_name} → {t.to_name}
                              </p>
                              <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                                {isMe ? "You need to pay" : "Pending payment"}
                              </p>
                            </div>
                          </div>
                          <p style={{ color: isMe ? "var(--expense)" : "var(--text-primary)", fontWeight: "800", fontSize: "1.1rem" }}>
                            {fmt(t.amount)}
                          </p>
                        </div>
                        {isMe && (
                          <button onClick={() => handleMarkPaid(t)} disabled={isPaying}
                            style={{ width: "100%", padding: "0.65rem", borderRadius: "0.75rem", border: "none", backgroundColor: isPaying ? "var(--text-secondary)" : "var(--income)", color: "white", fontWeight: "600", fontSize: "0.875rem", cursor: isPaying ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                            <CheckCircle size={16} />
                            {isPaying ? "Processing..." : "Mark as Paid"}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div>
                {history.length === 0 ? (
                  <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "2rem", textAlign: "center", border: "1px solid var(--border)" }}>
                    <p style={{ color: "var(--text-secondary)" }}>No settlement history yet</p>
                  </div>
                ) : (
                  history.map((h, i) => (
                    <div key={i} style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1rem 1.25rem", marginBottom: "0.75rem", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "var(--income)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <CheckCircle size={18} color="white" />
                        </div>
                        <div>
                          <p style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.875rem" }}>
                            {h.from_profile?.full_name} → {h.to_profile?.full_name}
                          </p>
                          <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                            {monthNames[h.month - 1]} {h.year} · {new Date(h.paid_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <p style={{ color: "var(--income)", fontWeight: "700" }}>{fmt(h.amount)}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}