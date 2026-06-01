"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Upload, ShoppingCart } from "lucide-react";

export default function AddExpense() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shopName, setShopName] = useState("");
  const [category, setCategory] = useState("grocery");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState("manual");
  const [items, setItems] = useState([{ name: "", amount: "" }]);
  const [totalAmount, setTotalAmount] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [message, setMessage] = useState({ text: "", type: "" });
  const fileRef = useRef();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
    };
    init();
  }, []);

  const addItem = () => setItems([...items, { name: "", amount: "" }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => {
    const updated = [...items];
    updated[i][field] = value;
    setItems(updated);
  };

  const manualTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  const handleReceiptUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setReceipt(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!shopName.trim()) { setMessage({ text: "Please enter shop name", type: "error" }); return; }
    const total = mode === "manual" ? manualTotal : parseFloat(totalAmount);
    if (!total || total <= 0) { setMessage({ text: "Please enter valid amount", type: "error" }); return; }

    setLoading(true);
    try {
      let receiptUrl = null;
      if (receipt) {
        const fileName = `${user.id}/${Date.now()}_${receipt.name}`;
        const { data, error } = await supabase.storage.from("receipts").upload(fileName, receipt);
        if (!error) {
          const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(fileName);
          receiptUrl = urlData.publicUrl;
        }
      }

      const expenseData = {
        user_id: user.id,
        shop_name: shopName,
        category,
        expense_date: expenseDate,
        note,
        total_amount: total,
        receipt_url: receiptUrl,
        items: mode === "manual" ? items.filter(i => i.name && i.amount) : null,
      };

      const { error } = await supabase.from("expenses").insert(expenseData);
      if (error) throw error;

      setMessage({ text: "Expense added successfully!", type: "success" });
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (error) {
      setMessage({ text: error.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "0.75rem 1rem", borderRadius: "0.75rem",
    border: "1px solid var(--border)", backgroundColor: "var(--bg-input)",
    color: "var(--text-primary)", fontSize: "0.95rem", outline: "none",
  };

  const labelStyle = {
    display: "block", marginBottom: "0.5rem",
    color: "var(--text-secondary)", fontSize: "0.875rem", fontWeight: "500",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", paddingBottom: "2rem" }}>
      {/* Header */}
      <div style={{ backgroundColor: "var(--bg-card)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", display: "flex", alignItems: "center" }}>
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-primary)" }}>Add Expense</h1>
      </div>

      <div style={{ padding: "1.5rem", maxWidth: "600px", margin: "0 auto" }}>
        {/* Mode Toggle */}
        <div style={{ display: "flex", backgroundColor: "var(--bg-card)", borderRadius: "0.75rem", padding: "4px", marginBottom: "1.5rem", border: "1px solid var(--border)" }}>
          {["manual", "receipt"].map((m) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex: 1, padding: "0.6rem", borderRadius: "0.6rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", transition: "all 0.2s", backgroundColor: mode === m ? "var(--accent)" : "transparent", color: mode === m ? "white" : "var(--text-secondary)" }}>
              {m === "manual" ? "✍️ Manual Entry" : "📷 Receipt Upload"}
            </button>
          ))}
        </div>

        {/* Shop Name */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={labelStyle}>Shop / Location Name *</label>
          <input type="text" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="e.g. Agora, Bazar, Shwapno..." style={inputStyle} />
        </div>

        {/* Category & Date */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              <option value="grocery">🛒 Grocery</option>
              <option value="bill">💡 Bill</option>
              <option value="transport">🚗 Transport</option>
              <option value="medicine">💊 Medicine</option>
              <option value="other">📦 Other</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Manual Mode — Item List */}
        {mode === "manual" && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Items</label>
            {items.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                <input type="text" value={item.name} onChange={(e) => updateItem(i, "name", e.target.value)} placeholder="Item name" style={{ ...inputStyle, flex: 2 }} />
                <input type="number" value={item.amount} onChange={(e) => updateItem(i, "amount", e.target.value)} placeholder="৳" style={{ ...inputStyle, flex: 1 }} />
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--expense)" }}>
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addItem} style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--accent)", background: "none", border: "1px dashed var(--accent)", borderRadius: "0.75rem", padding: "0.6rem 1rem", cursor: "pointer", width: "100%", justifyContent: "center", marginTop: "0.5rem" }}>
              <Plus size={16} /> Add Item
            </button>
            {manualTotal > 0 && (
              <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", backgroundColor: "var(--bg-card)", borderRadius: "0.75rem", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: "600" }}>Total</span>
                <span style={{ color: "var(--accent)", fontWeight: "700", fontSize: "1.1rem" }}>৳{manualTotal.toFixed(0)}</span>
              </div>
            )}
          </div>
        )}

        {/* Receipt Mode */}
        {mode === "receipt" && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Total Amount *</label>
            <input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="Enter total amount" style={{ ...inputStyle, marginBottom: "1rem" }} />
            <label style={labelStyle}>Upload Receipt (optional)</label>
            <div onClick={() => fileRef.current.click()} style={{ border: "2px dashed var(--border)", borderRadius: "0.75rem", padding: "2rem", textAlign: "center", cursor: "pointer", backgroundColor: "var(--bg-card)" }}>
              {receiptPreview ? (
                <img src={receiptPreview} alt="receipt" style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: "0.5rem" }} />
              ) : (
                <div>
                  <Upload size={32} color="var(--text-secondary)" style={{ margin: "0 auto 0.5rem" }} />
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Click to upload receipt image</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleReceiptUpload} style={{ display: "none" }} />
          </div>
        )}

        {/* Note */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={labelStyle}>Note (optional)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any additional notes..." rows={3}
            style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        {message.text && (
          <div style={{ padding: "0.75rem 1rem", borderRadius: "0.75rem", marginBottom: "1rem", backgroundColor: message.type === "error" ? "#FEE2E2" : "#D1FAE5", color: message.type === "error" ? "#DC2626" : "#065F46", fontSize: "0.875rem" }}>
            {message.text}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading}
          style={{ width: "100%", padding: "0.85rem", borderRadius: "0.75rem", border: "none", backgroundColor: loading ? "var(--text-secondary)" : "var(--accent)", color: "white", fontSize: "1rem", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
          <ShoppingCart size={20} />
          {loading ? "Saving..." : "Save Expense"}
        </button>
      </div>
    </div>
  );
}