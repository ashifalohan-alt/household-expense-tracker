"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Trash2, ShoppingCart, X, Edit2, Upload, Plus } from "lucide-react";

export default function ExpensesPage() {
  const router = useRouter();
  const fileRef = useRef();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Edit form states
  const [editShopName, setEditShopName] = useState("");
  const [editCategory, setEditCategory] = useState("grocery");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editItems, setEditItems] = useState([{ name: "", amount: "" }]);
  const [editMode2, setEditMode2] = useState("manual");
  const [editTotal, setEditTotal] = useState("");
  const [editReceipt, setEditReceipt] = useState(null);
  const [editReceiptPreview, setEditReceiptPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(prof);
      await loadExpenses();
      setLoading(false);
    };
    init();
  }, []);

  const loadExpenses = async () => {
    const { data: exp } = await supabase
      .from("expenses")
      .select("*, profiles(full_name)")
      .order("expense_date", { ascending: false });
    setExpenses(exp || []);
    setFiltered(exp || []);
  };

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
    setEditMode(false);
  };

  const handleClose = () => {
    setSelectedExpense(null);
    setShowReceipt(false);
    setEditMode(false);
  };

  const openEdit = (exp) => {
    setEditShopName(exp.shop_name || "");
    setEditCategory(exp.category || "grocery");
    setEditDate(exp.expense_date || "");
    setEditNote(exp.note || "");
    setEditReceiptPreview(exp.receipt_url || null);
    setEditReceipt(null);

    if (exp.items && exp.items.length > 0) {
      setEditMode2("manual");
      setEditItems(exp.items);
      setEditTotal("");
    } else {
      setEditMode2("receipt");
      setEditItems([{ name: "", amount: "" }]);
      setEditTotal(exp.total_amount || "");
    }
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!editShopName.trim()) return alert("Please enter shop name");
    setSaving(true);
    try {
      let receiptUrl = selectedExpense.receipt_url;

      if (editReceipt) {
        const fileName = `${user.id}/${Date.now()}_${editReceipt.name}`;
        const { error } = await supabase.storage.from("receipts").upload(fileName, editReceipt);
        if (!error) {
          const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(fileName);
          receiptUrl = urlData.publicUrl;
        }
      }

      const total = editMode2 === "manual"
        ? editItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
        : parseFloat(editTotal);

      const { error } = await supabase.from("expenses").update({
        shop_name: editShopName,
        category: editCategory,
        expense_date: editDate,
        note: editNote,
        total_amount: total,
        items: editMode2 === "manual" ? editItems.filter(i => i.name && i.amount) : null,
        receipt_url: receiptUrl,
      }).eq("id", selectedExpense.id);

      if (error) throw error;

      await loadExpenses();
      setEditMode(false);
      setSelectedExpense(null);
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const canEditDelete = (exp) =>
    profile?.role === "admin" || exp.user_id === user?.id;

  const categoryIcon = (cat) => ({ grocery: "🛒", bill: "💡", transport: "🚗", medicine: "💊", other: "📦" }[cat] || "📦");
  const fmt = (amount) => `CA$${Number(amount).toFixed(2)}`;

  const inputStyle = {
    padding: "0.75rem 1rem", borderRadius: "0.75rem",
    border: "1px solid var(--border)", backgroundColor: "var(--bg-input)",
    color: "var(--text-primary)", fontSize: "0.875rem", outline: "none",
    width: "100%",
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
              style={{ ...inputStyle, paddingLeft: "2.5rem" }} />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: "0.75rem 1rem", borderRadius: "0.75rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none", cursor: "pointer" }}>
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
            <div key={exp.id} onClick={() => { setSelectedExpense(exp); setShowReceipt(false); setEditMode(false); }}
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

      {/* Detail / Edit Modal */}
      {selectedExpense && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", gap: "1rem" }}
          onClick={handleClose}>

          {/* Main Modal */}
          <div onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "var(--bg-card)", borderRadius: "1.25rem", padding: "1.5rem", width: "100%", maxWidth: "380px", maxHeight: "85vh", overflowY: "auto", border: "1px solid var(--border)" }}>

            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.3rem" }}>{categoryIcon(selectedExpense.category)}</span>
                <h2 style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: "1rem" }}>
                  {editMode ? "Edit Expense" : selectedExpense.shop_name}
                </h2>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {canEditDelete(selectedExpense) && !editMode && (
                  <>
                    <button onClick={() => openEdit(selectedExpense)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: "0.25rem" }}>
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(selectedExpense.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--expense)", padding: "0.25rem" }}>
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
                <button onClick={handleClose}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: "0.25rem" }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* View Mode */}
            {!editMode && (
              <>
                <div style={{ backgroundColor: "var(--bg-input)", borderRadius: "0.75rem", padding: "1rem", textAlign: "center", marginBottom: "1rem" }}>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.25rem" }}>Total Amount</p>
                  <p style={{ color: "var(--accent)", fontSize: "1.75rem", fontWeight: "800" }}>{fmt(selectedExpense.total_amount)}</p>
                </div>

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

                {selectedExpense.receipt_url && (
                  <div style={{ marginTop: "1rem" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginBottom: "0.5rem", fontWeight: "600" }}>Receipt</p>
                    <img src={selectedExpense.receipt_url} alt="receipt"
                      onClick={(e) => { e.stopPropagation(); setShowReceipt(!showReceipt); }}
                      style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "0.5rem", cursor: "zoom-in", border: "2px solid var(--border)" }} />
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.7rem", marginTop: "0.25rem" }}>Tap to view full size</p>
                  </div>
                )}

                {selectedExpense.note && (
                  <div style={{ marginTop: "1rem", padding: "0.75rem", backgroundColor: "var(--bg-input)", borderRadius: "0.75rem" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.25rem" }}>Note</p>
                    <p style={{ color: "var(--text-primary)", fontSize: "0.85rem" }}>{selectedExpense.note}</p>
                  </div>
                )}
              </>
            )}

            {/* Edit Mode */}
            {editMode && (
              <>
                {/* Mode Toggle */}
                <div style={{ display: "flex", backgroundColor: "var(--bg-input)", borderRadius: "0.75rem", padding: "4px", marginBottom: "1rem" }}>
                  {["manual", "receipt"].map((m) => (
                    <button key={m} onClick={() => setEditMode2(m)}
                      style={{ flex: 1, padding: "0.5rem", borderRadius: "0.6rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.8rem", backgroundColor: editMode2 === m ? "var(--accent)" : "transparent", color: editMode2 === m ? "white" : "var(--text-secondary)" }}>
                      {m === "manual" ? "✍️ Manual" : "📷 Receipt"}
                    </button>
                  ))}
                </div>

                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ display: "block", marginBottom: "0.35rem", color: "var(--text-secondary)", fontSize: "0.8rem" }}>Shop Name *</label>
                  <input type="text" value={editShopName} onChange={(e) => setEditShopName(e.target.value)} style={inputStyle} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "0.35rem", color: "var(--text-secondary)", fontSize: "0.8rem" }}>Category</label>
                    <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={inputStyle}>
                      <option value="grocery">🛒 Grocery</option>
                      <option value="bill">💡 Bill</option>
                      <option value="transport">🚗 Transport</option>
                      <option value="medicine">💊 Medicine</option>
                      <option value="other">📦 Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "0.35rem", color: "var(--text-secondary)", fontSize: "0.8rem" }}>Date</label>
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                {editMode2 === "manual" && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label style={{ display: "block", marginBottom: "0.35rem", color: "var(--text-secondary)", fontSize: "0.8rem" }}>Items</label>
                    {editItems.map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem", alignItems: "center" }}>
                        <input type="text" value={item.name} onChange={(e) => { const u = [...editItems]; u[i].name = e.target.value; setEditItems(u); }} placeholder="Item" style={{ ...inputStyle, flex: 2 }} />
                        <input type="number" value={item.amount} onChange={(e) => { const u = [...editItems]; u[i].amount = e.target.value; setEditItems(u); }} placeholder="CA$" style={{ ...inputStyle, flex: 1 }} />
                        {editItems.length > 1 && (
                          <button onClick={() => setEditItems(editItems.filter((_, idx) => idx !== i))}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--expense)" }}>
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => setEditItems([...editItems, { name: "", amount: "" }])}
                      style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--accent)", background: "none", border: "1px dashed var(--accent)", borderRadius: "0.5rem", padding: "0.4rem 0.75rem", cursor: "pointer", fontSize: "0.8rem", marginTop: "0.4rem" }}>
                      <Plus size={14} /> Add Item
                    </button>
                    {editItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0) > 0 && (
                      <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", backgroundColor: "var(--bg-input)", borderRadius: "0.5rem", display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>Total</span>
                        <span style={{ color: "var(--accent)", fontWeight: "700", fontSize: "0.85rem" }}>
                          {fmt(editItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0))}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {editMode2 === "receipt" && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label style={{ display: "block", marginBottom: "0.35rem", color: "var(--text-secondary)", fontSize: "0.8rem" }}>Total Amount *</label>
                    <input type="number" value={editTotal} onChange={(e) => setEditTotal(e.target.value)} placeholder="CA$" style={{ ...inputStyle, marginBottom: "0.75rem" }} />
                    <label style={{ display: "block", marginBottom: "0.35rem", color: "var(--text-secondary)", fontSize: "0.8rem" }}>Receipt Image</label>
                    <div onClick={() => fileRef.current.click()}
                      style={{ border: "2px dashed var(--border)", borderRadius: "0.75rem", padding: "1rem", textAlign: "center", cursor: "pointer" }}>
                      {editReceiptPreview ? (
                        <img src={editReceiptPreview} alt="receipt" style={{ maxWidth: "100%", maxHeight: "120px", borderRadius: "0.5rem" }} />
                      ) : (
                        <div>
                          <Upload size={24} color="var(--text-secondary)" style={{ margin: "0 auto 0.35rem" }} />
                          <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>Click to upload</p>
                        </div>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*"
                      onChange={(e) => { const f = e.target.files[0]; if (f) { setEditReceipt(f); setEditReceiptPreview(URL.createObjectURL(f)); } }}
                      style={{ display: "none" }} />
                  </div>
                )}

                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", marginBottom: "0.35rem", color: "var(--text-secondary)", fontSize: "0.8rem" }}>Note</label>
                  <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={2}
                    style={{ ...inputStyle, resize: "vertical" }} />
                </div>

                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={() => setEditMode(false)}
                    style={{ flex: 1, padding: "0.75rem", borderRadius: "0.75rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)", fontWeight: "600", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={handleSaveEdit} disabled={saving}
                    style={{ flex: 1, padding: "0.75rem", borderRadius: "0.75rem", border: "none", backgroundColor: saving ? "var(--text-secondary)" : "var(--accent)", color: "white", fontWeight: "600", cursor: saving ? "not-allowed" : "pointer" }}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Receipt Panel */}
          {showReceipt && selectedExpense.receipt_url && (
            <div onClick={(e) => e.stopPropagation()}
              style={{ backgroundColor: "var(--bg-card)", borderRadius: "1.25rem", padding: "1.5rem", width: "100%", maxWidth: "360px", maxHeight: "85vh", overflowY: "auto", border: "1px solid var(--border)", flexShrink: 0 }}>
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