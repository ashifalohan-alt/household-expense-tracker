"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Calendar, Trash2, Download } from "lucide-react";

export default function SettlementPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [history, setHistory] = useState([]);
  const [paidTransactions, setPaidTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("current");
  const [marking, setMarking] = useState(null);
  const [dateMode, setDateMode] = useState("monthly");
  const [calculated, setCalculated] = useState(false);
  const [customAmounts, setCustomAmounts] = useState({});
  const [clearing, setClearing] = useState(false);
  const reportRef = useRef(null);

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

      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(prof);

      const { data: profs } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "user")
        .eq("is_approved", true);
      setProfiles(profs || []);

      await loadHistory();

      const { data: paid } = await supabase
        .from("settlement_history")
        .select("from_user, to_user, amount")
        .eq("month", currentMonth)
        .eq("year", currentYear);
      setPaidTransactions(paid || []);

      await fetchExpenses("monthly", firstDay, lastDay);
      setLoading(false);
    };
    init();
  }, []);

  const loadHistory = async () => {
    const { data: hist } = await supabase
      .from("settlement_history")
      .select("*, from_profile:from_user(full_name), to_profile:to_user(full_name)")
      .order("paid_at", { ascending: false })
      .limit(20);
    setHistory(hist || []);
  };

  const fetchExpenses = async (mode, start, end) => {
    const s = mode === "monthly" ? firstDay : start;
    const e = mode === "monthly" ? lastDay : end;
    const { data: exp } = await supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", s)
      .lte("expense_date", e);
    setExpenses(exp || []);

    const { data: paid } = await supabase
      .from("settlement_history")
      .select("from_user, to_user, amount")
      .eq("month", currentMonth)
      .eq("year", currentYear);
    setPaidTransactions(paid || []);

    setCalculated(true);
  };

  const handleDateModeChange = (mode) => {
    setDateMode(mode);
    setCalculated(false);
    if (mode === "monthly") fetchExpenses("monthly", firstDay, lastDay);
  };

  const handleDeleteHistory = async (id) => {
    if (!confirm("Delete this history record?")) return;
    await supabase.from("settlement_history").delete().eq("id", id);
    setHistory(history.filter(h => h.id !== id));
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
        const alreadyPaid = paidTransactions
          .filter(p => p.from_user === debt[j].id && p.to_user === cred[i].id)
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const remaining = amount - alreadyPaid;
        if (remaining > 0.01) {
          transactions.push({
            from_id: debt[j].id,
            from_name: debt[j].name,
            to_id: cred[i].id,
            to_name: cred[i].name,
            amount: remaining,
          });
        }
      }
      cred[i].balance -= amount;
      debt[j].balance += amount;
      if (cred[i].balance < 0.01) i++;
      if (debt[j].balance > -0.01) j++;
    }
    return transactions;
  };

  const allTransactions = calculateSettlements();
  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.total_amount), 0);
  const perPerson = profiles.length > 0 ? totalExpense / profiles.length : 0;
  const userSpent = expenses.filter(e => e.user_id === user?.id).reduce((sum, e) => sum + Number(e.total_amount), 0);
  const fmt = (amount) => `CA$${Number(amount).toFixed(2)}`;

  const isAllSettled = calculated && allTransactions.length === 0 && totalExpense > 0;

  const getCustomAmount = (transaction) => {
    const key = `${transaction.from_id}-${transaction.to_id}`;
    return customAmounts[key] !== undefined ? customAmounts[key] : transaction.amount.toFixed(2);
  };

  const setCustomAmount = (transaction, value) => {
    const key = `${transaction.from_id}-${transaction.to_id}`;
    setCustomAmounts(prev => ({ ...prev, [key]: value }));
  };

  const handleMarkPaid = async (transaction) => {
    const key = `${transaction.from_id}-${transaction.to_id}`;
    const inputAmount = parseFloat(customAmounts[key] ?? transaction.amount);

    if (isNaN(inputAmount) || inputAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    if (inputAmount > transaction.amount + 0.01) {
      alert(`Amount cannot exceed CA$${transaction.amount.toFixed(2)}`);
      return;
    }

    setMarking(key);
    try {
      await supabase.from("settlement_history").insert({
        from_user: transaction.from_id,
        to_user: transaction.to_id,
        amount: inputAmount,
        month: currentMonth,
        year: currentYear,
        paid_at: new Date().toISOString(),
      });

      setPaidTransactions(prev => [...prev, {
        from_user: transaction.from_id,
        to_user: transaction.to_id,
        amount: inputAmount,
      }]);

      setCustomAmounts(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });

      await loadHistory();
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setMarking(null);
    }
  };

  // PDF generate করো তারপর সব data delete করো
  const handleFinalSettle = async () => {
    if (!confirm("This will generate a PDF report and delete ALL expenses and settlement history. Are you sure?")) return;

    setClearing(true);
    try {
      // Step 1: PDF generate করো
      await generatePDF();

      // Step 2: সব expenses delete করো
      await supabase.from("expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      // Step 3: সব settlement_history delete করো
      await supabase.from("settlement_history").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      // Step 4: Local state reset
      setExpenses([]);
      setHistory([]);
      setPaidTransactions([]);
      setCalculated(false);
      setCustomAmounts({});

      alert("✅ PDF downloaded and all data cleared! Fresh start.");
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setClearing(false);
    }
  };

  const generatePDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    const periodLabel = `${monthNames[currentMonth - 1]} ${currentYear}`;
    let y = 20;

    // Header
    doc.setFillColor(30, 37, 43);
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Family Expense Tracker", 105, 18, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(151, 163, 176);
    doc.text(`Settlement Report — ${periodLabel}`, 105, 28, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 36, { align: "center" });

    y = 55;

    // Summary section
    doc.setTextColor(226, 109, 92);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 15, y);
    y += 8;

    doc.setDrawColor(226, 109, 92);
    doc.line(15, y, 195, y);
    y += 8;

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Expenses: ${fmt(totalExpense)}`, 15, y);
    doc.text(`Per Person Share: ${fmt(perPerson)}`, 105, y);
    y += 8;
    doc.text(`Number of Members: ${profiles.length}`, 15, y);
    doc.text(`Period: ${periodLabel}`, 105, y);
    y += 14;

    // Everyone's balance
    doc.setTextColor(226, 109, 92);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Members' Balance", 15, y);
    y += 8;
    doc.setDrawColor(226, 109, 92);
    doc.line(15, y, 195, y);
    y += 8;

    profiles.forEach((p) => {
      const spent = expenses.filter(e => e.user_id === p.id).reduce((sum, e) => sum + Number(e.total_amount), 0);
      const balance = spent - perPerson;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(50, 50, 50);
      doc.text(p.full_name, 15, y);
      doc.setFont("helvetica", "normal");
      doc.text(`Spent: ${fmt(spent)}`, 80, y);
      doc.text(`Share: ${fmt(perPerson)}`, 130, y);
      const balText = balance >= 0 ? `+${fmt(balance)} (receives)` : `-${fmt(Math.abs(balance))} (pays)`;
      doc.setTextColor(balance >= 0 ? 78 : 226, balance >= 0 ? 135 : 109, balance >= 0 ? 112 : 92);
      doc.text(balText, 15, y + 6);
      doc.setTextColor(50, 50, 50);
      y += 16;
    });

    y += 4;

    // Settlement transactions
    doc.setTextColor(226, 109, 92);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Settlement Transactions", 15, y);
    y += 8;
    doc.setDrawColor(226, 109, 92);
    doc.line(15, y, 195, y);
    y += 8;

    if (history.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "normal");
      doc.text("No settlement transactions recorded.", 15, y);
      y += 10;
    } else {
      history.forEach((h, idx) => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        doc.text(`${idx + 1}. ${h.from_profile?.full_name} → ${h.to_profile?.full_name}`, 15, y);
        doc.setTextColor(78, 135, 112);
        doc.setFont("helvetica", "bold");
        doc.text(fmt(h.amount), 160, y);
        doc.setTextColor(150, 150, 150);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(new Date(h.paid_at).toLocaleDateString(), 15, y + 5);
        y += 14;
      });
    }

    y += 4;

    // Expense details
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setTextColor(226, 109, 92);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Expense Details", 15, y);
    y += 8;
    doc.setDrawColor(226, 109, 92);
    doc.line(15, y, 195, y);
    y += 8;

    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y - 4, 180, 8, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    doc.text("Description", 17, y + 1);
    doc.text("Added By", 90, y + 1);
    doc.text("Date", 130, y + 1);
    doc.text("Amount", 168, y + 1);
    y += 10;

    expenses.forEach((exp, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const addedBy = profiles.find(p => p.id === exp.user_id)?.full_name || "Unknown";
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);

      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(15, y - 4, 180, 8, "F");
      }

      const descText = exp.description || exp.category || "Expense";
      doc.text(descText.length > 30 ? descText.substring(0, 28) + ".." : descText, 17, y + 1);
      doc.text(addedBy, 90, y + 1);
      doc.text(exp.expense_date || "", 130, y + 1);
      doc.setFont("helvetica", "bold");
      doc.text(fmt(exp.total_amount), 168, y + 1);
      y += 9;
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text(`Family Expense Tracker — Page ${i} of ${pageCount}`, 105, 290, { align: "center" });
    }

    doc.save(`settlement-${monthNames[currentMonth - 1]}-${currentYear}.pdf`);
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
                  <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "2rem", textAlign: "center", border: `2px solid ${totalExpense > 0 ? "var(--income)" : "var(--border)"}` }}>
                    <CheckCircle size={48} color="var(--income)" style={{ margin: "0 auto 1rem" }} />
                    <p style={{ color: "var(--income)", fontWeight: "700", fontSize: "1rem" }}>All Settled! 🎉</p>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.5rem", marginBottom: "1.5rem" }}>
                      {totalExpense > 0 ? "Everyone has paid their share." : "No expenses this period."}
                    </p>

                    {totalExpense > 0 && (
                      <button
                        onClick={handleFinalSettle}
                        disabled={clearing}
                        style={{
                          width: "100%", padding: "0.85rem", borderRadius: "0.75rem", border: "none",
                          backgroundColor: clearing ? "var(--text-secondary)" : "var(--accent)",
                          color: "white", fontWeight: "700", fontSize: "0.95rem",
                          cursor: clearing ? "not-allowed" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem"
                        }}>
                        <Download size={18} />
                        {clearing ? "Generating PDF & Clearing..." : "📄 Download Report & Clear All Data"}
                      </button>
                    )}
                  </div>
                ) : (
                  allTransactions.map((t, i) => {
                    const isMe = t.from_id === user?.id;
                    const key = `${t.from_id}-${t.to_id}`;
                    const isPaying = marking === key;
                    const currentInput = getCustomAmount(t);
                    const inputNum = parseFloat(currentInput);
                    const isPartial = !isNaN(inputNum) && inputNum < t.amount - 0.01;

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
                          <div style={{ textAlign: "right" }}>
                            <p style={{ color: isMe ? "var(--expense)" : "var(--text-primary)", fontWeight: "800", fontSize: "1.1rem" }}>
                              {fmt(t.amount)}
                            </p>
                            <p style={{ color: "var(--text-secondary)", fontSize: "0.7rem" }}>total due</p>
                          </div>
                        </div>

                        {isMe && (
                          <div>
                            <div style={{ marginBottom: "0.75rem" }}>
                              <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.4rem" }}>
                                Amount to pay now
                              </p>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem", fontWeight: "600" }}>CA$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  max={t.amount}
                                  value={currentInput}
                                  onChange={(e) => setCustomAmount(t, e.target.value)}
                                  style={{
                                    ...inputStyle,
                                    flex: 1,
                                    fontWeight: "700",
                                    fontSize: "1rem",
                                    color: "var(--text-primary)",
                                    border: `1px solid ${isPartial ? "var(--accent)" : "var(--border)"}`,
                                  }}
                                />
                              </div>
                              {isPartial && (
                                <p style={{ color: "var(--accent)", fontSize: "0.72rem", marginTop: "0.35rem" }}>
                                  ⚡ Partial payment — CA${(t.amount - inputNum).toFixed(2)} will remain
                                </p>
                              )}
                            </div>

                            <button
                              onClick={() => handleMarkPaid(t)}
                              disabled={isPaying}
                              style={{ width: "100%", padding: "0.65rem", borderRadius: "0.75rem", border: "none", backgroundColor: isPaying ? "var(--text-secondary)" : "var(--income)", color: "white", fontWeight: "600", fontSize: "0.875rem", cursor: isPaying ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                              <CheckCircle size={16} />
                              {isPaying ? "Processing..." : isPartial ? `Pay CA$${inputNum.toFixed(2)} Now` : "Mark as Paid"}
                            </button>
                          </div>
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
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "var(--income)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <p style={{ color: "var(--income)", fontWeight: "700" }}>{fmt(h.amount)}</p>
                        {profile?.role === "admin" && (
                          <button onClick={() => handleDeleteHistory(h.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--expense)", padding: "0.25rem" }}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
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

