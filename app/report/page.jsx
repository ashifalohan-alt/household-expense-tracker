"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText, TrendingDown, Users, ShoppingCart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const COLORS = ["#E26D5C", "#4E8770", "#E29578", "#97A3B0", "#6B8DD6"];

export default function ReportPage() {
  const router = useRouter();
  const reportRef = useRef();
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [exporting, setExporting] = useState(false);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
      const { data: profs } = await supabase.from("profiles").select("*");
      setProfiles(profs || []);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [selectedMonth, selectedYear]);

  const fetchExpenses = async () => {
    const month = String(selectedMonth + 1).padStart(2, "0");
    const { data: exp } = await supabase
      .from("expenses")
      .select("*, profiles(full_name)")
      .gte("expense_date", `${selectedYear}-${month}-01`)
      .lte("expense_date", `${selectedYear}-${month}-31`)
      .order("expense_date", { ascending: false });
    setExpenses(exp || []);
  };

  const fmt = (amount) => `CA$${Number(amount).toFixed(2)}`;

  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.total_amount), 0);
  const perPerson = profiles.length > 0 ? totalExpense / profiles.length : 0;

  const categoryData = expenses.reduce((acc, e) => {
    const cat = e.category || "other";
    const existing = acc.find(a => a.name === cat);
    if (existing) existing.value += Number(e.total_amount);
    else acc.push({ name: cat, value: Number(e.total_amount) });
    return acc;
  }, []);

  const userSpendData = profiles.map(p => ({
    name: p.full_name?.split(" ")[0],
    spent: expenses.filter(e => e.user_id === p.id).reduce((sum, e) => sum + Number(e.total_amount), 0),
  }));

  const dailyData = expenses.reduce((acc, e) => {
    const day = new Date(e.expense_date).getDate();
    const existing = acc.find(a => a.day === day);
    if (existing) existing.amount += Number(e.total_amount);
    else acc.push({ day, amount: Number(e.total_amount) });
    return acc;
  }, []).sort((a, b) => a.day - b.day);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: "#1E252B" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Family-Expense-Report-${monthNames[selectedMonth]}-${selectedYear}.pdf`);
    } catch (error) {
      alert("Export failed: " + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportImage = async () => {
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: "#1E252B" });
      const link = document.createElement("a");
      link.download = `Family-Expense-Report-${monthNames[selectedMonth]}-${selectedYear}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      alert("Export failed: " + error.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--accent)" }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", paddingBottom: "2rem" }}>
      {/* Header */}
      <div style={{ backgroundColor: "var(--bg-card)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)" }}>
            <ArrowLeft size={22} />
          </button>
          <h1 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-primary)" }}>Monthly Report</h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={handleExportImage} disabled={exporting}
            style={{ padding: "0.5rem 0.75rem", borderRadius: "0.75rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)", cursor: "pointer", fontSize: "0.8rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Download size={14} /> IMG
          </button>
          <button onClick={handleExportPDF} disabled={exporting}
            style={{ padding: "0.5rem 0.75rem", borderRadius: "0.75rem", border: "none", backgroundColor: "var(--accent)", color: "white", cursor: "pointer", fontSize: "0.8rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      <div style={{ padding: "1rem", maxWidth: "700px", margin: "0 auto" }}>
        {/* Month Selector */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", alignItems: "center" }}>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{ flex: 1, padding: "0.75rem 1rem", borderRadius: "0.75rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-card)", color: "var(--text-primary)", fontSize: "0.9rem", outline: "none", cursor: "pointer" }}>
            {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ padding: "0.75rem 1rem", borderRadius: "0.75rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-card)", color: "var(--text-primary)", fontSize: "0.9rem", outline: "none", cursor: "pointer" }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Exportable Report Area */}
        <div ref={reportRef} style={{ backgroundColor: "var(--bg-primary)", padding: "1rem", borderRadius: "1rem" }}>

          {/* Report Header */}
          <div style={{ backgroundColor: "var(--accent)", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1rem", textAlign: "center" }}>
            <h2 style={{ color: "white", fontSize: "1.25rem", fontWeight: "800" }}>
              Family Expense Report
            </h2>
            <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              {monthNames[selectedMonth]} {selectedYear}
            </p>
          </div>

          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
            {[
              { label: "Total Spent", value: fmt(totalExpense), icon: <TrendingDown size={18} />, color: "var(--expense)" },
              { label: "Per Person", value: fmt(perPerson), icon: <Users size={18} />, color: "var(--accent)" },
              { label: "Transactions", value: expenses.length, icon: <ShoppingCart size={18} />, color: "var(--income)" },
            ].map((card, i) => (
              <div key={i} style={{ backgroundColor: "var(--bg-card)", borderRadius: "0.75rem", padding: "0.875rem", border: "1px solid var(--border)", textAlign: "center" }}>
                <div style={{ color: card.color, display: "flex", justifyContent: "center", marginBottom: "0.35rem" }}>{card.icon}</div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.65rem", marginBottom: "0.25rem" }}>{card.label}</p>
                <p style={{ color: card.color, fontSize: "0.95rem", fontWeight: "700" }}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Per Person Breakdown */}
          <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1rem", border: "1px solid var(--border)" }}>
            <h3 style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: "0.95rem", marginBottom: "1rem" }}>👥 Who Spent What</h3>
            {profiles.map((p, i) => {
              const spent = expenses.filter(e => e.user_id === p.id).reduce((sum, e) => sum + Number(e.total_amount), 0);
              const balance = spent - perPerson;
              const pct = totalExpense > 0 ? (spent / totalExpense) * 100 : 0;
              return (
                <div key={i} style={{ marginBottom: i < profiles.length - 1 ? "1rem" : "0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                    <span style={{ color: "var(--text-primary)", fontSize: "0.875rem", fontWeight: "600" }}>{p.full_name}</span>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ color: "var(--text-primary)", fontSize: "0.875rem", fontWeight: "700" }}>{fmt(spent)}</span>
                      <span style={{ color: balance >= 0 ? "var(--income)" : "var(--expense)", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                        ({balance >= 0 ? `+${fmt(balance)}` : `-${fmt(Math.abs(balance))}`})
                      </span>
                    </div>
                  </div>
                  <div style={{ height: "6px", backgroundColor: "var(--bg-input)", borderRadius: "3px" }}>
                    <div style={{ height: "100%", width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length], borderRadius: "3px" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Category Breakdown */}
          {categoryData.length > 0 && (
            <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1rem", border: "1px solid var(--border)" }}>
              <h3 style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: "0.95rem", marginBottom: "1rem" }}>📊 By Category</h3>
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <ResponsiveContainer width="50%" height={150}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" outerRadius={60} dataKey="value">
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(val) => fmt(val)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {categoryData.map((cat, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.35rem 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: COLORS[i % COLORS.length] }} />
                        <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{cat.name}</span>
                      </div>
                      <span style={{ color: "var(--text-primary)", fontSize: "0.8rem", fontWeight: "600" }}>{fmt(cat.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Daily Spending Bar Chart */}
          {dailyData.length > 0 && (
            <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1rem", border: "1px solid var(--border)" }}>
              <h3 style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: "0.95rem", marginBottom: "1rem" }}>📅 Daily Spending</h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={dailyData}>
                  <XAxis dataKey="day" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 11 }} />
                  <Tooltip formatter={(val) => fmt(val)} />
                  <Bar dataKey="amount" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Expense List */}
          <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1.25rem", border: "1px solid var(--border)" }}>
            <h3 style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: "0.95rem", marginBottom: "1rem" }}>🧾 All Transactions</h3>
            {expenses.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "1rem 0", fontSize: "0.875rem" }}>No transactions this month</p>
            ) : (
              expenses.map((exp, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0", borderBottom: i < expenses.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div>
                    <p style={{ color: "var(--text-primary)", fontSize: "0.85rem", fontWeight: "600" }}>{exp.shop_name}</p>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{exp.profiles?.full_name} · {exp.expense_date} · {exp.category}</p>
                  </div>
                  <p style={{ color: "var(--expense)", fontWeight: "700", fontSize: "0.9rem" }}>{fmt(exp.total_amount)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}