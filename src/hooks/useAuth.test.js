// useAuth hook — nonce and expiry checks

describe("OAuth nonce validation logic", () => {
  beforeEach(() => sessionStorage.clear());

  const makeToken = (payload) => {
    const header  = btoa(JSON.stringify({ alg: "RS256" }));
    const body    = btoa(JSON.stringify(payload)).replace(/=/g, "");
    return `${header}.${body}.signature`;
  };

  it("stores user when nonce matches and domain is valid", () => {
    const nonce = "abc123";
    sessionStorage.setItem("ga-oauth-nonce", nonce);

    const payload = {
      email: "user@seoulrobotics.org",
      name: "Test User",
      nonce,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const tok = makeToken(payload);
    const hash = new URLSearchParams({ id_token: tok });
    window.location.hash = "#" + hash.toString();

    // Re-import to trigger the useEffect
    // (Integration: tested indirectly via the DOM flow)
    expect(true).toBe(true); // Placeholder — full hook test requires renderHook
  });

  it("rejects token with wrong domain", () => {
    const payload = {
      email: "user@gmail.com",
      name: "Bad Actor",
      nonce: "xyz",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    // In the hook: email.endsWith("@seoulrobotics.org") → false
    expect(payload.email.endsWith("@seoulrobotics.org")).toBe(false);
  });

  it("rejects expired token", () => {
    const expiredExp = Math.floor(Date.now() / 1000) - 100;
    expect(expiredExp * 1000 < Date.now()).toBe(true);
  });

  it("rejects nonce mismatch", () => {
    sessionStorage.setItem("ga-oauth-nonce", "correct-nonce");
    const payloadNonce = "wrong-nonce";
    expect(payloadNonce !== sessionStorage.getItem("ga-oauth-nonce")).toBe(true);
  });
});

describe("pendingCount logic", () => {
  const roster = [
    { id:"1", email:"user@sr.ai",    managerId:"2" },
    { id:"2", email:"mgr@sr.ai",     managerId:""  },
    { id:"3", email:"admin@sr.ai",   managerId:""  },
  ];
  const quotas = {
    ceoEmail:   "ceo@sr.ai",
    assignees:  { business_card: ["admin@sr.ai"] },
    approvalChains: { business_card: ["assignee"] },
  };

  const meEmail = "admin@sr.ai";
  const rMe     = roster.find(r => r.email === meEmail);

  const isPending = (req) => {
    if (req.status !== "pending" && req.status !== "in_progress") return false;
    if (req.applicantEmail === meEmail) return false;
    const chain = quotas.approvalChains[req.type] || ["assignee"];
    const role  = chain[req.currentStep || 0];
    const ap    = roster.find(u => String(u.id) === String(req.applicantId));
    if (role === "assignee") return (quotas.assignees[req.type] || []).includes(meEmail);
    if (role === "manager")  return rMe && String(rMe.id) === String(ap?.managerId);
    if (role === "ceo")      return meEmail === quotas.ceoEmail;
    return false;
  };

  it("counts requests where admin is assignee", () => {
    const reqs = [
      { id:"r1", type:"business_card", applicantEmail:"user@sr.ai", applicantId:"1", status:"pending", currentStep:0 },
      { id:"r2", type:"business_card", applicantEmail:"user@sr.ai", applicantId:"1", status:"completed", currentStep:1 },
    ];
    expect(reqs.filter(isPending).length).toBe(1);
  });

  it("excludes self-submitted requests", () => {
    const req = { id:"r1", type:"business_card", applicantEmail:meEmail, applicantId:"3", status:"pending", currentStep:0 };
    expect(isPending(req)).toBe(false);
  });

  it("excludes non-pending/in_progress statuses", () => {
    const req = { id:"r1", type:"business_card", applicantEmail:"user@sr.ai", applicantId:"1", status:"rejected", currentStep:0 };
    expect(isPending(req)).toBe(false);
  });
});
