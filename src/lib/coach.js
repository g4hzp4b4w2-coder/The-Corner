async function callCoach(payload) {
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with ${res.status}`);
  }
  return res.json();
}

export function getJournalTip({ profile, entries, lang }) {
  return callCoach({ mode: "journal-tip", profile, entries, lang });
}

export function getQuickCheckin({ focus, lang }) {
  return callCoach({ mode: "quick-checkin", focus, lang });
}
