import { useState, useRef } from "react";
import { C, REQ_CATEGORIES, REQ_TYPES, ONBOARDING_ITEMS, TRAVEL_SUBS_DOMESTIC, TRAVEL_SUBS_OVERSEAS } from "../constants";
import { uploadFileViaScript } from "../api/client";
import type { RosterMember, Quotas, User } from "../types";
import Modal from "./ui/Modal";
import Btn from "./ui/Btn";
import { Fld, Inp, Sel, Txa } from "./ui/Fld";

export default function NewRequestModal({ onClose, onSubmit, roster, quotas, user, meEmail }: {
  onClose: () => void;
  onSubmit: (data: any, targets: string[]) => Promise<void>;
  roster: RosterMember[];
  quotas: Quotas;
  user: User;
  meEmail: string;
}) {
  const [step,        setStep]        = useState(1);
  const [cat,         setCat]         = useState("");
  const [type,        setType]        = useState("");
  const [form,        setForm]        = useState<Record<string, any>>({});
  const [files,       setFiles]       = useState<File[]>([]);
  const [busy,        setBusy]        = useState(false);
  const [uploadMsg,   setUploadMsg]   = useState("");
  const [onBehalf,    setOnBehalf]    = useState(false);
  const [targets,     setTargets]     = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin      = (quotas?.adminEmails || []).includes(meEmail) || meEmail === (quotas?.ceoEmail || "");
  const set          = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const selectType   = (t: string) => { setType(t); setForm({}); setFiles([]); setStep(3); };
  const toggleTarget = (email: string) => setTargets(p => p.includes(email) ? p.filter(e => e !== email) : [...p, email]);

  const typeInfo   = type ? REQ_TYPES[type] : null;
  const catTypes   = cat ? REQ_CATEGORIES[cat]?.types.map(t => ({ value: t, ...REQ_TYPES[t] })) : [];
  const needAttach  = form.subType === "Expense Claim";
  const isTravel    = type === "domestic_trip" || type === "overseas_trip";
  const isRental    = type === "car_rental" || type === "equipment_rental" || type === "rnd_item";
  const isBreakdown = cat === "breakdown";

  const canSubmit = type && form.title
    && !(needAttach  && files.length === 0)
    && !(isTravel    && (!form.subType || !form.startDate || !form.endDate || !form.destination))
    && !(isRental    && (!form.startDate || !form.endDate))
    && !(isBreakdown && !form.asset);

  const rosterOthers = roster.filter(r => r.email && r.email !== meEmail);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      const uploaded: { url: string; name: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        setUploadMsg(`파일 업로드 중 (${i + 1}/${files.length})...`);
        try {
          const r = await uploadFileViaScript(files[i]);
          uploaded.push(r as { url: string; name: string });
        } catch {
          setUploadMsg("");
          throw new Error(`"${files[i].name}" 업로드 실패. 다시 시도해주세요.`);
        }
      }
      setUploadMsg("");
      const attachments = uploaded.map(u => ({ url: u.url, name: u.name })).filter(u => u.url);
      const baseData = { type, category: cat, ...form, attachments };
      await onSubmit(baseData, onBehalf && targets.length > 0 ? targets : []);
      onClose();
    } catch (e: any) {
      alert("Submit failed: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  if (step === 1) return (
    <Modal title="New Request — Category" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {Object.entries(REQ_CATEGORIES).map(([k, c]) => (
          <button key={k} onClick={() => { setCat(k); setStep(2); }}
            style={{ padding: "18px 12px", border: `2px solid ${C.border}`, borderRadius: 10, background: "#fff", cursor: "pointer", textAlign: "center" }}
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.primary; (e.currentTarget as HTMLButtonElement).style.background = C.primaryLight; }}
            onMouseOut={e  => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;  (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{c.label}</div>
          </button>
        ))}
      </div>
    </Modal>
  );

  if (step === 2) return (
    <Modal title={REQ_CATEGORIES[cat]?.label} onClose={onClose}>
      <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: C.primary, cursor: "pointer", marginBottom: 12, fontSize: 13 }}>← Back</button>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {catTypes.map(t => (
          <button key={t.value} onClick={() => selectType(t.value)}
            style={{ padding: "12px 14px", border: `1px solid ${C.border}`, borderRadius: 8, background: "#fff", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}
            onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = C.primaryLight}
            onMouseOut={e  => (e.currentTarget as HTMLButtonElement).style.background = "#fff"}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </Modal>
  );

  return (
    <Modal title={`${typeInfo?.icon} ${typeInfo?.label}`} onClose={onClose} width={560}>
      <button onClick={() => setStep(2)} style={{ background: "none", border: "none", color: C.primary, cursor: "pointer", marginBottom: 12, fontSize: 13 }}>← Back</button>

      <Fld label="Title / Summary" required>
        <Inp value={form.title || ""} onChange={v => set("title", v)} placeholder="Brief description" />
      </Fld>

      {type === "onboarding_item" && (
        <Fld label="Items Needed">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ONBOARDING_ITEMS.map(item => {
              const on = (form.items || []).includes(item);
              return (
                <button key={item}
                  onClick={() => set("items", on ? (form.items || []).filter((i: string) => i !== item) : [...(form.items || []), item])}
                  style={{ padding: "4px 10px", borderRadius: 16,
                    border: `1px solid ${on ? C.primary : C.border}`,
                    background: on ? C.primaryLight : "#fff",
                    cursor: "pointer", fontSize: 12, fontWeight: on ? 600 : 400 }}>
                  {item}
                </button>
              );
            })}
          </div>
        </Fld>
      )}

      {(type === "domestic_trip" || type === "overseas_trip") && (
        <>
          <Fld label="Travel Support Type" required>
            <Sel value={form.subType || ""} onChange={v => set("subType", v)}
              options={type === "overseas_trip" ? TRAVEL_SUBS_OVERSEAS : TRAVEL_SUBS_DOMESTIC}
              placeholder="Select..." />
          </Fld>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Fld label="Departure" required><Inp type="date" value={form.startDate || ""} onChange={v => set("startDate", v)} /></Fld>
            <Fld label="Return"    required><Inp type="date" value={form.endDate   || ""} onChange={v => set("endDate",   v)} /></Fld>
          </div>
          <Fld label="Destination" required>
            <Inp value={form.destination || ""} onChange={v => set("destination", v)}
              placeholder={type === "overseas_trip" ? "e.g. Tokyo, Japan" : "e.g. Busan"} />
          </Fld>
          {form.subType === "Expense Claim" && (
            <Fld label="Amount (KRW)" required>
              <Inp type="number" value={form.amount || ""} onChange={v => set("amount", v)} placeholder="0" />
            </Fld>
          )}
        </>
      )}

      {(type === "car_rental" || type === "equipment_rental" || type === "rnd_item") && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Fld label="From" required><Inp type="date" value={form.startDate || ""} onChange={v => set("startDate", v)} /></Fld>
          <Fld label="To"   required><Inp type="date" value={form.endDate   || ""} onChange={v => set("endDate",   v)} /></Fld>
        </div>
      )}

      {cat === "breakdown" && (
        <Fld label="Asset / Location" required>
          <Inp value={form.asset || ""} onChange={v => set("asset", v)} placeholder="e.g. MacBook SN:XXX / Meeting Room B" />
        </Fld>
      )}

      <Fld label="Details / Notes">
        <Txa value={form.notes || ""} onChange={v => set("notes", v)} placeholder="Additional details..." />
      </Fld>

      <Fld label={`Attachments${needAttach ? " (required)" : ""}`}>
        <div style={{ border: `1px dashed ${C.border}`, borderRadius: 8, padding: 12,
          background: C.grayLight, cursor: "pointer", textAlign: "center" }}
          onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" multiple style={{ display: "none" }}
            onChange={e => setFiles(Array.from(e.target.files || []))} />
          <div style={{ fontSize: 12, color: C.muted }}>
            {files.length > 0 ? files.map(f => f.name).join(", ") : "Click to attach receipts / photos"}
          </div>
        </div>
      </Fld>

      {isAdmin && roster.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 4 }}>
          <button onClick={() => setOnBehalf(p => !p)}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.primary, fontSize: 12, fontWeight: 600, padding: 0 }}>
            {onBehalf ? "▼" : "▶"} Submit on behalf of others
          </button>
          {onBehalf && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Select team members:</div>
              <div style={{ maxHeight: 160, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 6 }}>
                {rosterOthers.map(r => (
                  <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                    cursor: "pointer", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                    <input type="checkbox" checked={targets.includes(r.email)} onChange={() => toggleTarget(r.email)} />
                    <span>{r.name}</span>
                    <span style={{ color: C.muted, fontSize: 11 }}>{r.team}</span>
                  </label>
                ))}
              </div>
              {targets.length > 0 && (
                <div style={{ fontSize: 11, color: C.primary, marginTop: 4, fontWeight: 600 }}>
                  {targets.length}명: {targets.map(e => roster.find(r => r.email === e)?.name || e).join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showConfirm && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: C.primaryLight, borderRadius: 8, border: `1px solid ${C.primary}` }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>다음 {targets.length}명으로 제출하시겠습니까?</div>
          {targets.map(e => {
            const r = roster.find(r => r.email === e);
            return <div key={e} style={{ fontSize: 12, color: C.text, marginBottom: 3 }}>· {r?.name || e} ({e})</div>;
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Btn variant="gray" onClick={() => setShowConfirm(false)}>취소</Btn>
            <Btn onClick={handleSubmit} disabled={busy}>{busy ? "Submitting..." : "확인 제출"}</Btn>
          </div>
        </div>
      )}

      {!showConfirm && (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <Btn variant="gray" onClick={onClose}>Cancel</Btn>
          <Btn
            onClick={onBehalf && targets.length > 0 ? () => setShowConfirm(true) : handleSubmit}
            disabled={!canSubmit || busy}>
            {uploadMsg || (busy ? "Submitting..." : onBehalf && targets.length > 0 ? `Submit for ${targets.length} people` : "Submit Request")}
          </Btn>
        </div>
      )}
    </Modal>
  );
}
