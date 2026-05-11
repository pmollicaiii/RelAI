// RelAI V2 — Folder page (Search · Outreach · Profile)

function FolderPage({ folder, data, onBack }) {
  const [rawInput, setRawInput] = React.useState(
    "3-bed house in Fitler Square or Rittenhouse, under $900k, needs a garage and outdoor space. They love old homes with character.",
  );
  const [searched, setSearched] = React.useState(true);
  const [thinking, setThinking] = React.useState(false);
  const [view, setView] = React.useState("list"); // list | map
  const [selected, setSelected] = React.useState(new Set(["L01", "L03"]));
  const [hidden, setHidden] = React.useState(new Set());
  const [favorites, setFavorites] = React.useState(new Set(["L01"]));
  const [saves, setSaves] = React.useState(new Set(["L01", "L02"]));
  const [expandedId, setExpandedId] = React.useState(null);
  const [hidingId, setHidingId] = React.useState(null);
  const [ambiguity, setAmbiguity] = React.useState(data.ambiguity);
  const [showPacket, setShowPacket] = React.useState(false);
  const [criteria, setCriteria] = React.useState(data.extractedCriteria);

  // V2 additions —
  const [tab, setTab] = React.useState("search"); // search | outreach | profile
  const [smartOpen, setSmartOpen] = React.useState(false);
  const [chips, setChips] = React.useState(data.activeChips || []);

  function runSearch() {
    setThinking(true);
    setSearched(false);
    setTimeout(() => {
      setThinking(false);
      setSearched(true);
    }, 900);
  }

  function toggleSel(id) {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  }
  function toggleFav(id) {
    const n = new Set(favorites);
    n.has(id) ? n.delete(id) : n.add(id);
    setFavorites(n);
  }
  function toggleSave(id) {
    const n = new Set(saves);
    n.has(id) ? n.delete(id) : n.add(id);
    setSaves(n);
  }
  function hideListing(id, reason) {
    const n = new Set(hidden);
    n.add(id);
    setHidden(n);
    setHidingId(null);
  }

  const visible = data.listings.filter((l) => !hidden.has(l.id));

  return (
    <div className="content">
      <div className="page-head v2">
        <div className="page-head-l">
          <button
            className="crumb"
            onClick={onBack}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            ← Pulse · All folders
          </button>
          <h1>{folder.clientName}</h1>
          <p>{folder.notes}</p>
        </div>
        <FolderTabs
          active={tab}
          onChange={setTab}
          counts={{ outreach: (data.artifacts || []).length }}
        />
      </div>

      {tab === "outreach" && (
        <OutreachTab folder={folder} artifacts={data.artifacts || []} listings={data.listings} />
      )}
      {tab === "profile" && (
        <ProfileTab
          folder={folder}
          profileEvents={data.profileEvents || []}
          ledger={data.preferenceLedger}
        />
      )}

      {tab === "search" && (
        <div className="folder-page">
          <div className="folder-main">
            <div className="compose">
              <div className="lbl">What is {folder.clientName.split(" ")[0]} looking for?</div>
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="Describe in plain English…"
              />

              <div className="row">
                <span className="hint mono">⌘ + ENTER to search</span>
                <div className="spacer"></div>
                <button className="run" onClick={runSearch} disabled={!rawInput.trim() || thinking}>
                  <I.Search />
                  {thinking ? "Thinking…" : "Search"}
                  {!thinking && <span className="kbd">⏎</span>}
                </button>
              </div>
            </div>

            {searched && (
              <ExtractedBlock
                criteria={criteria}
                ambiguity={ambiguity}
                onResolveAmbig={(id) => {
                  setAmbiguity({
                    ...ambiguity,
                    options: ambiguity.options.map((o) => ({ ...o, picked: o.id === id })),
                  });
                }}
              />
            )}

            {thinking && (
              <div className="thinking">
                Reading {folder.clientName.split(" ")[0]}'s brief<span className="dots"></span>
                <br />
                <span
                  className="mono"
                  style={{ fontSize: 10.5, color: "var(--ink-4)", letterSpacing: "0.08em" }}
                >
                  PARSING · MATCHING · RERANKING WITH FOLDER TASTE
                </span>
              </div>
            )}

            {searched && !thinking && (
              <>
                <div className="results-hdr">
                  <div className="count serif">
                    Found <b>{visible.length} properties</b> for {folder.clientName.split(" ")[0]}.
                  </div>
                  <div className="spacer"></div>
                  <div className="view-toggle">
                    <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>
                      List
                    </button>
                    <button className={view === "map" ? "on" : ""} onClick={() => setView("map")}>
                      Map
                    </button>
                  </div>
                </div>

                {view === "list" ? (
                  <div>
                    {visible.map((l, i) => (
                      <ListingRow
                        key={l.id}
                        listing={l}
                        rank={i + 1}
                        selected={selected.has(l.id)}
                        favorite={favorites.has(l.id)}
                        saved={saves.has(l.id)}
                        expanded={expandedId === l.id}
                        hidingOpen={hidingId === l.id}
                        onToggleSel={() => toggleSel(l.id)}
                        onToggleFav={() => toggleFav(l.id)}
                        onToggleSave={() => toggleSave(l.id)}
                        onExpand={() => setExpandedId(expandedId === l.id ? null : l.id)}
                        onOpenHide={() => setHidingId(hidingId === l.id ? null : l.id)}
                        onHide={(reason) => hideListing(l.id, reason)}
                      />
                    ))}
                  </div>
                ) : (
                  <MapView listings={visible} selectedId={expandedId} onSelect={setExpandedId} />
                )}

                {selected.size > 0 && (
                  <div className="selbar">
                    <span className="count">
                      <b>{selected.size}</b> listing{selected.size === 1 ? "" : "s"} selected for{" "}
                      {folder.clientName.split(" ")[0]}
                    </span>
                    <div className="spacer"></div>
                    <button onClick={() => setSelected(new Set())}>Deselect</button>
                    <button className="primary" onClick={() => setShowPacket(true)}>
                      <I.FileText /> Preview packet
                    </button>
                    <button>
                      <I.Mail /> Draft email
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <aside className="rail">
            <SmartControlSummary chips={chips} folder={folder} onOpen={() => setSmartOpen(true)} />

            <TasteCard folder={folder} />
            <LedgerCard ledger={data.preferenceLedger} />
          </aside>
        </div>
      )}

      <SmartControlPanel
        open={smartOpen}
        onClose={() => setSmartOpen(false)}
        folder={folder}
        chips={chips}
        setChips={setChips}
        chipLibrary={data.chipLibrary || []}
        chipCategories={data.chipCategories || []}
      />

      {showPacket && (
        <PacketModal
          folder={folder}
          listings={data.listings.filter((l) => selected.has(l.id))}
          onClose={() => setShowPacket(false)}
        />
      )}
    </div>
  );
}

function ExtractedBlock({ criteria, ambiguity, onResolveAmbig }) {
  const conf = Math.round(criteria.confidence * 100);
  return (
    <div className="extracted">
      <div className="hdr">
        <span className="title">Extracted criteria</span>
        <span className="badge conf mono">{conf}% CONFIDENCE</span>
        {criteria.ambiguities.length > 0 && (
          <span className="badge amb mono">{criteria.ambiguities.length} UNCLEAR</span>
        )}
        <span className="spacer"></span>
        <span className="toggle">what the AI heard</span>
      </div>
      <div className="chips">
        {criteria.hard.locations.map((l) => (
          <span key={l} className="chip-criteria extr">
            {l} <span className="x">×</span>
          </span>
        ))}
        <span className="chip-criteria extr">
          ≤ ${(criteria.hard.priceMax / 1000).toFixed(0)}k <span className="x">×</span>
        </span>
        <span className="chip-criteria extr">
          {criteria.hard.bedsMin}+ bd <span className="x">×</span>
        </span>
        <span className="chip-criteria extr">
          {criteria.hard.bathsMin}+ ba <span className="x">×</span>
        </span>
        <span className="chip-criteria extr">
          Garage <span className="x">×</span>
        </span>
        <span className="chip-criteria ambig">outdoor — yard, balcony, or roof deck?</span>
        <span className="chip-criteria soft">"pre-war character"</span>
        <span className="chip-criteria soft">"outdoor space"</span>
        <span className="chip-criteria add">+ add criterion</span>
      </div>
      {ambiguity && (
        <div className="ambig-resolver">
          <div className="q">{ambiguity.question}</div>
          <div className="opts">
            {ambiguity.options.map((o) => (
              <button
                key={o.id}
                className={"opt " + (o.picked ? "pick" : "")}
                onClick={() => onResolveAmbig(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="meta mono">RESOLVING WILL RE-RANK · SAVES TO FOLDER SOFT-PREFS</div>
        </div>
      )}
    </div>
  );
}

function ListingRow({
  listing,
  rank,
  selected,
  favorite,
  saved,
  expanded,
  hidingOpen,
  onToggleSel,
  onToggleFav,
  onToggleSave,
  onExpand,
  onOpenHide,
  onHide,
}) {
  const l = listing;
  const priceFmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(l.price);
  const cls = l.match >= 85 ? "hi" : l.match >= 75 ? "mid" : "lo";

  const whySpans = [];
  let txt = l.remarks;
  (l.whyHighlights || []).forEach(([phrase]) => {
    const idx = txt.toLowerCase().indexOf(phrase.toLowerCase());
    if (idx >= 0) {
      whySpans.push(<span key={phrase + "p"}>{txt.slice(0, idx)}</span>);
      whySpans.push(
        <span key={phrase} className="hl">
          {txt.slice(idx, idx + phrase.length)}
        </span>,
      );
      txt = txt.slice(idx + phrase.length);
    }
  });
  whySpans.push(<span key="rest">{txt}</span>);

  return (
    <div className={"listing " + (selected ? "sel" : "")}>
      <div className="top">
        <div className="rank serif">{String(rank).padStart(2, "0")}</div>
        <div
          className={"photo " + (l.photos[0] || "")}
          onClick={onToggleSel}
          style={
            l.photoUrls && l.photoUrls[0]
              ? {
                  backgroundImage: `url('${l.photoUrls[0]}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {!(l.photoUrls && l.photoUrls[0]) && <span className="note">PHOTO · MLS FEED</span>}
          {l.photoUrls && l.photoUrls.length > 1 && (
            <span className="photo-count mono">+{l.photoUrls.length - 1}</span>
          )}
        </div>
        <div className="body" onClick={onToggleSel} style={{ cursor: "pointer" }}>
          <div className="priceline">
            <span className="price">{priceFmt}</span>
            {favorite && <span style={{ color: "var(--rose)", fontSize: 11 }}>♥ Favorite</span>}
            {saved && !favorite && (
              <span style={{ color: "var(--accent)", fontSize: 11 }}>● Saved</span>
            )}
          </div>
          <div className="addr">
            {l.address} · {l.neighborhood} · {l.zip}
          </div>
          <div className="stats mono">
            <b>{l.beds}</b> BD · <b>{l.baths}</b> BA · <b>{l.sqft.toLocaleString()}</b> SF · BUILT{" "}
            <b>{l.yearBuilt}</b> · {l.dom}d ON MARKET
          </div>
          <div className="why">{whySpans}</div>
          {l.stretch && <div className="stretch">⚠ {l.stretch}</div>}
          {l.negotiable && (
            <div
              className="stretch"
              style={{ background: "var(--moss-soft)", color: "var(--moss)" }}
            >
              ↓ {l.negotiable}
            </div>
          )}
        </div>
        <div className="right">
          <button className="match" onClick={onExpand} title="Click to explain">
            <div className={"num " + cls}>{l.match}</div>
            <div className="lbl">
              MATCH <span className="info">ⓘ</span>
            </div>
          </button>
          <div className="actions">
            <button
              className={"fav " + (favorite ? "on" : "")}
              onClick={onToggleFav}
              title="Favorite"
            >
              <I.Heart filled={favorite} />
            </button>
            <button className={"save " + (saved ? "on" : "")} onClick={onToggleSave} title="Save">
              <I.Bookmark filled={saved} />
            </button>
            <button onClick={onOpenHide} title="Hide">
              <I.EyeOff />
            </button>
          </div>
        </div>
      </div>
      {expanded && <ScoreExplain listing={l} />}
      {hidingOpen && (
        <div className="hide-reasons">
          <div className="q">Why hide {l.address.split(",")[0]}?</div>
          <div className="opts">
            {[
              "Wrong block / neighborhood",
              "Too small",
              "Bad light / photos",
              "Tenant-occupied",
              "Already seen it",
              "Wrong property type",
              "Other…",
            ].map((r) => (
              <button key={r} className="opt" onClick={() => onHide(r)}>
                {r}
              </button>
            ))}
          </div>
          <div className="meta">FEEDS FOLDER EMBEDDING · SOURCE = AGENT-TAG (AUTHORITY 2/4)</div>
        </div>
      )}
    </div>
  );
}

function ScoreExplain({ listing: l }) {
  const rows = [
    { k: "Price", v: l.priceScore, c: "" },
    { k: "Location", v: l.locationScore, c: "" },
    { k: "Beds", v: l.bedsScore, c: "" },
    { k: "Baths", v: l.bathsScore, c: "" },
    { k: "Features", v: l.featureScore, c: "" },
    { k: "Semantic", v: l.semantic, c: "orange" },
  ];

  const prefSign = l.preferenceBoost >= 0 ? "+" : "−";
  return (
    <div className="explain">
      <div className="hdr">
        <span>
          HEURISTIC <b>{l.heuristic.toFixed(2)}</b>
        </span>
        <span>·</span>
        <span>
          SEMANTIC <b>{l.semantic.toFixed(2)}</b>
        </span>
        <span>·</span>
        <span>
          BLEND <b>w = 0.20</b>
        </span>
      </div>
      <div className="rows">
        {rows.map((r) => (
          <div key={r.k} className="explain-row">
            <span className="lbl">{r.k}</span>
            <div className="track">
              <div className={"fill " + r.c} style={{ width: r.v * 100 + "%" }}></div>
            </div>
            <span className="val">{r.v.toFixed(2)}</span>
          </div>
        ))}
        <div className="explain-row">
          <span className="lbl">Pref boost</span>
          <div className="track">
            <div
              className={"fill " + (l.preferenceBoost >= 0 ? "moss" : "rose")}
              style={{ width: Math.abs(l.preferenceBoost) * 500 + "%" }}
            ></div>
          </div>
          <span className={"val " + (l.preferenceBoost >= 0 ? "up" : "dn")}>
            {prefSign}
            {Math.abs(l.preferenceBoost).toFixed(2)}
          </span>
        </div>
        <div className="explain-row sum">
          <span className="lbl">Final match</span>
          <div className="track">
            <div className="fill" style={{ width: l.match + "%" }}></div>
          </div>
          <span className="val">{l.match}</span>
        </div>
      </div>
      <div className="explain-foot">
        SEMANTIC STATE:{" "}
        <span className={"tag " + l.semanticState}>{l.semanticState.toUpperCase()}</span>· "applied"
        means the model compared this listing's text to the folder's taste vector and returned a
        similarity score.
      </div>
    </div>
  );
}

// Smart Control summary card — sits at top of right rail. Shows the
// current chip clusters as a tight visual, with one button to open the
// full SmartControlPanel for editing.
function SmartControlSummary({ chips, folder, onOpen }) {
  const positives = chips.filter((c) => c.polarity === "positive");
  const avoidances = chips.filter((c) => c.polarity === "avoidance");
  const top3pos = positives.slice(0, 4);
  const top3avo = avoidances.slice(0, 3);
  return (
    <div className="card sc-summary">
      <div className="sc-summary-hdr">
        <h6 style={{ margin: 0, flex: 1 }}>Smart Control</h6>
        <button
          className="sc-summary-edit"
          onClick={onOpen}
          style={{ backgroundColor: "rgb(55, 107, 182)", color: "rgb(250, 250, 250)" }}
        >
          Edit →
        </button>
      </div>
      <div className="sc-summary-row">
        <div className="sc-summary-col">
          <div className="sc-summary-eyebrow up mono">↑ POSITIVES · {positives.length}</div>
          <div className="sc-summary-chips">
            {top3pos.map((c) => (
              <span key={c.id} className="sc-chip mini positive">
                {c.label}
              </span>
            ))}
            {positives.length > top3pos.length && (
              <span className="sc-chip mini more">+{positives.length - top3pos.length}</span>
            )}
          </div>
        </div>
        <div className="sc-summary-col">
          <div className="sc-summary-eyebrow dn mono">↓ AVOIDANCES · {avoidances.length}</div>
          <div className="sc-summary-chips">
            {top3avo.length === 0 && <span className="sc-summary-empty">none yet</span>}
            {top3avo.map((c) => (
              <span key={c.id} className="sc-chip mini avoidance">
                {c.label}
              </span>
            ))}
            {avoidances.length > top3avo.length && (
              <span className="sc-chip mini more">+{avoidances.length - top3avo.length}</span>
            )}
          </div>
        </div>
      </div>
      <div className="sc-summary-foot mono">TASTE VECTOR · LIVE · CLICK EDIT TO RE-RANK</div>
    </div>
  );
}

function TasteCard({ folder }) {
  const bars = folder.tasteBars || [
    { k: "Pre-war stock", v: 0.88 },
    { k: "Private outdoor", v: 0.82 },
    { k: "Walkability", v: 0.74 },
    { k: "Quiet street", v: 0.61 },
    { k: "New construction", v: 0.18 },
  ];

  const sig = folder.signals || {};
  return (
    <div className="card">
      <h6>{folder.clientName.split(" ")[0]}'s taste · live</h6>
      <div className="taste-head">{folder.tasteHeadline}</div>
      <div className="taste-sub">
        Built from {folder.savedCount} saves, {folder.favoriteCount} favorites, and 3 hides across 3
        searches.
      </div>
      {bars.map((b) => (
        <div key={b.k} className="bar-row">
          <span className="lbl">{b.k}</span>
          <div className="tk">
            <span style={{ width: b.v * 100 + "%" }}></span>
          </div>
          <span className="val">{b.v.toFixed(2)}</span>
        </div>
      ))}
      <div className="signal-row">
        <span className="p hot">explicit · {sig.explicit ?? 2}</span>
        <span className="p">agent-tag · {sig.agentTag ?? 3}</span>
        <span className="p">pitched · {sig.pitched ?? 2}</span>
        <span className="p">soft-pref · {sig.softPref ?? 8}</span>
      </div>
    </div>
  );
}

function LedgerCard({ ledger }) {
  return (
    <div className="card">
      <h6>Preference ledger</h6>
      <div className="ledger">
        {ledger.map((r, i) => (
          <div key={i} className="row">
            <div className="k">
              {r.k} <em>{r.delta}</em>
            </div>
            <div className="v">
              <span className={"dir " + r.dir}>{r.dir === "up" ? "↑ boost" : "↓ penalty"}</span>
              <span className="src">{r.src}</span>
              <button className="undo">undo</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MapView({ listings, selectedId, onSelect }) {
  return (
    <div className="mapview">
      <div className="m-left">
        {listings.map((l, i) => (
          <div
            key={l.id}
            className={"item " + (selectedId === l.id ? "active" : "")}
            onClick={() => onSelect(l.id)}
          >
            <div className={"thumb " + (l.photos[0] || "")}></div>
            <div>
              <div className="px">
                ${(l.price / 1000).toFixed(0)}k <span className="match">MATCH {l.match}</span>
              </div>
              <div className="addr">
                {l.address.split(",")[0]} · {l.neighborhood}
              </div>
              <div className="stats">
                {l.beds} BD · {l.baths} BA · {l.sqft.toLocaleString()} SF · {l.dom}d
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="m-canvas">
        <div className="grid"></div>
        <div className="river"></div>
        <div className="road" style={{ left: 0, right: 0, top: "32%", height: "3px" }}></div>
        <div className="road" style={{ left: 0, right: 0, top: "68%", height: "3px" }}></div>
        <div className="road" style={{ top: 0, bottom: 0, left: "36%", width: "3px" }}></div>
        <div className="road" style={{ top: 0, bottom: 0, left: "68%", width: "3px" }}></div>
        <div className="label" style={{ top: "22%", left: "8%" }}>
          Schuylkill R.
        </div>
        <div className="label" style={{ top: "12%", left: "44%" }}>
          Rittenhouse Sq
        </div>
        <div className="label" style={{ top: "56%", left: "14%" }}>
          Fitler Square
        </div>
        <div className="label" style={{ top: "76%", left: "50%" }}>
          Graduate Hosp.
        </div>
        {listings.map((l, i) => (
          <button
            key={l.id}
            className={"pin " + (i === 0 ? "hot " : "") + (selectedId === l.id ? "active" : "")}
            style={{ left: l.lng * 100 + "%", top: l.lat * 100 + "%" }}
            onClick={() => onSelect(l.id)}
          >
            {i + 1} · {l.match}
          </button>
        ))}
      </div>
    </div>
  );
}

function PacketModal({ folder, listings, onClose }) {
  const [opts, setOpts] = React.useState({
    cover: true,
    photos: true,
    remarks: true,
    walkscore: false,
    compare: true,
  });
  const toggle = (k) => setOpts({ ...opts, [k]: !opts[k] });
  const pageCount = (opts.cover ? 1 : 0) + listings.length + (opts.compare ? 1 : 0);

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-hdr">
          <div className="t">Packet for {folder.clientName.split(" ")[0]}.</div>
          <div className="sub mono">
            {pageCount} PAGES · {listings.length} LISTINGS
          </div>
          <button className="close" onClick={onClose}>
            <I.X />
          </button>
        </div>
        <div className="m-body">
          <div className="preview-area">
            <div className="pages">
              {opts.cover && (
                <div className="preview-page cover">
                  <div className="eyebrow">April 20 · Curated for</div>
                  <div className="hdr-serif" style={{ marginTop: 4 }}>
                    {folder.clientName}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div className="lines">
                      <span className="l"></span>
                      <span className="m"></span>
                      <span className="l"></span>
                      <span className="s"></span>
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 6.5,
                      fontStyle: "italic",
                      color: "var(--ink-3)",
                    }}
                  >
                    "Three Fitler Square rowhomes I think you'll love, plus two Rittenhouse
                    trinities worth a second look."
                  </div>
                  <div className="foot">
                    <span>RELAI</span>
                    <span>COVER</span>
                  </div>
                </div>
              )}
              {listings.map((l, i) => (
                <div key={l.id} className="preview-page">
                  <div className="eyebrow">
                    No. {String(i + 1).padStart(2, "0")} · match {l.match}
                  </div>
                  <div className={"img " + (l.photos[0] || "")}></div>
                  <div className="big">{l.address.split(",")[0]}</div>
                  <div className="med">
                    ${(l.price / 1000).toFixed(0)}k · {l.beds}bd · {l.baths}ba ·{" "}
                    {l.sqft.toLocaleString()} SF
                  </div>
                  {opts.remarks && (
                    <div className="lines" style={{ marginTop: 5 }}>
                      <span className="l"></span>
                      <span className="m"></span>
                      <span className="s"></span>
                    </div>
                  )}
                  <div className="foot">
                    <span>{l.neighborhood}</span>
                    <span>P. {i + (opts.cover ? 2 : 1)}</span>
                  </div>
                </div>
              ))}
              {opts.compare && (
                <div className="preview-page">
                  <div className="eyebrow">Side-by-side</div>
                  <div className="hdr-serif" style={{ fontSize: 9, marginTop: 3 }}>
                    Comparison
                  </div>
                  <div className="lines" style={{ marginTop: 6 }}>
                    <span className="l"></span>
                    <span className="l"></span>
                    <span className="l"></span>
                    <span className="m"></span>
                    <span className="m"></span>
                    <span className="m"></span>
                    <span className="s"></span>
                  </div>
                  <div className="foot">
                    <span>COMPARE</span>
                    <span>P. {pageCount}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="controls">
            <h5>Sections</h5>
            <div className={"opt " + (opts.cover ? "on" : "")} onClick={() => toggle("cover")}>
              <div className="ck">{opts.cover && <I.Check />}</div>
              Personalized cover letter
            </div>
            <div className={"opt " + (opts.photos ? "on" : "")} onClick={() => toggle("photos")}>
              <div className="ck">{opts.photos && <I.Check />}</div>
              Include MLS photos
            </div>
            <div className={"opt " + (opts.remarks ? "on" : "")} onClick={() => toggle("remarks")}>
              <div className="ck">{opts.remarks && <I.Check />}</div>
              Public remarks (PII-redacted)
            </div>
            <div
              className={"opt " + (opts.walkscore ? "on" : "")}
              onClick={() => toggle("walkscore")}
            >
              <div className="ck">{opts.walkscore && <I.Check />}</div>
              Walk score + commute times
            </div>
            <div className={"opt " + (opts.compare ? "on" : "")} onClick={() => toggle("compare")}>
              <div className="ck">{opts.compare && <I.Check />}</div>
              Side-by-side comparison
            </div>
            <div className="meta mono">
              ~1.8 MB · READY IN 2–4s
              <br />
              <br />
              RelAI will write the cover letter by summarizing why these {listings.length} listings
              suit {folder.clientName.split(" ")[0]}'s taste profile.
            </div>
          </div>
        </div>
        <div className="m-foot">
          <span className="status mono">● ready to generate</span>
          <button className="cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="generate">Generate packet →</button>
        </div>
      </div>
    </div>
  );
}

window.FolderPage = FolderPage;
