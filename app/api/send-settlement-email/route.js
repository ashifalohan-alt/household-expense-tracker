import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { payer, recipient, amount, profiles, expenses, totalExpense, perPerson, month, year } = body;

    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const periodLabel = `${monthNames[month - 1]} ${year}`;

    // প্রতিটি user এর email আলাদাভাবে পাঠাবো
    const emailPromises = profiles.map(async (profile) => {
      if (!profile.email) return null;

      const userSpent = expenses
        .filter((e) => e.user_id === profile.id)
        .reduce((sum, e) => sum + Number(e.total_amount), 0);

      const balance = userSpent - perPerson;
      const isReceiving = balance > 0;
      const isPayer = profile.id === payer.id;
      const isRecipient = profile.id === recipient.id;

      let personalNote = "";
      if (isPayer) {
        personalNote = `<p style="background:#1a2a1a;border-left:4px solid #4E8770;padding:12px 16px;border-radius:6px;color:#a8d5b5;margin:16px 0;">
          ✅ <strong>You</strong> just marked a payment of <strong style="color:#4E8770;">CA$${Number(amount).toFixed(2)}</strong> to <strong>${recipient.name}</strong>.
        </p>`;
      } else if (isRecipient) {
        personalNote = `<p style="background:#2a1a1a;border-left:4px solid #E29578;padding:12px 16px;border-radius:6px;color:#d5b5a8;margin:16px 0;">
          💰 <strong>${payer.name}</strong> has marked a payment of <strong style="color:#E29578;">CA$${Number(amount).toFixed(2)}</strong> to you.
        </p>`;
      } else {
        personalNote = `<p style="background:#1a1a2a;border-left:4px solid #E26D5C;padding:12px 16px;border-radius:6px;color:#b5a8d5;margin:16px 0;">
          📢 A settlement payment was just made between <strong>${payer.name}</strong> and <strong>${recipient.name}</strong>.
        </p>`;
      }

      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background-color:#0f1923;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1E252B,#262E35);border-radius:16px 16px 0 0;padding:28px 28px 20px;border:1px solid #374151;border-bottom:none;text-align:center;">
      <p style="margin:0 0 6px;font-size:28px;">🏠</p>
      <h1 style="margin:0;color:#FFFFFF;font-size:20px;font-weight:700;">Family Expense Tracker</h1>
      <p style="margin:6px 0 0;color:#97A3B0;font-size:13px;">Settlement Update · ${periodLabel}</p>
    </div>

    <!-- Body -->
    <div style="background:#1E252B;border:1px solid #374151;border-top:none;border-radius:0 0 16px 16px;padding:24px 28px;">

      <p style="color:#FFFFFF;font-size:16px;margin:0 0 4px;">Hi <strong>${profile.full_name}</strong>,</p>
      <p style="color:#97A3B0;font-size:14px;margin:0 0 20px;">Here's the latest settlement update for ${periodLabel}.</p>

      ${personalNote}

      <!-- Summary Cards -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0;">
        <div style="background:#262E35;border-radius:10px;padding:12px;text-align:center;border:1px solid #374151;">
          <p style="margin:0 0 4px;color:#97A3B0;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Total</p>
          <p style="margin:0;color:#FFFFFF;font-size:15px;font-weight:700;">CA$${Number(totalExpense).toFixed(2)}</p>
        </div>
        <div style="background:#262E35;border-radius:10px;padding:12px;text-align:center;border:1px solid #374151;">
          <p style="margin:0 0 4px;color:#97A3B0;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Per Person</p>
          <p style="margin:0;color:#E26D5C;font-size:15px;font-weight:700;">CA$${Number(perPerson).toFixed(2)}</p>
        </div>
        <div style="background:#262E35;border-radius:10px;padding:12px;text-align:center;border:1px solid #374151;">
          <p style="margin:0 0 4px;color:#97A3B0;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">You Spent</p>
          <p style="margin:0;color:${userSpent >= perPerson ? "#4E8770" : "#E29578"};font-size:15px;font-weight:700;">CA$${Number(userSpent).toFixed(2)}</p>
        </div>
      </div>

      <!-- Personal Balance -->
      <div style="background:#262E35;border-radius:12px;padding:16px;margin:16px 0;border:1px solid ${isReceiving ? "#4E8770" : "#E29578"};">
        <p style="margin:0 0 6px;color:#97A3B0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Your Balance</p>
        <p style="margin:0;color:${isReceiving ? "#4E8770" : "#E29578"};font-size:22px;font-weight:800;">
          ${isReceiving ? "+" : "-"}CA$${Math.abs(balance).toFixed(2)}
        </p>
        <p style="margin:4px 0 0;color:#97A3B0;font-size:13px;">
          ${isReceiving ? "You will receive this amount" : "You need to pay this amount"}
        </p>
      </div>

      <!-- All Members -->
      <div style="margin-top:20px;">
        <p style="color:#97A3B0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px;">All Members</p>
        ${profiles.map((p) => {
          const spent = expenses.filter((e) => e.user_id === p.id).reduce((sum, e) => sum + Number(e.total_amount), 0);
          const bal = spent - perPerson;
          return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #374151;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:32px;height:32px;border-radius:50%;background:#2D3748;display:flex;align-items:center;justify-content:center;color:#E26D5C;font-weight:700;font-size:13px;">${p.full_name?.charAt(0).toUpperCase()}</div>
              <div>
                <p style="margin:0;color:#FFFFFF;font-size:13px;font-weight:600;">${p.full_name}${p.id === profile.id ? " (You)" : ""}</p>
                <p style="margin:0;color:#97A3B0;font-size:11px;">Spent: CA$${Number(spent).toFixed(2)}</p>
              </div>
            </div>
            <p style="margin:0;color:${bal >= 0 ? "#4E8770" : "#E29578"};font-weight:700;font-size:13px;">
              ${bal >= 0 ? "+" : "-"}CA$${Math.abs(bal).toFixed(2)}
            </p>
          </div>`;
        }).join("")}
      </div>

      <!-- Footer -->
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #374151;text-align:center;">
        <a href="https://household-expense-tracker-kappa.vercel.app/settlement"
          style="display:inline-block;background:#E26D5C;color:white;text-decoration:none;padding:10px 24px;border-radius:10px;font-weight:600;font-size:14px;">
          View Settlement →
        </a>
        <p style="color:#374151;font-size:11px;margin:16px 0 0;">Family Expense Tracker · Sent automatically on settlement</p>
      </div>
    </div>
  </div>
</body>
</html>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Family Expense Tracker <onboarding@resend.dev>",
          to: profile.email,
          subject: `💸 Settlement Update — ${periodLabel}`,
          html: htmlBody,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error(`Email failed for ${profile.email}:`, err);
      }

      return res.ok;
    });

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter((r) => r.status === "fulfilled" && r.value === true).length;

    return NextResponse.json({ success: true, sent: successCount });
  } catch (error) {
    console.error("Email API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
