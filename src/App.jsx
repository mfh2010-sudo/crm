import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "./supabase.js";

const STAGES = [
  { id: "lead",          label: "Lead",          color: "#6B7FD4", bg: "#EEEDFE", text: "#3C3489" },
  { id: "qualification", label: "Qualification", color: "#1D9E75", bg: "#E1F5EE", text: "#085041" },
  { id: "demo",          label: "Demo",          color: "#185FA5", bg: "#E6F1FB", text: "#0C447C" },
  { id: "needs",         label: "Needs Analysis",color: "#BA7517", bg: "#FAEEDA", text: "#633806" },
  { id: "proposal",      label: "Proposal",      color: "#D4537E", bg: "#FBEAF0", text: "#72243E" },
  { id: "negotiation",   label: "Negotiation",   color: "#D85A30", bg: "#FAECE7", text: "#4A1B0C" },
  { id: "closing",       label: "Closing",       color: "#3B6D11", bg: "#EAF3DE", text: "#173404" },
];

const PROJECT_COLORS = ["#D4537E","#1D9E75","#BA7517","#185FA5","#6B7FD4","#D85A30","#3B6D11","#8B5CF6","#0891B2","#DC2626"];

function stageInfo(id) { return STAGES.find(s => s.id === id) || STAGES[0]; }

function todayStr() { return new Date().toISOString().split("T")[0]; }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; }
function endOfWeekStr() { const d = new Date(); d.setDate(d.getDate() + (7 - d.getDay())); return d.toISOString().split("T")[0]; }

function alertLabel(dateStr) {
  if (!dateStr) return null;
  const today = todayStr();
  const tmrw = tomorrowStr();
  if (dateStr < today) return { text: "متأخر", color: "#DC2626", bg: "#FEE2E2" };
  if (dateStr === today) return { text: "اليوم", color: "#D97706", bg: "#FEF3C7" };
  if (dateStr === tmrw) return { text: "غداً", color: "#2563EB", bg: "#DBEAFE" };
  return { text: new Date(dateStr).toLocaleDateString("ar-EG", { day: "numeric", month: "short" }), color: "#555", bg: "#f0f0f0" };
}

function sortByAlert(a, b) {
  const da = a.alert_date || "9999-12-31";
  const db = b.alert_date || "9999-12-31";
  if (da < db) return -1;
  if (da > db) return 1;
  return 0;
}

function buildMessage(body, lead) {
  const nick = (lead?.nickname || "").trim();
  const greeting = nick ? `مرحبا ${nick}` : "مرحبا";
  const cleaned = (body || "").replace(/{اسم}/g, nick);
  return `${greeting}\n\n${cleaned}`;
}

function sendWA(phone, body, lead) {
  const text = buildMessage(body, lead);
  const clean = (phone || "").replace(/[^\d+]/g, "");
  const num = clean.startsWith("0") ? "2" + clean.substring(1) : clean;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank");
}

function projColor(proj) {
  return proj?.color || PROJECT_COLORS[(proj?.id || 0) % PROJECT_COLORS.length];
}
function projBg(proj) {
  const c = projColor(proj);
  return c + "18";
}

