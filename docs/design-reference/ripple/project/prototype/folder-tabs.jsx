// folder-tabs.jsx
//
// V2 additions to the folder page: top-of-page tabs (Search · Outreach · Profile),
// and the content for the Outreach + Profile tabs. Search tab content stays in
// folder.jsx; this file plugs in next to it.

const FT = (() => {

  function Tabs({ active, onChange, counts }) {
    const tabs = [
      { id: "search",   label: "Search",   sub: "find listings" },
      { id: "outreach", label: "Outreach", sub: "packets · emails", count: counts.outreach },
      { id: "profile",  label: "Profile",  sub: "what we know" },
    ];
    return (
      <div className="ft-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={"ft-tab " + (active === t.id ? "active" : "")}
            onClick={() => onChange(t.id)}
          >
            <span className="ft-tab-label">{t.label}</span>
            <span className="ft-tab-sub">{t.sub}</span>
            {t.count != null && t.count > 0 && (
              <span className="ft-tab-count mono">{t.count}</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // ─── Outreach tab ──────────────────────────────────────────────────
  function OutreachTab({ folder, artifacts, listings }) {
    const [filter, setFilter] = React.useState("all");
    const filtered = artifacts.filter(a =>
      filter === "all" ? true :
      filter === "pdf" ? a.kind === "pdf" :
      filter === "email" ? a.kind === "email" : true
    );

    return (
      <div className="ft-outreach">
        <div className="ft-section-hdr">
          <div>
            <div className="ft-section-title serif">Outreach for {folder.clientName.split(" ")[0]}.</div>
            <div className="ft-section-sub">
              Packets RelAI generated, emails it drafted, and what {folder.clientName.split(" ")[0]} actually opened.
            </div>
          </div>
          <div className="ft-segctl">
            {[
              ["all", "All", artifacts.length],
              ["pdf", "Packets", artifacts.filter(a => a.kind === "pdf").length],
              ["email", "Emails", artifacts.filter(a => a.kind === "email").length],
            ].map(([id, lbl, n]) => (
              <button key={id} className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>
                {lbl} <span className="mono ct">{n}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="ft-artifact-grid">
          {filtered.map(a => <ArtifactCard key={a.id} a={a} listings={listings}/>)}
          <div className="ft-artifact-new">
            <div className="ft-artifact-new-icon">＋</div>
            <div className="ft-artifact-new-l1 serif">New artifact</div>
            <div className="ft-artifact-new-l2">Generate a packet or draft an email from any saved listings.</div>
            <div className="ft-artifact-new-actions">
              <button className="ghost">Draft email</button>
              <button className="primary">New packet →</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function ArtifactCard({ a, listings }) {
    const isPdf = a.kind === "pdf";
    return (
      <div className="ft-artifact">
        <div className="ft-artifact-hdr">
          <span className={"ft-artifact-kind " + a.kind}>
            {isPdf ? "PACKET · PDF" : "EMAIL · DRAFT"}
          </span>
          <span className="ft-artifact-time mono">{a.createdAt}</span>
        </div>
        <div className="ft-artifact-title serif">{a.title}</div>
        <div className="ft-artifact-sub">{a.subtitle}</div>

        {isPdf && (
          <div className="ft-artifact-preview pdf">
            <div className="ft-artifact-mini">
              <div className="ft-artifact-mini-eyebrow mono">RELAI · COVER</div>
              <div className="ft-artifact-mini-hdr serif">For {a.title.split("—")[0].trim()}</div>
              <div className="ft-artifact-mini-lines">
                <span className="l"></span><span className="m"></span><span className="l"></span><span className="s"></span>
              </div>
            </div>
            <div className="ft-artifact-mini">
              <div className="ft-artifact-mini-img"></div>
              <div className="ft-artifact-mini-pricerow">
                <span>$849k</span>
                <span className="mono">M 92</span>
              </div>
            </div>
            <div className="ft-artifact-mini">
              <div className="ft-artifact-mini-img alt"></div>
              <div className="ft-artifact-mini-pricerow">
                <span>$795k</span>
                <span className="mono">M 86</span>
              </div>
            </div>
          </div>
        )}

        {!isPdf && (
          <div className="ft-artifact-preview email">
            <div className="ft-email-line"><b>Subject:</b> {a.title}</div>
            <div className="ft-email-line"><b>To:</b> sarah.johnson@…</div>
            <div className="ft-email-body">
              "Hi Sarah — two from this week I think you'll love. <span className="ft-hl">2412 Pine</span> hits everything: Fitler Square, garage, private patio. <span className="ft-hl">318 S 22nd</span> is older stock with a courtyard, and worth a look despite 27 days on market."
            </div>
          </div>
        )}

        <div className="ft-artifact-meta">
          {isPdf && (
            <>
              <span className="ft-meta-item"><b>{a.pages}</b> pages</span>
              <span className="ft-meta-item">{a.sizeMb} MB</span>
            </>
          )}
          {!isPdf && (
            <span className="ft-meta-item"><b>{a.sentenceCount}</b> sentences</span>
          )}
          {a.openedByClient ? (
            <span className="ft-meta-open">
              <span className="ft-dot ok"></span>
              Opened · viewed {a.viewedListings} listing{a.viewedListings === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="ft-meta-open">
              <span className="ft-dot dim"></span>
              Not opened yet
            </span>
          )}
        </div>

        <div className="ft-artifact-actions">
          <button className="ghost">Duplicate</button>
          <button className="ghost">Open</button>
          {!isPdf && <button className="primary">Send →</button>}
          {isPdf && <button className="primary">Share link</button>}
        </div>
      </div>
    );
  }

  // ─── Profile tab ───────────────────────────────────────────────────
  function ProfileTab({ folder, profileEvents, ledger }) {
    return (
      <div className="ft-profile">
        <div className="ft-profile-hero">
          <div className="ft-profile-hero-l">
            <div className="ft-profile-eyebrow mono">PROFILE · LIVE</div>
            <div className="ft-profile-name serif">{folder.clientName}</div>
            <div className="ft-profile-headline serif">{folder.tasteHeadline}</div>
            <div className="ft-profile-notes">
              {folder.notes}
            </div>
            <div className="ft-profile-stats">
              <div className="ft-stat">
                <div className="ft-stat-num mono">{folder.savedCount}</div>
                <div className="ft-stat-lbl">saves</div>
              </div>
              <div className="ft-stat">
                <div className="ft-stat-num mono">{folder.favoriteCount}</div>
                <div className="ft-stat-lbl">favorites</div>
              </div>
              <div className="ft-stat">
                <div className="ft-stat-num mono">{folder.packets}</div>
                <div className="ft-stat-lbl">packets sent</div>
              </div>
              <div className="ft-stat">
                <div className="ft-stat-num mono">{folder.lastActivity}</div>
                <div className="ft-stat-lbl">last touch</div>
              </div>
            </div>
          </div>
          <div className="ft-profile-hero-r">
            <div className="ft-profile-pulse">
              <div className={"ft-pulse-dot " + folder.pulse}></div>
              <div>
                <div className="ft-pulse-eyebrow mono">SIGNAL · {folder.pulse.toUpperCase()}</div>
                <div className="ft-pulse-text">{folder.pulseLabel}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="ft-profile-grid">
          <section className="ft-profile-col">
            <h6 className="ft-profile-h6">What RelAI has learned</h6>
            <div className="ft-ledger-v2">
              {ledger.map((r, i) => (
                <div key={i} className={"ft-ledger-row " + r.dir}>
                  <div className="ft-ledger-row-l">
                    <span className={"ft-ledger-dir " + r.dir}>{r.dir === "up" ? "↑" : "↓"}</span>
                    <span className="ft-ledger-k">{r.k}</span>
                  </div>
                  <div className="ft-ledger-row-r">
                    <span className={"ft-ledger-delta " + r.dir}>{r.delta}</span>
                    <span className="ft-ledger-src">{r.src}</span>
                    <span className="ft-ledger-auth mono">A{r.auth}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="ft-profile-foot mono">
              AUTHORITY: A1 EXPLICIT · A2 AGENT-TAG · A3 SAVE/FAV · A4 IMPLICIT
            </div>
          </section>

          <section className="ft-profile-col">
            <h6 className="ft-profile-h6">Activity</h6>
            <div className="ft-timeline">
              {profileEvents.map((e, i) => (
                <div key={i} className={"ft-tl-row k-" + e.kind}>
                  <div className="ft-tl-rail">
                    <span className="ft-tl-dot"></span>
                    {i < profileEvents.length - 1 && <span className="ft-tl-line"></span>}
                  </div>
                  <div className="ft-tl-body">
                    <div className="ft-tl-text">{e.text}</div>
                    <div className="ft-tl-time mono">{e.ts}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return { Tabs, OutreachTab, ProfileTab };
})();

window.FolderTabs = FT.Tabs;
window.OutreachTab = FT.OutreachTab;
window.ProfileTab = FT.ProfileTab;
