import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";

// ── Constants ──────────────────────────────────────────────────────
const STAGES = [
  { id: "lead",          label: "Lead",          color: "#6B7FD4", bg: "#EEEDFE", text: "#3C3489" },
  { id: "qualification", label: "Qualification", color: "#1D9E75", bg: "#E1F5EE", text: "#085041" },
  { id: "demo",          label: "Demo",          color: "#185FA5", bg: "#E6F1FB", text: "#0C447C" },
  { id: "needs",         label: "Needs Analysis",color: "#BA7517", bg: "#FAEEDA", text: "#633806" },
  { id: "proposal",      label: "Proposal",      color: "#D4537E", bg: "#FBEAF0", text: "#72243E" },
  { id: "negotiation",   label: "Negotiation",   color: "#D85A30", bg: "#FAECE7", text: "#4A1B0C" },
  { id: "closing",       label: "Closing",       color: "#3B6D11", bg: "#EAF3DE", text: "#173404" },
];

const DEFAULT_MSGS = [
  { title: "رسالة ترحيب",    tag: "Lead",     body: "السلام عليكم {اسم}،\nأهلاً وسهلاً بك! أنا من HeroTec.\nسعيد بتواصلك معانا 🙏\nمتى يناسبك نتكلم شوية؟" },
  { title: "متابعة بعد Demo",tag: "Demo",     body: "مرحباً {اسم}،\nإزيك؟ عاوز أتأكد إنك استفدت من العرض.\nعندك أي أسئلة؟ أنا موجود 💪" },
  { title: "إرسال Proposal", tag: "Proposal", body: "أستاذ {اسم}،\nبرفق ليك العرض المالي كما اتفقنا.\nأي تعديل إحنا في الخدمة 📄" },
  { title: "Closing مبروك",  tag: "Closing",  body: "مبروك {اسم}! 🎉\nيسعدنا إننا نكون شركاء نجاحك.\nهنبدأ على طول، متى يناسبك؟" },
];

function stageInfo(id) { return STAGES.find(s => s.id === id) || STAGES[0]; }

function sendWA(phone, body, name) {
  const text = body.replace(/{اسم}/g, name || "");
  const clean = phone.replace(/[^\d+]/g, "");
  const num = clean.startsWith("0") ? "2" + clean.substring(1) : clean;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank");
}

