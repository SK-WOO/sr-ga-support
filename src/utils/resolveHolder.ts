export default function resolveHolder(role, reqType, applicantId, roster, quotas) {
  if (role === "assignee") {
    const emails = (quotas?.assignees?.[reqType] || []);
    if (emails.length === 0) return "담당자 미지정";
    return emails.map(e => {
      const r = roster.find(u => u.email === e);
      return r ? r.name : e.split("@")[0];
    }).join(", ");
  }
  if (role === "manager") {
    const ap = roster.find(r => String(r.id) === String(applicantId));
    const mg = ap ? roster.find(r => String(r.id) === String(ap.managerId)) : null;
    return mg ? mg.name : "매니저 미지정";
  }
  if (role === "ceo") {
    const ceo = roster.find(r => r.email === (quotas?.ceoEmail || ""));
    return ceo ? ceo.name : "CEO";
  }
  return role;
}