const S = {
  inputBase: { width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #ddd", borderRadius: 8, background: "#fafafa", color: "#1a1a1a", fontFamily: "inherit", direction: "rtl", outline: "none" },
  btnPrimary: { padding: "8px 18px", fontSize: 13, fontWeight: 600, background: "#4F5BD5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" },
  btnSecondary: { padding: "8px 18px", fontSize: 13, border: "1px solid #ddd", borderRadius: 8, background: "#fff", color: "#444", cursor: "pointer" },
  btnWA: { display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 12, fontWeight: 600, background: "#25d366", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" },
  card: { background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: "14px 16px" },
};

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
    <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: bg, border: `1px solid ${border}`, color, borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 600, zIndex: 999, boxShadow: "0 4px 16px rgba(0,0,0,.1)" }}>{msg}</div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "1.5rem", width: "100%", maxWidth: 500, maxHeight: "92vh", overflowY: "auto", direction: "rtl" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#aaa" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, color: "#555", fontWeight: 600, marginBottom: 4 }}>
        {label} {required && <span style={{ color: "#c00" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function InterestPicker({ interests, selected, onChange, onManage }) {
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {interests.length === 0 && <span style={{ fontSize: 12, color: "#aaa" }}>لا توجد مجالات</span>}
        {interests.map(it => {
          const on = selected.includes(it.id);
          return (
            <button key={it.id} type="button" onClick={() => onChange(on ? selected.filter(x => x !== it.id) : [...selected, it.id])}
              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 16, cursor: "pointer", border: on ? "1.5px solid #4F5BD5" : "1px solid #ddd", background: on ? "#EEEDFE" : "#fafafa", color: on ? "#3C3489" : "#666", fontWeight: on ? 700 : 500 }}>
              {on && "✓ "}{it.name}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={onManage} style={{ fontSize: 11, color: "#4F5BD5", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>+ إدارة المجالات</button>
    </div>
  );
}

function ManageListModal({ title, items, onAdd, onDelete, onClose, saving, showColor, onUpdateColor }) {
  const [newName, setNewName] = useState("");
  function submit() { const v = newName.trim(); if (!v) return; onAdd(v); setNewName(""); }
  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input style={{ ...S.inputBase, flex: 1 }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="اسم جديد..." onKeyDown={e => { if (e.key === "Enter") submit(); }} />
        <button style={S.btnPrimary} disabled={saving || !newName.trim()} onClick={submit}>إضافة</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
        {items.length === 0 && <div style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "1rem" }}>القائمة فاضية</div>}
        {items.map(it => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa", border: "1px solid #eee", borderRadius: 8, padding: "8px 12px", gap: 8 }}>
            {showColor && (
              <input type="color" value={it.color || PROJECT_COLORS[it.id % PROJECT_COLORS.length]} onChange={e => onUpdateColor(it.id, e.target.value)}
                style={{ width: 28, height: 28, border: "none", borderRadius: 6, cursor: "pointer", padding: 0 }} />
            )}
            <span style={{ fontSize: 13, color: "#1a1a1a", flex: 1 }}>{it.name}</span>
            <button style={{ ...S.btnSecondary, padding: "3px 10px", fontSize: 12, color: "#c00" }} onClick={() => { if (confirm(`حذف "${it.name}"؟`)) onDelete(it.id); }}>حذف</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, textAlign: "left" }}><button style={S.btnSecondary} onClick={onClose}>إغلاق</button></div>
    </Modal>
  );
}

function AlertBadge({ date, note, done }) {
  const info = alertLabel(date);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  if (!info) return <span style={{ color: "#ccc" }}>—</span>;
  const hasNote = note && note.trim();
  const bg = done ? "#f0f0f0" : info.bg;
  const color = done ? "#999" : info.color;

  return (
    <span ref={wrapRef} style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => hasNote && setOpen(true)}
      onMouseLeave={() => hasNote && setOpen(false)}>
      <span onClick={e => { if (hasNote) { e.stopPropagation(); setOpen(v => !v); } }}
        style={{
          fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 700,
          background: bg, color, whiteSpace: "nowrap",
          cursor: hasNote ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: 3,
          textDecoration: done ? "line-through" : "none", opacity: done ? 0.7 : 1,
        }}>
        {done ? "✅" : "🔔"} {info.text}
        {hasNote && !done && <span style={{ width: 4, height: 4, borderRadius: "50%", background: color, display: "inline-block" }} />}
      </span>
      {open && hasNote && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", right: 0, zIndex: 50,
          background: "#1a1a1a", color: "#fff", fontSize: 11, lineHeight: 1.5,
          padding: "7px 10px", borderRadius: 8, whiteSpace: "normal", width: 180,
          boxShadow: "0 4px 12px rgba(0,0,0,.25)",
        }}>
          {note}
          <span style={{ position: "absolute", top: "100%", right: 10, width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid #1a1a1a" }} />
        </span>
      )}
    </span>
  );
}

// ── Generic multi-select dropdown ─────────────────────────────────
function MultiSelectPicker({ label: defaultLabel, options, selected, onChange, activeColor = "#4F5BD5", activeBg = "#EEEDFE", activeText = "#3C3489" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const selCount = selected.length;
  const btnLabel = selCount === 0 ? defaultLabel
    : selCount === 1 ? (options.find(o => o.id === selected[0])?.label || defaultLabel)
    : `${selCount} محدد`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ height: 36, padding: "0 12px", fontSize: 13, border: "1px solid #ddd", borderRadius: 8, background: selCount ? activeBg : "#fafafa", color: selCount ? activeText : "#444", cursor: "pointer", whiteSpace: "nowrap", fontWeight: selCount ? 700 : 400, display: "flex", alignItems: "center", gap: 6 }}>
        {btnLabel} <span style={{ fontSize: 10, color: "#888" }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,.12)", zIndex: 100, minWidth: 190, padding: 6, maxHeight: 280, overflowY: "auto" }}>
          {options.map(o => {
            const on = selected.includes(o.id);
            return (
              <div key={o.id} onClick={() => onChange(on ? selected.filter(x => x !== o.id) : [...selected, o.id])}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 7, cursor: "pointer", background: on ? (o.bg || activeBg) : "transparent" }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${o.color || activeColor}`, background: on ? (o.color || activeColor) : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {on && <span style={{ color: "#fff", fontSize: 9, fontWeight: 900 }}>✓</span>}
                </span>
                <span style={{ fontSize: 13, fontWeight: on ? 700 : 400, color: on ? (o.text || activeText) : "#444" }}>{o.label}</span>
              </div>
            );
          })}
          {selCount > 0 && (
            <div onClick={() => { onChange([]); setOpen(false); }} style={{ fontSize: 11, color: "#c00", textAlign: "center", padding: "6px 0 2px", cursor: "pointer", borderTop: "1px solid #eee", marginTop: 4 }}>مسح الاختيار</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Alert filter options ───────────────────────────────────────────
const ALERT_OPTIONS = [
  { id: "today",   label: "اليوم",         color: "#D97706", bg: "#FEF3C7", text: "#92400E" },
  { id: "tomorrow",label: "غداً",          color: "#2563EB", bg: "#DBEAFE", text: "#1E3A8A" },
  { id: "week",    label: "هذا الأسبوع",   color: "#6B7FD4", bg: "#EEEDFE", text: "#3C3489" },
  { id: "overdue", label: "متأخرة",        color: "#DC2626", bg: "#FEE2E2", text: "#7F1D1D" },
  { id: "has",     label: "لها تنبيه",     color: "#555",   bg: "#f0f0f0", text: "#333"    },
  { id: "done",    label: "تم التنبيه",    color: "#3B6D11", bg: "#EAF3DE", text: "#173404" },
  { id: "notdone", label: "لم يتم بعد",   color: "#BA7517", bg: "#FAEEDA", text: "#633806" },
];

// ── Lead Modal ─────────────────────────────────────────────────────
function LeadModal({ lead, messages, projects, interests, onSave, onClose, loading, onManageInterests }) {
  const isEdit = !!lead?.id;
  const [form, setForm] = useState({
    nickname: lead?.nickname || "", phone: lead?.phone || "", name: lead?.name || "",
    job: lead?.job || "", stage: lead?.stage || "lead", comment: lead?.comment || "",
    alert_date: lead?.alert_date || "", alert_note: lead?.alert_note || "",
    alert_done: lead?.alert_done || false, interests: lead?.interests || [],
  });
  const [selectedMsg, setSelectedMsg] = useState(() => !isEdit ? (messages.find(m => m.tag === "Lead") || messages[0] || null) : null);
  const [showPicker, setShowPicker] = useState(!isEdit);
  const [projFilter, setProjFilter] = useState("");
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function handleSave() {
    if (!form.nickname.trim() || !form.phone.trim()) { alert("اسم الشهرة ورقم الموبايل مطلوبين"); return; }
    onSave(form, selectedMsg);
  }

  const filteredMsgs = projFilter ? messages.filter(m => String(m.project_id) === projFilter) : messages;
  const preview = selectedMsg ? buildMessage(selectedMsg.body, form) : "";

  return (
    <Modal title={isEdit ? "تعديل العميل" : "إضافة Lead جديد"} onClose={onClose}>
      <Field label="اسم الشهرة" required><input style={S.inputBase} value={form.nickname} onChange={set("nickname")} placeholder="مثال: أ. محمد" /></Field>
      <Field label="رقم الموبايل" required><input style={S.inputBase} value={form.phone} onChange={set("phone")} placeholder="01x xxxx xxxx" /></Field>
      <Field label="الاسم الكامل"><input style={S.inputBase} value={form.name} onChange={set("name")} placeholder="اختياري" /></Field>
      <Field label="الوظيفة"><input style={S.inputBase} value={form.job} onChange={set("job")} placeholder="اختياري" /></Field>
      <Field label="مجالات الاهتمام">
        <InterestPicker interests={interests} selected={form.interests} onChange={v => setForm(f => ({ ...f, interests: v }))} onManage={onManageInterests} />
      </Field>
      {isEdit && (
        <Field label="المرحلة">
          <select style={S.inputBase} value={form.stage} onChange={set("stage")}>{STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        </Field>
      )}
      <Field label="تعليق"><textarea style={{ ...S.inputBase, height: 60, resize: "vertical" }} value={form.comment} onChange={set("comment")} placeholder="اختياري" /></Field>
      <Field label="تاريخ التنبيه / المتابعة">
        <input type="date" style={S.inputBase} value={form.alert_date} onChange={set("alert_date")} min={todayStr()} />
        {form.alert_date && (
          <>
            <input style={{ ...S.inputBase, marginTop: 8 }} value={form.alert_note} onChange={set("alert_note")}
              placeholder="ملاحظة قصيرة تظهر عند تمرير الماوس أو الضغط على التاريخ (اختياري)" />
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
              <AlertBadge date={form.alert_date} note={form.alert_note} done={form.alert_done} />
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "#555" }}>
                <input type="checkbox" checked={!!form.alert_done}
                  onChange={e => setForm(f => ({ ...f, alert_done: e.target.checked }))}
                  style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#3B6D11" }} />
                تم التنبيه
              </label>
            </div>
          </>
        )}
      </Field>

      {!isEdit && (
        <div style={{ marginTop: 4, borderTop: "1px solid #eee", paddingTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#444", fontWeight: 700 }}>رسالة واتساب عند الحفظ</span>
            <button style={{ fontSize: 11, color: "#4F5BD5", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }} onClick={() => setShowPicker(v => !v)}>
              {showPicker ? "إخفاء" : "تغيير الرسالة"}
            </button>
          </div>
          {showPicker && (
            <>
              {projects.length > 0 && (
                <select style={{ ...S.inputBase, marginBottom: 8 }} value={projFilter} onChange={e => setProjFilter(e.target.value)}>
                  <option value="">كل المشروعات</option>
                  {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                </select>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10, maxHeight: 200, overflowY: "auto" }}>
                {filteredMsgs.length === 0 && <div style={{ fontSize: 12, color: "#aaa", textAlign: "center", padding: 10 }}>لا توجد رسائل</div>}
                {filteredMsgs.map(m => {
                  const sel = selectedMsg?.id === m.id;
                  const proj = projects.find(p => p.id === m.project_id);
                  return (
                    <div key={m.id} onClick={() => { setSelectedMsg(m); setShowPicker(false); }}
                      style={{ border: sel ? "2px solid #4F5BD5" : "1px solid #e0e0e0", borderRadius: 10, padding: "9px 12px", cursor: "pointer", background: sel ? "#f0f1ff" : "#fafafa" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3, gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: sel ? "#4F5BD5" : "#1a1a1a" }}>{m.title}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          {proj && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: projBg(proj), color: projColor(proj), fontWeight: 600 }}>{proj.name}</span>}
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: "#E6F1FB", color: "#185FA5", fontWeight: 600 }}>{m.tag}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "#777", lineHeight: 1.5 }}>{m.body.substring(0, 80)}{m.body.length > 80 ? "…" : ""}</div>
                      {sel && <div style={{ marginTop: 4, fontSize: 11, color: "#4F5BD5", fontWeight: 700 }}>✓ محددة</div>}
                    </div>
                  );
                })}
                <div onClick={() => { setSelectedMsg(null); setShowPicker(false); }} style={{ border: !selectedMsg ? "2px solid #aaa" : "1px solid #e0e0e0", borderRadius: 10, padding: "9px 12px", cursor: "pointer", background: "#fafafa", fontSize: 12, color: "#888", textAlign: "center" }}>بدون رسالة واتساب</div>
              </div>
            </>
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
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
        <button style={S.btnSecondary} onClick={onClose}>إلغاء</button>
        <button style={{ ...S.btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={handleSave} disabled={loading}>
          {loading ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : selectedMsg ? "حفظ وإرسال WhatsApp" : "حفظ"}
        </button>
      </div>
    </Modal>
  );
}

function SendWAModal({ lead, messages, projects, onClose }) {
  const [projFilter, setProjFilter] = useState("");
  const filtered = projFilter ? messages.filter(m => String(m.project_id) === projFilter) : messages;
  return (
    <Modal title={`إرسال لـ ${lead.nickname || lead.name || lead.phone}`} onClose={onClose}>
      {projects.length > 0 && (
        <select style={{ ...S.inputBase, marginBottom: 10 }} value={projFilter} onChange={e => setProjFilter(e.target.value)}>
          <option value="">كل المشروعات</option>
          {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
        {filtered.map(m => {
          const proj = projects.find(p => p.id === m.project_id);
          return (
            <div key={m.id} style={{ background: "#f8f9fa", border: "1px solid #eee", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{m.title}</span>
                  {proj && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 8, background: projBg(proj), color: projColor(proj), fontWeight: 600 }}>{proj.name}</span>}
                </div>
                <div style={{ fontSize: 11, color: "#777", lineHeight: 1.5 }}>{m.body.substring(0, 70)}…</div>
              </div>
              <button style={S.btnWA} onClick={() => { sendWA(lead.phone, m.body, lead); onClose(); }}>إرسال</button>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, textAlign: "left" }}><button style={S.btnSecondary} onClick={onClose}>إغلاق</button></div>
    </Modal>
  );
}

function MsgModal({ msg, projects, onSave, onClose, loading, onManageProjects }) {
  const [form, setForm] = useState({ title: msg?.title || "", tag: msg?.tag || "Lead", body: msg?.body || "", project_id: msg?.project_id ? String(msg.project_id) : "" });
  const [preview, setPreview] = useState("");
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title={msg?.id ? "تعديل الرسالة" : "رسالة جديدة"} onClose={onClose}>
      <Field label="عنوان الرسالة" required><input style={S.inputBase} value={form.title} onChange={set("title")} placeholder="مثال: رسالة ترحيب" /></Field>
      <Field label="المشروع">
        <select style={S.inputBase} value={form.project_id} onChange={set("project_id")}>
          <option value="">بدون مشروع</option>
          {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
        <button type="button" onClick={onManageProjects} style={{ fontSize: 11, color: "#4F5BD5", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0, marginTop: 5 }}>+ إدارة المشروعات</button>
      </Field>
      <Field label="التصنيف">
        <select style={S.inputBase} value={form.tag} onChange={set("tag")}>
          {["Lead","Qualification","Demo","Needs Analysis","Proposal","Negotiation","Closing","عام"].map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="نص الرسالة" required>
        <textarea style={{ ...S.inputBase, height: 110, resize: "vertical" }} value={form.body} onChange={set("body")} placeholder="اكتب نص الرسالة..." />
        <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>💡 سطر "مرحبا [اسم الشهرة]" هيتضاف تلقائياً</div>
      </Field>
      {preview && <div style={{ background: "#e9fce9", borderRadius: 10, padding: 12, fontSize: 12, color: "#1a3a1a", marginBottom: 10, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{preview}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={S.btnSecondary} onClick={() => setPreview(buildMessage(form.body, { nickname: "أ. محمد" }))}>معاينة</button>
        <button style={S.btnSecondary} onClick={onClose}>إلغاء</button>
        <button style={{ ...S.btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={() => onSave(form)} disabled={loading}>{loading ? "جاري الحفظ..." : "حفظ"}</button>
      </div>
    </Modal>
  );
}

function HistoryModal({ lead, history, onClose }) {
  return (
    <Modal title={`تاريخ ${lead.nickname || lead.name || lead.phone}`} onClose={onClose}>
      {history.length === 0 ? <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "1rem" }}>لا يوجد تاريخ بعد</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {history.map((h, i) => { const si = stageInfo(h.stage); return (
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
          ); })}
        </div>
      )}
      <div style={{ marginTop: 12, textAlign: "left" }}><button style={S.btnSecondary} onClick={onClose}>إغلاق</button></div>
    </Modal>
  );
}

function KanbanView({ leads, interests, onEdit, onDelete, onWA, onHistory }) {
  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <div style={{ display: "flex", gap: 10, minWidth: 1000 }}>
        {STAGES.map(s => {
          const cards = [...leads.filter(l => l.stage === s.id)].sort(sortByAlert);
          return (
            <div key={s.id} style={{ flex: "0 0 142px", background: "#f8f8f8", border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: s.color, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {s.label} <span style={{ fontSize: 10, background: s.bg, color: s.text, padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>{cards.length}</span>
              </div>
              {cards.map(l => (
                <div key={l.id} onClick={() => onEdit(l)} style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 9, padding: "8px 9px", marginBottom: 8, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = s.color} onMouseLeave={e => e.currentTarget.style.borderColor = "#e8e8e8"}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{l.nickname || l.name || l.phone}</div>
                  {l.job && <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{l.job}</div>}
                  {(l.interests || []).length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 5 }}>
                      {(l.interests || []).slice(0, 2).map(iid => { const it = interests.find(x => x.id === iid); return it ? <span key={iid} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: "#EEEDFE", color: "#3C3489" }}>{it.name}</span> : null; })}
                      {(l.interests || []).length > 2 && <span style={{ fontSize: 9, color: "#aaa" }}>+{l.interests.length - 2}</span>}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    <button style={{ ...S.btnWA, padding: "3px 8px", fontSize: 11 }} onClick={e => { e.stopPropagation(); onWA(l); }}>WA</button>
                    <button style={{ ...S.btnSecondary, padding: "3px 7px", fontSize: 11 }} onClick={e => { e.stopPropagation(); window.open("tel:" + l.phone); }}>📞</button>
                    <button style={{ ...S.btnSecondary, padding: "3px 7px", fontSize: 11 }} onClick={e => { e.stopPropagation(); onHistory(l); }}>📋</button>
                    <button style={{ ...S.btnSecondary, padding: "3px 7px", fontSize: 11, color: "#c00" }} onClick={e => { e.stopPropagation(); if (confirm("حذف؟")) onDelete(l.id); }}>🗑</button>
                  </div>
                  {l.comment && <div style={{ fontSize: 10, color: "#999", marginTop: 5, paddingTop: 4, borderTop: "1px solid #f0f0f0", fontStyle: "italic" }}>{l.comment.substring(0, 50)}{l.comment.length > 50 ? "…" : ""}</div>}
                  {l.alert_date && <div style={{ marginTop: 4 }}><AlertBadge date={l.alert_date} note={l.alert_note} done={l.alert_done} /></div>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TableView({ leads, interests, onEdit, onDelete, onWA, onHistory, sortConfig, onSort }) {
  const sorted = useMemo(() => {
    const arr = [...leads];
    if (sortConfig.key === "alert_date") return arr.sort((a, b) => {
      const da = a.alert_date || "9999-12-31"; const db = b.alert_date || "9999-12-31";
      return sortConfig.dir === "asc" ? da.localeCompare(db) : db.localeCompare(da);
    });
    if (sortConfig.key === "created_at") return arr.sort((a, b) => {
      const da = a.created_at || ""; const db = b.created_at || "";
      return sortConfig.dir === "asc" ? da.localeCompare(db) : db.localeCompare(da);
    });
    if (sortConfig.key === "name") return arr.sort((a, b) => {
      const na = a.name || a.nickname || ""; const nb = b.name || b.nickname || "";
      return na.localeCompare(nb, "ar") * (sortConfig.dir === "asc" ? 1 : -1);
    });
    if (sortConfig.key === "stage") return arr.sort((a, b) => {
      const ai = STAGES.findIndex(s => s.id === a.stage);
      const bi = STAGES.findIndex(s => s.id === b.stage);
      return (ai - bi) * (sortConfig.dir === "asc" ? 1 : -1);
    });
    return arr;
  }, [leads, sortConfig]);

  const th = { padding: "8px 12px", textAlign: "right", fontSize: 12, color: "#666", fontWeight: 700, borderBottom: "2px solid #eee", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };
  const td = { padding: "9px 12px", fontSize: 13, color: "#1a1a1a", borderBottom: "1px solid #f0f0f0", verticalAlign: "middle" };

  function SortIcon({ k }) {
    if (sortConfig.key !== k) return <span style={{ color: "#ccc", fontSize: 10 }}> ⇅</span>;
    return <span style={{ fontSize: 10, color: "#4F5BD5" }}>{sortConfig.dir === "asc" ? " ↑" : " ↓"}</span>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 850 }}>
        <thead><tr>
          <th style={th} onClick={() => onSort("name")}>الاسم الكامل<SortIcon k="name" /></th>
          <th style={{ ...th, cursor: "default" }}>الموبايل</th>
          <th style={{ ...th, cursor: "default" }}>الوظيفة</th>
          <th style={{ ...th, cursor: "default" }}>مجالات الاهتمام</th>
          <th style={th} onClick={() => onSort("stage")}>المرحلة<SortIcon k="stage" /></th>
          <th style={th} onClick={() => onSort("alert_date")}>تنبيه<SortIcon k="alert_date" /></th>
          <th style={th} onClick={() => onSort("created_at")}>تاريخ الإضافة<SortIcon k="created_at" /></th>
          <th style={{ ...th, cursor: "default" }}>إجراءات</th>
        </tr></thead>
        <tbody>
          {sorted.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#ccc", padding: "2.5rem" }}>لا توجد نتائج</td></tr>}
          {sorted.map(l => { const si = stageInfo(l.stage); return (
            <tr key={l.id} onMouseEnter={e => e.currentTarget.style.background = "#fafafa"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <td style={{ ...td, fontWeight: 700 }}>{l.name || l.nickname || "—"}</td>
              <td style={{ ...td, direction: "ltr", textAlign: "right" }}>{l.phone}</td>
              <td style={{ ...td, color: "#666" }}>{l.job || "—"}</td>
              <td style={td}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {(l.interests || []).map(iid => { const it = interests.find(x => x.id === iid); return it ? <span key={iid} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: "#EEEDFE", color: "#3C3489", fontWeight: 600 }}>{it.name}</span> : null; })}
                  {(l.interests || []).length === 0 && <span style={{ color: "#ccc" }}>—</span>}
                </div>
              </td>
              <td style={td}><span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 12, fontWeight: 700, background: si.bg, color: si.text }}>{si.label}</span></td>
              <td style={td}><AlertBadge date={l.alert_date} note={l.alert_note} done={l.alert_done} /></td>
              <td style={{ ...td, fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>
                {l.created_at ? new Date(l.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </td>
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
          ); })}
        </tbody>
      </table>
    </div>
  );
}

function MsgsView({ messages, projects, onAdd, onEdit, onDelete, onManageProjects, onReorder }) {
  const [projFilter, setProjFilter] = useState("");
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [reordering, setReordering] = useState(false);

  // when filtered, drag reorders within the filtered subset mapped back to full list
  const filtered = projFilter ? messages.filter(m => String(m.project_id) === projFilter) : messages;

  function handleDragStart(e, idx) {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragOver(e, idx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  }
  function handleDrop(e, dropIdx) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setOverIdx(null); return; }

    // reorder within filtered subset, then rebuild full messages array
    const newFiltered = [...filtered];
    const [moved] = newFiltered.splice(dragIdx, 1);
    newFiltered.splice(dropIdx, 0, moved);

    if (!projFilter) {
      // no filter → full reorder
      onReorder(newFiltered);
    } else {
      // with filter → rebuild full list preserving non-filtered positions
      const filteredIds = new Set(newFiltered.map(m => m.id));
      const rest = messages.filter(m => !filteredIds.has(m.id));
      // interleave: keep non-filtered in their relative positions, insert filtered in new order
      let fi = 0;
      const result = messages.map(m => filteredIds.has(m.id) ? newFiltered[fi++] : m);
      // simpler: just put filtered in new order at their original positions in the full list
      const full = [...messages];
      const filteredPositions = messages.reduce((acc, m, i) => filteredIds.has(m.id) ? [...acc, i] : acc, []);
      filteredPositions.forEach((pos, i) => { full[pos] = newFiltered[i]; });
      onReorder(full);
    }
    setDragIdx(null);
    setOverIdx(null);
  }
  function handleDragEnd() { setDragIdx(null); setOverIdx(null); }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select style={{ ...S.inputBase, width: "auto", minWidth: 180 }} value={projFilter} onChange={e => setProjFilter(e.target.value)}>
            <option value="">كل المشروعات</option>
            {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </select>
          <button style={S.btnSecondary} onClick={onManageProjects}>إدارة المشروعات</button>
        </div>
        <button style={S.btnPrimary} onClick={onAdd}>+ رسالة جديدة</button>
      </div>

      {/* hint */}
      <div style={{ fontSize: 11, color: "#999", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
        <span>⠿</span> اسحب البطاقات لإعادة الترتيب — يُحفظ تلقائياً
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {filtered.length === 0 && <div style={{ color: "#aaa", fontSize: 13, padding: "2rem", gridColumn: "1/-1", textAlign: "center" }}>لا توجد رسائل</div>}
        {filtered.map((m, idx) => {
          const proj = projects.find(p => p.id === m.project_id);
          const isDragging = dragIdx === idx;
          const isOver = overIdx === idx && dragIdx !== idx;
          return (
            <div key={m.id}
              draggable
              onDragStart={e => handleDragStart(e, idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={e => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              style={{
                ...S.card,
                borderTop: proj ? `3px solid ${projColor(proj)}` : "1px solid #eee",
                opacity: isDragging ? 0.4 : 1,
                outline: isOver ? "2px dashed #4F5BD5" : "none",
                outlineOffset: 2,
                cursor: "grab",
                transition: "opacity .15s, outline .1s",
                userSelect: "none",
              }}>
              {/* drag handle */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16, color: "#ccc", lineHeight: 1, cursor: "grab" }}>⠿</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{m.title}</span>
                </div>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#E6F1FB", color: "#185FA5", fontWeight: 700, flexShrink: 0 }}>{m.tag}</span>
              </div>
              {proj && <div style={{ marginBottom: 6 }}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: projBg(proj), color: projColor(proj), fontWeight: 700 }}>{proj.name}</span></div>}
              <div style={{ fontSize: 12, color: "#666", lineHeight: 1.7, marginBottom: 10, whiteSpace: "pre-wrap", minHeight: 50 }}>
                {m.body.length > 110 ? m.body.substring(0, 110) + "…" : m.body}
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
                <button style={{ ...S.btnSecondary, padding: "4px 10px", fontSize: 12 }} onClick={() => onEdit(m)}>تعديل</button>
                <button style={{ ...S.btnSecondary, padding: "4px 10px", fontSize: 12, color: "#c00" }} onClick={() => { if (confirm("حذف؟")) onDelete(m.id); }}>حذف</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stats (filtered) ───────────────────────────────────────────────
function StatsBar({ leads, messages }) {
  const today = todayStr();
  const stats = [
    { label: "إجمالي Leads",   val: leads.length,                                    color: "#4F5BD5" },
    { label: "Closing",         val: leads.filter(l => l.stage === "closing").length, color: "#3B6D11" },
    { label: "تنبيهات نشطة",  val: leads.filter(l => l.alert_date && l.alert_date >= today).length, color: "#BA7517" },
    { label: "متأخرة",          val: leads.filter(l => l.alert_date && l.alert_date < today).length, color: "#DC2626" },
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

// ── Main ───────────────────────────────────────────────────────────
export default function App() {
  const [leads, setLeads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [interests, setInterests] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("kanban");
  const [modal, setModal] = useState(null);

  const [q, setQ] = useState("");
  const [stageFilters, setStageFilters] = useState([]);
  const [interestFilters, setInterestFilters] = useState([]);
  const [alertFilters, setAlertFilters] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "created_at", dir: "desc" });

  function handleSort(key) {
    setSortConfig(prev => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }

  const showToast = useCallback((msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }, []);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const [l, m, h, i, p] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("messages").select("*").order("sort_order", { ascending: true }),
        supabase.from("lead_history").select("*").order("created_at", { ascending: true }),
        supabase.from("interests").select("*").order("name"),
        supabase.from("projects").select("*").order("name"),
      ]);
      setLeads(l.data || []); setMessages(m.data || []); setHistory(h.data || []);
      setInterests(i.data || []); setProjects(p.data || []); setLoading(false);
    }
    fetchAll();
  }, []);

  const filteredLeads = useMemo(() => {
    const today = todayStr();
    const tmrw = tomorrowStr();
    const eow = endOfWeekStr();
    return leads.filter(l => {
      const text = `${l.nickname || ""} ${l.name || ""} ${l.phone || ""} ${l.job || ""}`;
      if (q && !text.includes(q)) return false;
      if (stageFilters.length > 0 && !stageFilters.includes(l.stage)) return false;
      if (interestFilters.length > 0 && !interestFilters.some(id => (l.interests || []).includes(Number(id)))) return false;
      if (alertFilters.length > 0) {
        const matchAlert = alertFilters.some(f => {
          if (f === "today")    return l.alert_date === today;
          if (f === "tomorrow") return l.alert_date === tmrw;
          if (f === "week")     return l.alert_date && l.alert_date >= today && l.alert_date <= eow;
          if (f === "overdue")  return l.alert_date && l.alert_date < today;
          if (f === "has")      return !!l.alert_date;
          if (f === "done")     return !!l.alert_done;
          if (f === "notdone")  return l.alert_date && !l.alert_done;
          return false;
        });
        if (!matchAlert) return false;
      }
      return true;
    });
  }, [leads, q, stageFilters, interestFilters, alertFilters]);

  const saveLead = useCallback(async (form, selectedMsg) => {
    setSaving(true);
    const editing = modal?.data;
    const payload = {
      nickname: form.nickname, phone: form.phone, name: form.name || null,
      job: form.job || null, comment: form.comment || null,
      alert_date: form.alert_date || null, alert_note: form.alert_note || null,
      alert_done: !!form.alert_done, interests: form.interests,
    };
    if (editing?.id) {
      const stageChanged = form.stage !== editing.stage;
      const { data, error } = await supabase.from("leads").update({ ...payload, stage: form.stage, updated_at: new Date().toISOString() }).eq("id", editing.id).select().single();
      if (error) { showToast("خطأ في الحفظ", "error"); setSaving(false); return; }
      setLeads(prev => prev.map(l => l.id === data.id ? data : l));
      if (stageChanged) {
        const { data: h } = await supabase.from("lead_history").insert({ lead_id: data.id, stage: form.stage, comment: form.comment }).select().single();
        if (h) setHistory(prev => [...prev, h]);
      }
      showToast("تم الحفظ ✓");
    } else {
      const { data, error } = await supabase.from("leads").insert({ ...payload, stage: "lead" }).select().single();
      if (error) { showToast("خطأ في الإضافة", "error"); setSaving(false); return; }
      setLeads(prev => [data, ...prev]);
      await supabase.from("lead_history").insert({ lead_id: data.id, stage: "lead", comment: form.comment });
      if (selectedMsg) sendWA(form.phone, selectedMsg.body, form);
      showToast("تمت الإضافة ✓");
    }
    setSaving(false); setModal(null);
  }, [modal, showToast]);

  const deleteLead = useCallback(async (id) => {
    await supabase.from("lead_history").delete().eq("lead_id", id);
    await supabase.from("leads").delete().eq("id", id);
    setLeads(prev => prev.filter(l => l.id !== id));
    setHistory(prev => prev.filter(h => h.lead_id !== id));
    showToast("تم الحذف");
  }, [showToast]);

  const saveMsg = useCallback(async (form) => {
    if (!form.title.trim() || !form.body.trim()) { alert("العنوان والنص مطلوبين"); return; }
    setSaving(true);
    const editing = modal?.data;
    const payload = { title: form.title, tag: form.tag, body: form.body, project_id: form.project_id ? Number(form.project_id) : null };
    if (editing?.id) {
      const { data, error } = await supabase.from("messages").update(payload).eq("id", editing.id).select().single();
      if (error) { showToast("خطأ", "error"); setSaving(false); return; }
      setMessages(prev => prev.map(m => m.id === data.id ? data : m));
    } else {
      const maxOrder = messages.reduce((mx, m) => Math.max(mx, m.sort_order || 0), 0);
      const { data, error } = await supabase.from("messages").insert({ ...payload, sort_order: maxOrder + 1 }).select().single();
      if (error) { showToast("خطأ", "error"); setSaving(false); return; }
      setMessages(prev => [...prev, data]);
    }
    setSaving(false); setModal(null); showToast("تم الحفظ ✓");
  }, [modal, messages, showToast]);

  const deleteMsg = useCallback(async (id) => {
    await supabase.from("messages").delete().eq("id", id);
    setMessages(prev => prev.filter(m => m.id !== id));
    showToast("تم الحذف");
  }, [showToast]);

  const reorderMsgs = useCallback(async (newOrder) => {
    // newOrder = array of messages in new order
    setMessages(newOrder);
    // save sort_order for each message in background
    const updates = newOrder.map((m, i) =>
      supabase.from("messages").update({ sort_order: i + 1 }).eq("id", m.id)
    );
    await Promise.all(updates);
  }, []);

  const addLookup = useCallback(async (table, name, setter) => {
    setSaving(true);
    const { data, error } = await supabase.from(table).insert({ name }).select().single();
    setSaving(false);
    if (error) { showToast("موجود أو خطأ", "error"); return; }
    setter(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, "ar")));
    showToast("تمت الإضافة ✓");
  }, [showToast]);

  const deleteLookup = useCallback(async (table, id, setter) => {
    await supabase.from(table).delete().eq("id", id);
    setter(prev => prev.filter(x => x.id !== id));
    showToast("تم الحذف");
  }, [showToast]);

  const updateProjectColor = useCallback(async (id, color) => {
    await supabase.from("projects").update({ color }).eq("id", id);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, color } : p));
  }, []);

  const TABS = [{ id: "kanban", label: "Kanban Board" }, { id: "table", label: "جدول" }, { id: "msgs", label: "مكتبة الرسائل" }];
  const leadHistory = modal?.data?.id ? history.filter(h => h.lead_id === modal.data.id) : [];
  const hasFilters = q || stageFilters.length > 0 || interestFilters.length > 0 || alertFilters.length > 0;

  return (
    <div dir="rtl" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", background: "#f5f5f7", minHeight: "100vh", paddingBottom: "2rem" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 800 }}>Sales CRM</span>
          <span style={{ fontSize: 12, color: "#aaa" }}>بواسطة HeroTec</span>
        </div>
        <button style={S.btnPrimary} onClick={() => setModal({ type: "add-lead" })}>+ إضافة Lead</button>
      </div>

      <div style={{ padding: "0 24px" }}>
        {loading ? <Spinner /> : (
          <>
            {/* Stats now use filteredLeads */}
            <StatsBar leads={filteredLeads} messages={messages} />

            <div style={{ display: "flex", gap: 6, marginBottom: 16, background: "#efefef", borderRadius: 10, padding: 4, width: "fit-content" }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ padding: "7px 18px", fontSize: 13, fontWeight: tab === t.id ? 700 : 500, borderRadius: 8, border: "none", cursor: "pointer", background: tab === t.id ? "#fff" : "transparent", color: tab === t.id ? "#1a1a1a" : "#666", boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,.08)" : "none" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab !== "msgs" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                <input style={{ ...S.inputBase, flex: 1, minWidth: 160, maxWidth: 280, height: 36 }} value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث بالاسم أو الموبايل..." />
                <MultiSelectPicker
                  label="كل المراحل"
                  options={STAGES.map(s => ({ id: s.id, label: s.label, color: s.color, bg: s.bg, text: s.text }))}
                  selected={stageFilters} onChange={setStageFilters}
                />
                <MultiSelectPicker
                  label="كل المجالات"
                  options={interests.map(i => ({ id: String(i.id), label: i.name, color: "#6B7FD4", bg: "#EEEDFE", text: "#3C3489" }))}
                  selected={interestFilters} onChange={setInterestFilters}
                  activeColor="#6B7FD4" activeBg="#EEEDFE" activeText="#3C3489"
                />
                <MultiSelectPicker
                  label="كل التنبيهات"
                  options={ALERT_OPTIONS}
                  selected={alertFilters} onChange={setAlertFilters}
                  activeColor="#D97706" activeBg="#FEF3C7" activeText="#92400E"
                />
                {hasFilters && (
                  <button style={{ ...S.btnSecondary, height: 36, padding: "0 14px" }}
                    onClick={() => { setQ(""); setStageFilters([]); setInterestFilters([]); setAlertFilters([]); }}>مسح الفلاتر</button>
                )}
              </div>
            )}

            {tab === "kanban" && <KanbanView leads={filteredLeads} interests={interests} onEdit={l => setModal({ type: "edit-lead", data: l })} onDelete={deleteLead} onWA={l => setModal({ type: "send-wa", data: l })} onHistory={l => setModal({ type: "history", data: l })} />}
            {tab === "table"  && <TableView  leads={filteredLeads} interests={interests} onEdit={l => setModal({ type: "edit-lead", data: l })} onDelete={deleteLead} onWA={l => setModal({ type: "send-wa", data: l })} onHistory={l => setModal({ type: "history", data: l })} sortConfig={sortConfig} onSort={handleSort} />}
            {tab === "msgs"   && <MsgsView messages={messages} projects={projects} onAdd={() => setModal({ type: "add-msg" })} onEdit={m => setModal({ type: "edit-msg", data: m })} onDelete={deleteMsg} onManageProjects={() => setModal({ type: "manage-projects" })} onReorder={reorderMsgs} />}
          </>
        )}
      </div>

      {(modal?.type === "add-lead" || modal?.type === "edit-lead") && (
        <LeadModal lead={modal.data} messages={messages} projects={projects} interests={interests}
          onSave={saveLead} onClose={() => setModal(null)} loading={saving}
          onManageInterests={() => setModal({ type: "manage-interests" })} />
      )}
      {modal?.type === "send-wa" && <SendWAModal lead={modal.data} messages={messages} projects={projects} onClose={() => setModal(null)} />}
      {(modal?.type === "add-msg" || modal?.type === "edit-msg") && (
        <MsgModal msg={modal.data} projects={projects} onSave={saveMsg} onClose={() => setModal(null)} loading={saving}
          onManageProjects={() => setModal({ type: "manage-projects" })} />
      )}
      {modal?.type === "history" && <HistoryModal lead={modal.data} history={leadHistory} onClose={() => setModal(null)} />}
      {modal?.type === "manage-interests" && (
        <ManageListModal title="إدارة مجالات الاهتمام" items={interests} saving={saving}
          onAdd={name => addLookup("interests", name, setInterests)}
          onDelete={id => deleteLookup("interests", id, setInterests)}
          onClose={() => setModal(null)} />
      )}
      {modal?.type === "manage-projects" && (
        <ManageListModal title="إدارة المشروعات" items={projects} saving={saving} showColor
          onAdd={name => addLookup("projects", name, setProjects)}
          onDelete={id => deleteLookup("projects", id, setProjects)}
          onUpdateColor={updateProjectColor}
          onClose={() => setModal(null)} />
      )}
    </div>
  );
}