// ── Styles ─────────────────────────────────────────────────────────
const S = {
  inputBase: { width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #ddd", borderRadius: 8, background: "#fafafa", color: "#1a1a1a", fontFamily: "inherit", direction: "rtl", outline: "none" },
  btnPrimary: { padding: "8px 18px", fontSize: 13, fontWeight: 600, background: "#4F5BD5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" },
  btnSecondary: { padding: "8px 18px", fontSize: 13, border: "1px solid #ddd", borderRadius: 8, background: "#fff", color: "#444", cursor: "pointer" },
  btnWA: { display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 12, fontWeight: 600, background: "#25d366", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" },
  card: { background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: "14px 16px" },
};

// ── Shared UI ──────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem", color: "#aaa", flexDirection: "column", gap: 12 }}>
      <div style={{ width: 32, height: 32, border: "3px solid #eee", borderTop: "3px solid #4F5BD5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 13 }}>جاري التحميل...</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Toast({ msg, type }) {
  if (!msg) return null;
  const bg = type === "error" ? "#fee" : "#f0fff8";
  const color = type === "error" ? "#c00" : "#0a6640";
  const border = type === "error" ? "#fcc" : "#b7f0d8";
  return (
    <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: bg, border: `1px solid ${border}`, color, borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 600, zIndex: 999, boxShadow: "0 4px 16px rgba(0,0,0,.1)" }}>
      {msg}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "1.5rem", width: "100%", maxWidth: wide ? 640 : 480, maxHeight: "92vh", overflowY: "auto", direction: "rtl" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#aaa", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, color: "#555", fontWeight: 600, marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

// ── Lead Modal (Add / Edit) ────────────────────────────────────────
function LeadModal({ lead, messages, onSave, onClose, loading }) {
  const isEdit = !!lead?.id;
  const [form, setForm] = useState({
    name: lead?.name || "", phone: lead?.phone || "", job: lead?.job || "",
    stage: lead?.stage || "lead", comment: lead?.comment || "", alert_text: lead?.alert_text || "",
  });
  const [selectedMsg, setSelectedMsg] = useState(() => !isEdit ? (messages.find(m => m.tag === "Lead") || messages[0] || null) : null);
  const [showPicker, setShowPicker] = useState(!isEdit);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function handleSave() {
    if (!form.name.trim() || !form.phone.trim()) { alert("الاسم والهاتف مطلوبين"); return; }
    onSave(form, selectedMsg);
  }

  const preview = selectedMsg ? selectedMsg.body.replace(/{اسم}/g, form.name || "العميل") : "";

  return (
    <Modal title={isEdit ? "تعديل العميل" : "إضافة Lead جديد"} onClose={onClose}>
      <Field label="الاسم"><input style={S.inputBase} value={form.name} onChange={set("name")} placeholder="اسم العميل" /></Field>
      <Field label="رقم الهاتف"><input style={S.inputBase} value={form.phone} onChange={set("phone")} placeholder="01x xxxx xxxx" /></Field>
      <Field label="الوظيفة"><input style={S.inputBase} value={form.job} onChange={set("job")} placeholder="مثال: مدير مبيعات" /></Field>
      {isEdit && (
        <Field label="المرحلة">
          <select style={S.inputBase} value={form.stage} onChange={set("stage")}>
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
      )}
      <Field label="تعليق">
        <textarea style={{ ...S.inputBase, height: 70, resize: "vertical" }} value={form.comment} onChange={set("comment")} placeholder="ملاحظة..." />
      </Field>
      <Field label="تنبيه (اختياري)">
        <input style={S.inputBase} value={form.alert_text} onChange={set("alert_text")} placeholder="مثال: متابعة بكرة الساعة 10" />
      </Field>

      {/* ── Message Picker (new leads only) ── */}
      {!isEdit && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#444", fontWeight: 700 }}>رسالة واتساب عند الحفظ</span>
            <button style={{ fontSize: 11, color: "#4F5BD5", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              onClick={() => setShowPicker(v => !v)}>
              {showPicker ? "إخفاء" : "تغيير الرسالة"}
            </button>
          </div>

          {showPicker && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10, maxHeight: 210, overflowY: "auto" }}>
              {messages.map(m => {
                const sel = selectedMsg?.id === m.id;
                return (
                  <div key={m.id} onClick={() => { setSelectedMsg(m); setShowPicker(false); }}
                    style={{ border: sel ? "2px solid #4F5BD5" : "1px solid #e0e0e0", borderRadius: 10, padding: "9px 12px", cursor: "pointer", background: sel ? "#f0f1ff" : "#fafafa" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: sel ? "#4F5BD5" : "#1a1a1a" }}>{m.title}</span>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: "#E6F1FB", color: "#185FA5", fontWeight: 600 }}>{m.tag}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#777", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                      {m.body.replace(/{اسم}/g, form.name || "العميل").substring(0, 90)}{m.body.length > 90 ? "…" : ""}
                    </div>
                    {sel && <div style={{ marginTop: 4, fontSize: 11, color: "#4F5BD5", fontWeight: 700 }}>✓ محددة</div>}
                  </div>
                );
              })}
              <div onClick={() => { setSelectedMsg(null); setShowPicker(false); }}
                style={{ border: !selectedMsg ? "2px solid #aaa" : "1px solid #e0e0e0", borderRadius: 10, padding: "9px 12px", cursor: "pointer", background: "#fafafa", fontSize: 12, color: "#888", textAlign: "center" }}>
                بدون رسالة واتساب
              </div>
            </div>
          )}

          {selectedMsg && !showPicker && (
            <div style={{ background: "#e9fce9", border: "1px solid #b7f0d8", borderRadius: 10, padding: "10px 13px", marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#0a6640", fontWeight: 700, marginBottom: 5, display: "flex", justifyContent: "space-between" }}>
                <span>📱 معاينة: {selectedMsg.title}</span>
                <button style={{ fontSize: 10, color: "#4F5BD5", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }} onClick={() => setShowPicker(true)}>تغيير</button>
              </div>
              <div style={{ fontSize: 12, color: "#1a4a2a", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{preview}</div>
            </div>
          )}

          {!selectedMsg && !showPicker && (
            <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#7a5c00", marginBottom: 10 }}>
              ⚠️ لن يُرسل واتساب —
              <button style={{ fontSize: 12, color: "#4F5BD5", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginRight: 4 }} onClick={() => setShowPicker(true)}>اختر رسالة</button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
        <button style={S.btnSecondary} onClick={onClose}>إلغاء</button>
        <button style={{ ...S.btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={handleSave} disabled={loading}>
          {loading ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : selectedMsg ? "حفظ وإرسال WhatsApp" : "حفظ بدون WhatsApp"}
        </button>
      </div>
    </Modal>
  );
}

// ── Send WA Modal ──────────────────────────────────────────────────
function SendWAModal({ lead, messages, onClose }) {
  return (
    <Modal title={`إرسال لـ ${lead.name}`} onClose={onClose}>
      <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>اختر رسالة من المكتبة:</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
        {messages.map(m => (
          <div key={m.id} style={{ background: "#f8f9fa", border: "1px solid #eee", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{m.title}</div>
              <div style={{ fontSize: 11, color: "#777", lineHeight: 1.5 }}>{m.body.replace(/{اسم}/g, lead.name).substring(0, 80)}…</div>
            </div>
            <button style={S.btnWA} onClick={() => { sendWA(lead.phone, m.body, lead.name); onClose(); }}>إرسال</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, textAlign: "left" }}>
        <button style={S.btnSecondary} onClick={onClose}>إغلاق</button>
      </div>
    </Modal>
  );
}

// ── Message Modal ──────────────────────────────────────────────────
function MsgModal({ msg, onSave, onClose, loading }) {
  const [form, setForm] = useState({ title: msg?.title || "", tag: msg?.tag || "Lead", body: msg?.body || "" });
  const [preview, setPreview] = useState("");
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title={msg?.id ? "تعديل الرسالة" : "رسالة جديدة"} onClose={onClose}>
      <Field label="عنوان الرسالة"><input style={S.inputBase} value={form.title} onChange={set("title")} placeholder="مثال: رسالة ترحيب" /></Field>
      <Field label="التصنيف">
        <select style={S.inputBase} value={form.tag} onChange={set("tag")}>
          {["Lead","Qualification","Demo","Needs Analysis","Proposal","Negotiation","Closing","عام"].map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="نص الرسالة — استخدم {اسم} لاسم العميل">
        <textarea style={{ ...S.inputBase, height: 110, resize: "vertical" }} value={form.body} onChange={set("body")} placeholder="مرحباً {اسم}، ..." />
      </Field>
      {preview && (
        <div style={{ background: "#e9fce9", borderRadius: 10, padding: 12, fontSize: 12, color: "#1a3a1a", marginBottom: 10, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{preview}</div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={S.btnSecondary} onClick={() => setPreview(form.body.replace(/{اسم}/g, "أحمد"))}>معاينة</button>
        <button style={S.btnSecondary} onClick={onClose}>إلغاء</button>
        <button style={{ ...S.btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={() => onSave(form)} disabled={loading}>
          {loading ? "جاري الحفظ..." : "حفظ"}
        </button>
      </div>
    </Modal>
  );
}

// ── History Modal ──────────────────────────────────────────────────
function HistoryModal({ lead, history, onClose }) {
  return (
    <Modal title={`تاريخ ${lead.name}`} onClose={onClose}>
      {history.length === 0 ? (
        <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "1rem" }}>لا يوجد تاريخ بعد</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {history.map((h, i) => {
            const si = stageInfo(h.stage);
            return (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: si.color, marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: si.color }}>{si.label}</span>
                    <span style={{ fontSize: 11, color: "#aaa" }}>{h.created_at ? new Date(h.created_at).toLocaleDateString("ar-EG") : ""}</span>
                  </div>
                  {h.comment && <div style={{ fontSize: 12, color: "#555" }}>{h.comment}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ marginTop: 12, textAlign: "left" }}>
        <button style={S.btnSecondary} onClick={onClose}>إغلاق</button>
      </div>
    </Modal>
  );
}

// ── Kanban ─────────────────────────────────────────────────────────
function KanbanView({ leads, onEdit, onDelete, onWA, onHistory }) {
  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <div style={{ display: "flex", gap: 10, minWidth: 1000 }}>
        {STAGES.map(s => {
          const cards = leads.filter(l => l.stage === s.id);
          return (
            <div key={s.id} style={{ flex: "0 0 142px", background: "#f8f8f8", border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: s.color, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {s.label}
                <span style={{ fontSize: 10, background: s.bg, color: s.text, padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>{cards.length}</span>
              </div>
              {cards.map(l => (
                <div key={l.id} onClick={() => onEdit(l)}
                  style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 9, padding: "8px 9px", marginBottom: 8, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = s.color}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#e8e8e8"}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{l.name}</div>
                  {l.job && <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>{l.job}</div>}
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    <button style={{ ...S.btnWA, padding: "3px 8px", fontSize: 11 }} onClick={e => { e.stopPropagation(); onWA(l); }}>WA</button>
                    <button style={{ ...S.btnSecondary, padding: "3px 7px", fontSize: 11 }} onClick={e => { e.stopPropagation(); window.open("tel:" + l.phone); }}>📞</button>
                    <button style={{ ...S.btnSecondary, padding: "3px 7px", fontSize: 11 }} onClick={e => { e.stopPropagation(); onHistory(l); }}>📋</button>
                    <button style={{ ...S.btnSecondary, padding: "3px 7px", fontSize: 11, color: "#c00" }} onClick={e => { e.stopPropagation(); if (confirm("حذف؟")) onDelete(l.id); }}>🗑</button>
                  </div>
                  {l.comment && <div style={{ fontSize: 10, color: "#999", marginTop: 5, paddingTop: 4, borderTop: "1px solid #f0f0f0", fontStyle: "italic" }}>{l.comment.substring(0, 55)}{l.comment.length > 55 ? "…" : ""}</div>}
                  {l.alert_text && <div style={{ fontSize: 10, color: "#c07000", marginTop: 3 }}>🔔 {l.alert_text}</div>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Table ──────────────────────────────────────────────────────────
function TableView({ leads, onEdit, onDelete, onWA, onHistory }) {
  const [q, setQ] = useState("");
  const [stg, setStg] = useState("");
  const filtered = leads.filter(l => {
    const mq = !q || l.name.includes(q) || l.phone.includes(q) || (l.job||"").includes(q);
    return mq && (!stg || l.stage === stg);
  });
  const th = { padding: "8px 12px", textAlign: "right", fontSize: 12, color: "#666", fontWeight: 700, borderBottom: "2px solid #eee" };
  const td = { padding: "9px 12px", fontSize: 13, color: "#1a1a1a", borderBottom: "1px solid #f0f0f0", verticalAlign: "middle" };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...S.inputBase, flex: 1, minWidth: 160, height: 36 }} value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث باسم أو رقم أو وظيفة..." />
        <select style={{ ...S.inputBase, width: "auto", height: 36 }} value={stg} onChange={e => setStg(e.target.value)}>
          <option value="">كل المراحل</option>
          {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead><tr>{["الاسم","الهاتف","الوظيفة","المرحلة","تعليق","تنبيه","إجراءات"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#ccc", padding: "2.5rem" }}>لا توجد نتائج</td></tr>}
            {filtered.map(l => {
              const si = stageInfo(l.stage);
              return (
                <tr key={l.id} onMouseEnter={e => e.currentTarget.style.background = "#fafafa"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ ...td, fontWeight: 700 }}>{l.name}</td>
                  <td style={{ ...td, direction: "ltr", textAlign: "right" }}>{l.phone}</td>
                  <td style={{ ...td, color: "#666" }}>{l.job || "—"}</td>
                  <td style={td}><span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 12, fontWeight: 700, background: si.bg, color: si.text }}>{si.label}</span></td>
                  <td style={{ ...td, fontSize: 12, color: "#888" }}>{l.comment ? l.comment.substring(0, 40) + "…" : "—"}</td>
                  <td style={{ ...td, fontSize: 12, color: "#b07800" }}>{l.alert_text || "—"}</td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button style={{ ...S.btnSecondary, padding: "4px 9px", fontSize: 12 }} onClick={() => onEdit(l)}>تعديل</button>
                      <button style={{ ...S.btnWA, padding: "4px 9px", fontSize: 12 }} onClick={() => onWA(l)}>WA</button>
                      <button style={{ ...S.btnSecondary, padding: "4px 9px", fontSize: 12 }} onClick={() => window.open("tel:" + l.phone)}>📞</button>
                      <button style={{ ...S.btnSecondary, padding: "4px 9px", fontSize: 12 }} onClick={() => onHistory(l)}>📋</button>
                      <button style={{ ...S.btnSecondary, padding: "4px 9px", fontSize: 12, color: "#c00" }} onClick={() => { if (confirm("حذف؟")) onDelete(l.id); }}>🗑</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Messages Library ───────────────────────────────────────────────
function MsgsView({ messages, onAdd, onEdit, onDelete }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button style={S.btnPrimary} onClick={onAdd}>+ رسالة جديدة</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {messages.map(m => (
          <div key={m.id} style={S.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{m.title}</span>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#E6F1FB", color: "#185FA5", fontWeight: 700 }}>{m.tag}</span>
            </div>
            <div style={{ fontSize: 12, color: "#666", lineHeight: 1.7, marginBottom: 10, whiteSpace: "pre-wrap", minHeight: 56 }}>
              {m.body.length > 110 ? m.body.substring(0, 110) + "…" : m.body}
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
              <button style={{ ...S.btnSecondary, padding: "4px 10px", fontSize: 12 }} onClick={() => onEdit(m)}>تعديل</button>
              <button style={{ ...S.btnSecondary, padding: "4px 10px", fontSize: 12, color: "#c00" }} onClick={() => { if (confirm("حذف؟")) onDelete(m.id); }}>حذف</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stats Bar ──────────────────────────────────────────────────────
function StatsBar({ leads, messages }) {
  const stats = [
    { label: "إجمالي Leads",   val: leads.length,                                      color: "#4F5BD5" },
    { label: "Closing",         val: leads.filter(l => l.stage === "closing").length,   color: "#3B6D11" },
    { label: "تنبيهات نشطة",  val: leads.filter(l => l.alert_text?.trim()).length,     color: "#BA7517" },
    { label: "رسائل المكتبة", val: messages.length,                                    color: "#D4537E" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
      {stats.map(s => (
        <div key={s.label} style={{ ...S.card, padding: "12px 16px" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────
export default function App() {
  const [leads,    setLeads]    = useState([]);
  const [messages, setMessages] = useState([]);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState(null);
  const [tab,      setTab]      = useState("kanban");
  const [modal,    setModal]    = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Fetch all data ────────────────────────────────────────────────
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const [{ data: lData }, { data: mData }, { data: hData }] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("messages").select("*").order("created_at", { ascending: true }),
        supabase.from("lead_history").select("*").order("created_at", { ascending: true }),
      ]);
      setLeads(lData || []);
      // seed default messages if empty
      if (!mData || mData.length === 0) {
        const { data: seeded } = await supabase.from("messages").insert(DEFAULT_MSGS).select();
        setMessages(seeded || []);
      } else {
        setMessages(mData);
      }
      setHistory(hData || []);
      setLoading(false);
    }
    fetchAll();
  }, []);

  // ── Lead CRUD ─────────────────────────────────────────────────────
  const saveLead = useCallback(async (form, selectedMsg) => {
    setSaving(true);
    const editingLead = modal?.data;
    if (editingLead?.id) {
      // update
      const stageChanged = form.stage !== editingLead.stage;
      const { data, error } = await supabase.from("leads").update({ ...form, updated_at: new Date().toISOString() }).eq("id", editingLead.id).select().single();
      if (error) { showToast("خطأ في الحفظ", "error"); setSaving(false); return; }
      setLeads(prev => prev.map(l => l.id === data.id ? data : l));
      if (stageChanged) {
        const { data: h } = await supabase.from("lead_history").insert({ lead_id: data.id, stage: form.stage, comment: form.comment }).select().single();
        if (h) setHistory(prev => [...prev, h]);
      }
      showToast("تم الحفظ ✓");
    } else {
      // insert
      const { data, error } = await supabase.from("leads").insert({ ...form, stage: "lead" }).select().single();
      if (error) { showToast("خطأ في الإضافة", "error"); setSaving(false); return; }
      setLeads(prev => [data, ...prev]);
      await supabase.from("lead_history").insert({ lead_id: data.id, stage: "lead", comment: form.comment });
      if (selectedMsg) sendWA(form.phone, selectedMsg.body, form.name);
      showToast("تمت الإضافة وفُتح واتساب ✓");
    }
    setSaving(false);
    setModal(null);
  }, [modal, showToast]);

  const deleteLead = useCallback(async (id) => {
    await supabase.from("lead_history").delete().eq("lead_id", id);
    await supabase.from("leads").delete().eq("id", id);
    setLeads(prev => prev.filter(l => l.id !== id));
    setHistory(prev => prev.filter(h => h.lead_id !== id));
    showToast("تم الحذف");
  }, [showToast]);

  // ── Message CRUD ──────────────────────────────────────────────────
  const saveMsg = useCallback(async (form) => {
    if (!form.title.trim() || !form.body.trim()) { alert("العنوان والنص مطلوبين"); return; }
    setSaving(true);
    const editingMsg = modal?.data;
    if (editingMsg?.id) {
      const { data, error } = await supabase.from("messages").update(form).eq("id", editingMsg.id).select().single();
      if (error) { showToast("خطأ في الحفظ", "error"); setSaving(false); return; }
      setMessages(prev => prev.map(m => m.id === data.id ? data : m));
    } else {
      const { data, error } = await supabase.from("messages").insert(form).select().single();
      if (error) { showToast("خطأ في الإضافة", "error"); setSaving(false); return; }
      setMessages(prev => [...prev, data]);
    }
    setSaving(false);
    setModal(null);
    showToast("تم الحفظ ✓");
  }, [modal, showToast]);

  const deleteMsg = useCallback(async (id) => {
    await supabase.from("messages").delete().eq("id", id);
    setMessages(prev => prev.filter(m => m.id !== id));
    showToast("تم الحذف");
  }, [showToast]);

  const TABS = [{ id: "kanban", label: "Kanban Board" }, { id: "table", label: "جدول" }, { id: "msgs", label: "مكتبة الرسائل" }];

  const leadHistory = modal?.data?.id ? history.filter(h => h.lead_id === modal.data.id) : [];

  return (
    <div dir="rtl" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", background: "#f5f5f7", minHeight: "100vh", paddingBottom: "2rem" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#1a1a1a" }}>Sales CRM</span>
          <span style={{ fontSize: 12, color: "#aaa" }}>بواسطة HeroTec</span>
        </div>
        <button style={S.btnPrimary} onClick={() => setModal({ type: "add-lead" })}>+ إضافة Lead</button>
      </div>

      <div style={{ padding: "0 24px" }}>
        {loading ? <Spinner /> : (
          <>
            <StatsBar leads={leads} messages={messages} />
            <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "#efefef", borderRadius: 10, padding: 4, width: "fit-content" }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ padding: "7px 18px", fontSize: 13, fontWeight: tab === t.id ? 700 : 500, borderRadius: 8, border: "none", cursor: "pointer", background: tab === t.id ? "#fff" : "transparent", color: tab === t.id ? "#1a1a1a" : "#666", boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,.08)" : "none" }}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === "kanban" && <KanbanView leads={leads} onEdit={l => setModal({ type: "edit-lead", data: l })} onDelete={deleteLead} onWA={l => setModal({ type: "send-wa", data: l })} onHistory={l => setModal({ type: "history", data: l })} />}
            {tab === "table"  && <TableView  leads={leads} onEdit={l => setModal({ type: "edit-lead", data: l })} onDelete={deleteLead} onWA={l => setModal({ type: "send-wa", data: l })} onHistory={l => setModal({ type: "history", data: l })} />}
            {tab === "msgs"   && <MsgsView messages={messages} onAdd={() => setModal({ type: "add-msg" })} onEdit={m => setModal({ type: "edit-msg", data: m })} onDelete={deleteMsg} />}
          </>
        )}
      </div>

      {/* Modals */}
      {(modal?.type === "add-lead" || modal?.type === "edit-lead") && (
        <LeadModal lead={modal.data} messages={messages} onSave={saveLead} onClose={() => setModal(null)} loading={saving} />
      )}
      {modal?.type === "send-wa" && (
        <SendWAModal lead={modal.data} messages={messages} onClose={() => setModal(null)} />
      )}
      {(modal?.type === "add-msg" || modal?.type === "edit-msg") && (
        <MsgModal msg={modal.data} onSave={saveMsg} onClose={() => setModal(null)} loading={saving} />
      )}
      {modal?.type === "history" && (
        <HistoryModal lead={modal.data} history={leadHistory} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
