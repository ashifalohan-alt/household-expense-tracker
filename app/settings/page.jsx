"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, User, Moon, Sun, Shield, Users,
  CheckCircle, XCircle, LogOut, ChevronRight
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("main");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [approving, setApproving] = useState(null);

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
      setFullName(prof?.full_name || "");

      if (prof?.role === "admin") {
        const { data: users } = await supabase.from("profiles").select("*").order("created_at");
        setAllUsers(users || []);
      }

      setLoading(false);
    };
    init();
  }, []);

  const handleUpdateName = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    if (error) setMessage({ text: "Failed to update name", type: "error" });
    else setMessage({ text: "Name updated successfully!", type: "success" });
    setSaving(false);
    setTimeout(() => setMessage({ text: "", type: "" }), 3000);
  };

  const handleApproveUser = async (userId) => {
    setApproving(userId);
    try {
      const res = await fetch("/api/approve-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, approve: true }),
      });
      const data = await res.json();
      if (data.success) {
        setAllUsers(allUsers.map(u => u.id === userId ? { ...u, is_approved: true } : u));
      } else {
        alert("Failed to approve user: " + data.error);
      }
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setApproving(null);
    }
  };

  const handleRemoveUser = async (userId) => {
    if (!confirm("Remove this user?")) return;
    setApproving(userId);
    try {
      const res = await fetch("/api/approve-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, approve: false }),
      });
      const data = await res.json();
      if (data.success) {
        setAllUsers(allUsers.map(u => u.id === userId ? { ...u, is_approved: false } : u));
      } else {
        alert("Failed to remove user: " + data.error);
      }
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setApproving(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const inputStyle = {
    width: "100%", padding: "0.75rem 1rem", borderRadius: "0.75rem",
    border: "1px solid var(--border)", backgroundColor: "var(--bg-input)",
    color: "var(--text-primary)", fontSize: "0.95rem", outline: "none",
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--accent)" }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", paddingBottom: "2rem" }}>
      <div style={{ backgroundColor: "var(--bg-card)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={() => activeSection === "main" ? router.back() : setActiveSection("main")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)" }}>
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-primary)" }}>
          {activeSection === "main" ? "Settings" : activeSection === "profile" ? "Edit Profile" : activeSection === "users" ? "Manage Users" : "Settings"}
        </h1>
      </div>

      <div style={{ padding: "1rem", maxWidth: "600px", margin: "0 auto" }}>

        {activeSection === "main" && (
          <>
            <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1rem", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", backgroundColor: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: "700", color: "white", flexShrink: 0 }}>
                {profile?.full_name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: "1rem" }}>{profile?.full_name}</p>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{user?.email}</p>
                <span style={{ display: "inline-block", marginTop: "0.25rem", padding: "0.2rem 0.6rem", borderRadius: "1rem", backgroundColor: profile?.role === "admin" ? "var(--accent)" : "var(--bg-input)", color: profile?.role === "admin" ? "white" : "var(--text-secondary)", fontSize: "0.7rem", fontWeight: "700" }}>
                  {profile?.role === "admin" ? "👑 Admin" : "Member"}
                </span>
              </div>
            </div>

            {[
              { icon: <User size={20} />, label: "Edit Profile", sub: "Update your name", section: "profile" },
              { icon: darkMode ? <Sun size={20} /> : <Moon size={20} />, label: "Theme", sub: darkMode ? "Dark mode" : "Light mode", action: () => setDarkMode(!darkMode) },
              ...(profile?.role === "admin" ? [{ icon: <Users size={20} />, label: "Manage Users", sub: "Approve or remove members", section: "users" }] : []),
            ].map((item, i) => (
              <button key={i}
                onClick={() => item.action ? item.action() : setActiveSection(item.section)}
                style={{ width: "100%", backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1rem 1.25rem", marginBottom: "0.75rem", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", gap: "1rem", textAlign: "left" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "0.75rem", backgroundColor: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.9rem" }}>{item.label}</p>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{item.sub}</p>
                </div>
                <ChevronRight size={18} color="var(--text-secondary)" />
              </button>
            ))}

            <button onClick={handleLogout}
              style={{ width: "100%", backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1rem 1.25rem", border: "1px solid var(--expense)", cursor: "pointer", display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "0.75rem", backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <LogOut size={20} color="var(--expense)" />
              </div>
              <p style={{ color: "var(--expense)", fontWeight: "600", fontSize: "0.9rem" }}>Logout</p>
            </button>

            <div style={{ textAlign: "center", marginTop: "2rem" }}>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>Family Expense Tracker v1.0</p>
            </div>
          </>
        )}

        {activeSection === "profile" && (
          <div style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1.5rem", border: "1px solid var(--border)" }}>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.875rem", fontWeight: "500" }}>Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.875rem", fontWeight: "500" }}>Email Address</label>
              <input type="email" value={user?.email} disabled style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }} />
              <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "0.35rem" }}>Email cannot be changed</p>
            </div>
            {message.text && (
              <div style={{ padding: "0.75rem 1rem", borderRadius: "0.75rem", marginBottom: "1rem", backgroundColor: message.type === "error" ? "#FEE2E2" : "#D1FAE5", color: message.type === "error" ? "#DC2626" : "#065F46", fontSize: "0.875rem" }}>
                {message.text}
              </div>
            )}
            <button onClick={handleUpdateName} disabled={saving}
              style={{ width: "100%", padding: "0.85rem", borderRadius: "0.75rem", border: "none", backgroundColor: saving ? "var(--text-secondary)" : "var(--accent)", color: "white", fontSize: "1rem", fontWeight: "600", cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}

        {activeSection === "users" && profile?.role === "admin" && (
          <div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
              {allUsers.filter(u => !u.is_approved).length} pending approval
            </p>
            {allUsers.map((u, i) => (
              <div key={i} style={{ backgroundColor: "var(--bg-card)", borderRadius: "1rem", padding: "1rem 1.25rem", marginBottom: "0.75rem", border: `1px solid ${!u.is_approved ? "var(--expense)" : "var(--border)"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: u.is_approved ? "var(--income)" : "var(--expense)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", color: "white" }}>
                      {u.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.875rem" }}>
                        {u.full_name}
                        {u.role === "admin" && <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", color: "var(--accent)" }}>👑 Admin</span>}
                      </p>
                      <p style={{ color: u.is_approved ? "var(--income)" : "var(--expense)", fontSize: "0.75rem", fontWeight: "600" }}>
                        {u.is_approved ? "✓ Approved" : "⏳ Pending"}
                      </p>
                    </div>
                  </div>

                  {u.role !== "admin" && (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {!u.is_approved && (
                        <button onClick={() => handleApproveUser(u.id)} disabled={approving === u.id}
                          style={{ padding: "0.5rem", borderRadius: "0.5rem", border: "none", backgroundColor: approving === u.id ? "var(--text-secondary)" : "var(--income)", cursor: approving === u.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center" }}>
                          <CheckCircle size={18} color="white" />
                        </button>
                      )}
                      {u.is_approved && (
                        <button onClick={() => handleRemoveUser(u.id)} disabled={approving === u.id}
                          style={{ padding: "0.5rem", borderRadius: "0.5rem", border: "none", backgroundColor: approving === u.id ? "var(--text-secondary)" : "var(--expense)", cursor: approving === u.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center" }}>
                          <XCircle size={18} color="white" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
