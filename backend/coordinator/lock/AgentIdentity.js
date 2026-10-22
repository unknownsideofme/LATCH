/**
 * Agent identity comparator (agentId is `label:host:session`).
 */
class AgentIdentity {
  static sameOwner(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const pa = String(a).split(":");
    const pb = String(b).split(":");
    const sameHost = (pa[1] || "").toLowerCase() === (pb[1] || "").toLowerCase();
    if (!sameHost) return false;

    const sa = (pa[2] || "").toLowerCase();
    const sb = (pb[2] || "").toLowerCase();
    const known = (s) => s !== "" && s !== "local";

    // When both sides name a real session, the session decides and the label is irrelevant
    if (known(sa) && known(sb)) return sa === sb;

    // At least one side never told us its session, fall back to label
    return pa[0] === pb[0];
  }

  static parseSessionId(agentId) {
    return String(agentId || "").split(":").slice(2).join(":");
  }
}

module.exports = {
  AgentIdentity,
  sameOwner: AgentIdentity.sameOwner,
};
