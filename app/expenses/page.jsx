"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Trash2, ShoppingCart, X } from "lucide-react";

export default function ExpensesPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(prof);
      const { data: exp } = await supabase
        .from("expenses")
        .select("*, profiles(full_name)")
        .order("expense_date", { ascending: false });
      setExpenses(exp || []);
      setFiltered(exp || []);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    let result = expenses;
    if (search) result = result.filter(e =>
      e.shop_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())
    );
    if (categoryFilter !== "all") result = result.filter(e => e.category === categoryFilter);
    setFiltered(result);
  }, [search, categoryFilter, expenses]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this expense?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses(expenses.filter(e => e.id !== id));
    setSelectedExpense(null);
    setShowReceipt(false);
  };

  const handleClose = () => {
    setSelectedExpense(null);
    setShowReceipt(false);
  };

  const categoryIcon = (cat) => ({ grocery: "🛒", bill: "💡", transport: "🚗", medicine: "💊", other: "📦" }[cat] || "📦");
  const fmt = (amount) => `CA$${Number(amount).toFixed(2)}`;

  const inputStyle = {
    padding: "0.75rem 1rem", borderRadius: "0.75rem",
    border: "1px solid var(--border)", backgroundColor: "var(--bg-input)",
    color: "var(--text-primary)", fontSize: "0.875rem", outline: "none",
  };

  const modalStyle = {
    backgroundColor: "var(--bg-card)",
    borderRadius: "1.25rem",
    padding: "1.5rem",
    width: "100%",
    maxWidth: "360px",
    maxHeight: "85vh",
    overflowY: "auto",
    border: "1px solid var(--border)",
    flexShrink: 0,
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--accent)" }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", paddingBottom: "2rem" }}>
      {/* Header */}
      <div style={{ backgroundColor: "var(--bg-card)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)" }}>
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-primary)" }}>All Expenses</h1>
      </div>

      <div style={{ padding: "1rem", maxWidth: "600px", margin: "0 auto" }}>
        {/* Search & Filter */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
              style={{ ...inputStyle, width: "100%", paddingLeft: "2.5rem" }} />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="all">All</option>
            <option value="grocery">🛒 Grocery</option>
            <option value="bill">💡 Bill</option>
            <option value="transport">🚗 Transport</option>
            <option value="medicine">💊 Medicine</option>
            <option value="other">📦 Other</option>
          </select>
        </div>

        {/* Expenses List */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-secondary)" }}>
            <ShoppingCart size={48} style={{ margin: "0 auto 1rem", opacity: 0.3 }} />
            <p>No expenses found</p>
          </div>
        ) : (
          filtered.map((exp) => (
            <div key={exp.id} onClick={() => { setSelectedExpense(exp); setShowReceipt(false); }}
              style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1rem", marginBottom: "0.75rem", border: "1px solid var(--border)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "0.75rem", backgroundColor: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
                  {categoryIcon(exp.category)}
                </div>
                <div>
                  <p style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.9rem" }}>{exp.shop_name}</p>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                    {exp.profiles?.full_name} · {exp.expense_date}
                  </p>
                </div>
              </div>
              <p style={{ color: "var(--expense)", fontWeight: "700", fontSize: "0.95rem", flexShrink: 0 }}>
                {fmt(exp.total_amount)}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Modals Overlay */}
      {selectedExpense && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", gap: "1rem" }}
          onClick={handleClose}>

          {/* Detail Modal */}
          <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.3rem" }}>{categoryIcon(selectedExpense.category)}</span>
                <h2 style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: "1rem" }}>
                  {selectedExpense.shop_name}
                </h2>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {(profile?.role === "admin" || selectedExpense.user_id === user?.id) && (
                  <button onClick={() => handleDelete(selectedExpense.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--expense)", padding: "0.25rem" }}>
                    <Trash2 size={18} />
                  </button>
                )}
                <button onClick={handleClose}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: "0.25rem" }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Total */}
            <div style={{ backgroundColor: "var(--bg-input)", borderRadius: "0.75rem", padding: "1rem", textAlign: "center", marginBottom: "1rem" }}>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.25rem" }}>Total Amount</p>
              <p style={{ color: "var(--accent)", fontSize: "1.75rem", fontWeight: "800" }}>{fmt(selectedExpense.total_amount)}</p>
            </div>

            {/* Details */}
            {[
              { label: "Added by", value: selectedExpense.profiles?.full_name },
              { label: "Date", value: selectedExpense.expense_date },
              { label: "Category", value: selectedExpense.category },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{row.label}</span>
                <span style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.85rem" }}>{row.value}</span>
              </div>
            ))}

            {/* Items */}
            {selectedExpense.items && selectedExpense.items.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginBottom: "0.5rem", fontWeight: "600" }}>Items</p>
                {selectedExpense.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--text-primary)", fontSize: "0.85rem" }}>{item.name}</span>
                    <span style={{ color: "var(--accent)", fontSize: "0.85rem", fontWeight: "600" }}>{fmt(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Receipt Button */}
            {selectedExpense.receipt_url && (
              <button onClick={(e) => { e.stopPropagation(); setShowReceipt(!showReceipt); }}
                style={{ marginTop: "1rem", width: "100%", padding: "0.65rem", borderRadius: "0.75rem", border: "1px solid var(--border)", backgroundColor: showReceipt ? "var(--accent)" : "var(--bg-input)", color: showReceipt ? "white" : "var(--text-primary)", cursor: "pointer", fontWeight: "600", fontSize: "0.85rem" }}>
                {showReceipt ? "Hide Receipt" : "📷 View Receipt"}
              </button>
            )}

            {/* Note */}
            {selectedExpense.note && (
              <div style={{ marginTop: "1rem", padding: "0.75rem", backgroundColor: "var(--bg-input)", borderRadius: "0.75rem" }}>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.25rem" }}>Note</p>
                <p style={{ color: "var(--text-primary)", fontSize: "0.85rem" }}>{selectedExpense.note}</p>
              </div>
            )}
          </div>

          {/* Receipt Panel — পাশে খুলবে */}
          {showReceipt && selectedExpense.receipt_url && (
            <div onClick={(e) => e.stopPropagation()} style={{ ...modalStyle, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: "1rem" }}>📷 Receipt</h3>
                <button onClick={() => setShowReceipt(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}>
                  <X size={18} />
                </button>
              </div>
              <img src={selectedExpense.receipt_url} alt="receipt"
                onClick={() => window.open(selectedExpense.receipt_url, "_blank")}
                style={{ width: "100%", borderRadius: "0.75rem", objectFit: "contain", maxHeight: "65vh", cursor: "zoom-in" }} />
              <p style={{ color: "var(--text-secondary)", fontSize: "0.7rem", textAlign: "center", marginTop: "0.5rem" }}>
                Click image to open full size
              </p>  
            </div>
          )}
        </div>
      )}
    </div>
  );
}