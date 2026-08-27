// ══════════════════════════════════════════════════════════════
//  LIVRABLE APP v2 — Composant canonique unique (tous PAC)
//  Flux : Évaluation formative → Reprise → Débrief final → Portfolio
//  Lit tout depuis window.PAC_CONFIG. Aucun prompt hardcodé.
// ══════════════════════════════════════════════════════════════

const { useState: useLivState, useEffect: useLivEffect } = React;
const _wc = (t) => (t || "").trim() ? (t || "").trim().split(/\s+/).length : 0;

// ── Markdown-lite : rendu sécurisé (échappement HTML systématique) ──
// Supporte : **gras**, *italique*, listes (- / 1.), tableaux (| a | b |).
const _mdEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const _mdInline = (s) => s
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/\*([^*]+)\*/g, "<em>$1</em>");

function _mdToHtml(raw) {
  const lines = _mdEsc(raw || "").split(/\r?\n/);
  const out = [];
  let i = 0;
  const isTableLine = (l) => /^\s*\|.*\|\s*$/.test(l);
  const isSep = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (isTableLine(l)) {
      const block = [];
      while (i < lines.length && isTableLine(lines[i])) { block.push(lines[i]); i++; }
      const hasSep = block.length > 1 && isSep(block[1]);
      const rows = block.filter(r => !isSep(r)).map(r => r.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(c => _mdInline(c.trim())));
      let html = "<table style=\"border-collapse:collapse;width:100%;margin:8px 0;font-size:12.5px\">";
      rows.forEach((cells, ri) => {
        const tag = (hasSep && ri === 0) ? "th" : "td";
        html += "<tr>" + cells.map(c => "<" + tag + " style=\"border:1px solid #d8d4cc;padding:5px 8px;text-align:left;vertical-align:top;" + (tag === "th" ? "background:#f0ede7;font-weight:700" : "") + "\">" + (c || "&nbsp;") + "</" + tag + ">").join("") + "</tr>";
      });
      html += "</table>";
      out.push(html);
      continue;
    }
    if (/^\s*[-*]\s+/.test(l)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(_mdInline(lines[i].replace(/^\s*[-*]\s+/, ""))); i++; }
      out.push("<ul style=\"margin:6px 0;padding-left:20px\">" + items.map(x => "<li>" + x + "</li>").join("") + "</ul>");
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(l)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(_mdInline(lines[i].replace(/^\s*\d+[.)]\s+/, ""))); i++; }
      out.push("<ol style=\"margin:6px 0;padding-left:20px\">" + items.map(x => "<li>" + x + "</li>").join("") + "</ol>");
      continue;
    }
    out.push(_mdInline(l) + "<br>");
    i++;
  }
  return out.join("");
}

// Comptage de mots : la syntaxe markdown (pipes, puces, séparateurs, astérisques) ne compte pas
const _stripMd = (t) => String(t || "")
  .replace(/^\s*\|[\s:|-]+\|\s*$/gm, "")
  .replace(/\|/g, " ")
  .replace(/^\s*[-*]\s+/gm, "")
  .replace(/^\s*\d+[.)]\s+/gm, "")
  .replace(/\*/g, "");
const _wcMd = (t) => _wc(_stripMd(t));

// ── Champ de saisie avec mise en forme (toolbar + aperçu) ──
function LivField({ title, count, min, placeholder, conseil, value, onChange, locked, rows, tableauModele }) {
  const [preview, setPreview] = useLivState(false);
  const taRef = React.useRef(null);
  const apply = (before, after, blockPrefix) => {
    const ta = taRef.current; if (!ta || locked) return;
    const v = value || "";
    const s = ta.selectionStart, e = ta.selectionEnd;
    let nv, ns, ne;
    if (blockPrefix) {
      const sel = v.slice(s, e) || "élément";
      const block = sel.split("\n").map(x => blockPrefix + x).join("\n");
      nv = v.slice(0, s) + block + v.slice(e);
      ns = s; ne = s + block.length;
    } else {
      const sel = v.slice(s, e) || "texte";
      nv = v.slice(0, s) + before + sel + after + v.slice(e);
      ns = s + before.length; ne = ns + sel.length;
    }
    onChange(nv);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(ns, ne); });
  };
  const insertBlock = (block) => {
    const ta = taRef.current; if (locked) return;
    const v = value || "";
    const s = (ta && ta.selectionStart != null) ? ta.selectionStart : v.length;
    const pre = v.slice(0, s), post = v.slice(s);
    onChange(pre + (pre && !pre.endsWith("\n") ? "\n\n" : "") + block + "\n" + post);
    if (ta) requestAnimationFrame(() => ta.focus());
  };
  const TBL = "| Colonne 1 | Colonne 2 | Colonne 3 |\n|---|---|---|\n|  |  |  |\n|  |  |  |";
  const btn = { border: "1px solid var(--rule)", background: "white", borderRadius: 5, padding: "3px 8px", fontSize: 11, cursor: "pointer", color: "var(--ink-soft)", fontFamily: "inherit" };
  return (
    <div style={{ background: "white", borderRadius: 10, padding: "16px 18px", marginBottom: 14, border: "1px solid var(--rule)", opacity: locked ? 0.7 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>
        <span title="Volume repère — indicatif, il ne bloque pas la remise" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: count >= min ? "#1a6641" : "var(--ink-faint)" }}>{count}/{min} mots<span style={{ opacity: 0.6 }}> repère</span></span>
      </div>
      {placeholder ? <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 8, lineHeight: 1.5 }}>{placeholder}</div> : null}
      {!locked ? (
        <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button style={{ ...btn, fontWeight: 700 }} title="Gras (**texte**)" onClick={() => apply("**", "**")}>B</button>
          <button style={{ ...btn, fontStyle: "italic" }} title="Italique (*texte*)" onClick={() => apply("*", "*")}>I</button>
          <button style={btn} title="Liste à puces" onClick={() => apply(null, null, "- ")}>• Liste</button>
          <button style={btn} title="Insérer un tableau vide" onClick={() => insertBlock(TBL)}>⊞ Tableau</button>
          {tableauModele ? (
            <button style={{ ...btn, borderColor: "#1a6641", color: "#1a6641", fontWeight: 600 }} title="Insérer la structure de tableau attendue pour cette compétence"
              onClick={() => insertBlock(tableauModele)}>⊞ Insérer le modèle attendu</button>
          ) : null}
          <span style={{ flex: 1 }} />
          <button style={{ ...btn, background: preview ? "#134547" : "white", color: preview ? "white" : "var(--ink-soft)", borderColor: preview ? "#134547" : "var(--rule)" }}
            onClick={() => setPreview(p => !p)}>{preview ? "✎ Éditer" : "👁 Aperçu"}</button>
        </div>
      ) : null}
      {preview && !locked ? (
        <div style={{ border: "1px dashed var(--rule)", borderRadius: 7, padding: "10px 12px", fontSize: 13, lineHeight: 1.55, minHeight: 90, background: "#fbfaf7" }}
          dangerouslySetInnerHTML={{ __html: _mdToHtml(value || "") || "<span style=\"color:#a8a294\">(vide)</span>" }} />
      ) : (
        <textarea ref={taRef} value={value || ""} onChange={e => onChange(e.target.value)} rows={rows || 5} disabled={locked}
          style={{ width: "100%", border: "1px solid var(--rule)", borderRadius: 7, padding: "9px 11px", fontSize: 13, fontFamily: "inherit", lineHeight: 1.55, resize: "vertical", outline: "none", background: locked ? "#f0f0f0" : "white" }} />
      )}
      {conseil ? <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 6, fontStyle: "italic" }}>💡 {conseil}</div> : null}
    </div>
  );
}


// ── F33 · Indicateur de sauvegarde ────────────────────────────
function SaveStatus() {
  const P = window.PAC_PERSIST;
  const [st, setSt] = useLivState(P ? P.status() : null);
  useLivEffect(() => {
    if (!P || !P.onChange) return;
    return P.onChange(s => setSt({ ...s }));
  }, []);

  if (!P) return null;

  if (st && st.ok === false) {
    return (
      <div style={{ background: "#fdecea", border: "1px solid #c4420f", borderRadius: 7, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, color: "#7a2408", lineHeight: 1.55 }}>
        <strong>⚠ Sauvegarde automatique interrompue.</strong> Votre copie n'est plus enregistrée sur le serveur.
        Copiez dès maintenant votre texte dans le Bloc-notes, puis prévenez votre référent de campus.
        Ne rechargez pas cette page.
      </div>
    );
  }

  const heure = st && st.lastSaved
    ? new Date(st.lastSaved).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div style={{ fontSize: 11, color: "var(--ink-faint)", marginBottom: 16, fontFamily: "var(--font-mono)" }}>
      {heure ? "✓ Copie enregistrée automatiquement · dernière sauvegarde " + heure
             : "✓ Copie enregistrée automatiquement au fil de la saisie"}
    </div>
  );
}

function LivrableApp() {
  const cfg = window.PAC_CONFIG || window.PASS_CONFIG || {};
  const comps = cfg.competences || [];
  const [answers, setAnswers] = useLivState({});
  const [reflexive, setReflexive] = useLivState("");
  const [sending, setSending] = useLivState(false);
  const [step, setStep] = useLivState("draft");       // draft | feedback | revision | debrief
  const [feedback, setFeedback] = useLivState("");     // retour formatif
  const [debrief, setDebrief] = useLivState("");       // débrief final
  const [err, setErr] = useLivState("");
  // F42 · Demande de confirmation lorsque la copie est sous le volume repère.
  const [confirmCourt, setConfirmCourt] = useLivState(false);
  const [sent, setSent] = useLivState("");

  // ══ F33 · Persistance de la copie ═══════════════════════════
  // La saisie du livrable ne survivait à aucun rechargement : plusieurs
  // heures de travail disparaissaient à la moindre touche F5. On restaure
  // la copie ET l'étape du flux (un retour formatif déjà reçu n'est pas
  // reperdu), puis on sauvegarde en différé à chaque frappe.
  // `hydrated` interdit toute écriture tant que la lecture n'a pas eu
  // lieu — sinon l'état vide du montage écraserait la copie enregistrée.
  const [hydrated, setHydrated] = useLivState(false);

  useLivEffect(() => {
    let annule = false;
    const P = window.PAC_PERSIST;
    if (!P) { setHydrated(true); return; }
    P.load().then(session => {
      if (annule) return;
      const L = (session && session.livrable) || null;
      if (L) {
        if (L.answers && typeof L.answers === 'object') setAnswers(L.answers);
        if (typeof L.reflexive === 'string') setReflexive(L.reflexive);
        if (typeof L.feedback === 'string') setFeedback(L.feedback);
        if (typeof L.debrief === 'string') setDebrief(L.debrief);
        // On ne restaure jamais vers une étape terminale par erreur :
        // seules les étapes réellement atteintes sont reprises.
        if (L.step === 'feedback' || L.step === 'revision' || L.step === 'debrief') setStep(L.step);
      }
      setHydrated(true);
    });
    return () => { annule = true; };
  }, []);

  const snapshotLivrable = () => ({
    answers, reflexive, step, feedback, debrief, savedAt: Date.now()
  });

  useLivEffect(() => {
    if (!hydrated || !window.PAC_PERSIST) return;
    window.PAC_PERSIST.save('livrable', snapshotLivrable());
  }, [hydrated, answers, reflexive, step, feedback, debrief]);

  // Filet : écriture immédiate si l'onglet se ferme en pleine rédaction.
  useLivEffect(() => {
    if (!window.PAC_PERSIST) return;
    const bye = () => { if (hydrated) window.PAC_PERSIST.flush('livrable', snapshotLivrable()); };
    window.addEventListener('beforeunload', bye);
    return () => window.removeEventListener('beforeunload', bye);
  }, [hydrated, answers, reflexive, step, feedback, debrief]);
  // ══ fin F33 ═════════════════════════════════════════════════

  const set = (code, v) => setAnswers(a => ({ ...a, [code]: v }));
  const totalMots = comps.reduce((n, c) => n + _wcMd(answers[c.code]), 0) + _wcMd(reflexive);
  const allMin = comps.every(c => _wcMd(answers[c.code]) >= (c.min || 0));
  const reflexiveOk = !cfg.note_reflexive || _wcMd(reflexive) >= (cfg.noteReflexiveMinMots || 0);

  // ══ F42 · Le volume ne verrouille plus la remise ═════════════
  // Constat de terrain (Vi, CESACOM Lille, 27/08) : une copie qui
  // identifiait la contradiction 230/180 — celle qui valide justement la
  // compétence visée — est restée non soumise, donc non évaluée, pour un
  // déficit de mots. Le format demandé aggrave le phénomène : une
  // plateforme de marque ou un plan média se rédigent en listes denses,
  // et plus la réponse est professionnelle, moins elle pèse de mots.
  // Un compteur ne peut pas être le portier d'une épreuve certifiante :
  // le jury évalue sur les critères RNCP et sait sanctionner une réponse
  // sous-développée. Le minimum devient donc un seuil RECOMMANDÉ,
  // signalé et confirmé, mais non bloquant.
  //
  // Seul subsiste un plancher anti-copie-vide, pour éviter de lancer une
  // évaluation sur des champs vides ou remplis au hasard.
  const PLANCHER_MOTS = 15;
  const plancherAtteint =
    comps.every(c => _wcMd(answers[c.code]) >= PLANCHER_MOTS) &&
    (!cfg.note_reflexive || _wcMd(reflexive) >= PLANCHER_MOTS);
  const videsOuTropCourts = comps
    .filter(c => _wcMd(answers[c.code]) < PLANCHER_MOTS)
    .map(c => c.code);

  const volumeAtteint = allMin && reflexiveOk && totalMots >= (cfg.livrableMinMots || 0);
  const canSubmit = plancherAtteint && !sending;
  // ══ fin F42 ═════════════════════════════════════════════════

  // ══ F38 · Bouton grisé sans explication ══════════════════════
  // Le bouton de soumission se débloque uniquement quand CHAQUE
  // compétence atteint son minimum de mots. Jusqu'ici, rien ne le disait :
  // l'étudiant·e voyait un bouton gris, muet, et concluait à une panne.
  // Il manquait parfois dix mots sur une seule rubrique. On liste
  // désormais précisément ce qui reste à écrire.
  const manquants = comps
    .filter(c => _wcMd(answers[c.code]) < (c.min || 0))
    .map(c => ({ code: c.code, manque: (c.min || 0) - _wcMd(answers[c.code]) }));
  const manqueReflexive = (cfg.note_reflexive && _wcMd(reflexive) < (cfg.noteReflexiveMinMots || 0))
    ? (cfg.noteReflexiveMinMots || 0) - _wcMd(reflexive)
    : 0;
  const manqueTotal = Math.max(0, (cfg.livrableMinMots || 0) - totalMots);
  // ══ fin F38 ═════════════════════════════════════════════════

  // ── Construire le texte de production ──
  const buildProd = () => {
    let prod = comps.map(c => "### " + c.code + " — " + c.label + "\n" + (answers[c.code] || "(vide)")).join("\n\n");
    if (cfg.note_reflexive) prod += "\n\n### Note réflexive\n" + (reflexive || "(vide)");
    return prod;
  };

  // ── Étape 1 : Évaluation formative ──
  const submitForFeedback = async () => {
    setSending(true); setErr("");
    try {
      const prod = buildProd();
      const systemPrompt = (cfg.juryPrompt || "Tu évalues la production sur les compétences listées.")
        + "\n\nIMPORTANT : Ceci est une évaluation formative. L'étudiant pourra reprendre sa copie. Sois précis sur les points à améliorer."
        + "\n\nNOTE FORMAT : les réponses peuvent contenir une mise en forme markdown légère (**gras**, *italique*, listes, tableaux délimités par |). Évalue le fond ; un tableau structuré et complet est un signe de professionnalisme, pas du remplissage.";
      const resp = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1600,
          system: systemPrompt,
          messages: [{ role: "user", content: "Voici la production à évaluer :\n\n" + prod }]
        })
      });
      if (!resp.ok) throw new Error("Évaluation indisponible (erreur " + resp.status + ").");
      const data = await resp.json();
      const txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      setFeedback(txt || "(réponse vide)");
      setStep("feedback");
    } catch (e) { setErr(e.message); }
    setSending(false);
  };

  // ── Étape 2 : Débrief final (après reprise) ──
  const submitFinal = async () => {
    setSending(true); setErr("");
    try {
      const prod = buildProd();
      const systemPrompt = (cfg.juryPrompt || "Tu évalues la production sur les compétences listées.")
        + "\n\nCeci est le débrief FINAL. L'étudiant a déjà reçu un retour formatif et a pu reprendre sa copie. Sois exigeant et conclusif. Donne un niveau global."
        + "\n\nNOTE FORMAT : les réponses peuvent contenir une mise en forme markdown légère (**gras**, *italique*, listes, tableaux délimités par |). Évalue le fond ; un tableau structuré et complet est un signe de professionnalisme, pas du remplissage.";
      const resp = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1800,
          system: systemPrompt,
          messages: [{ role: "user", content: "Voici la production finale à évaluer :\n\n" + prod }]
        })
      });
      if (!resp.ok) throw new Error("Débrief indisponible (erreur " + resp.status + ").");
      const data = await resp.json();
      const txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      setDebrief(txt || "(réponse vide)");
      setStep("debrief");
      if (window.__onLivrableSubmitted) window.__onLivrableSubmitted(answers, reflexive, txt);
      window.LUMIO_LOG = window.LUMIO_LOG || {};
      window.LUMIO_LOG.livrableSubmitted = Date.now();
    } catch (e) { setErr(e.message); }
    setSending(false);
  };

  // ── Envoi portfolio par email ──
  const sendPortfolio = async () => {
    const stu = (window.LUMIO_DATA && window.LUMIO_DATA.student) || {};
    if (!stu.email) { setSent("Aucun email étudiant détecté."); return; }
    setSent("envoi…");
    try {
      const rows = comps.map(c => "<h3 style=\"color:#134547;margin:18px 0 6px;font-family:'IBM Plex Sans',sans-serif\">" + c.code + " — " + c.label + "</h3><div style=\"color:#0B2B2D;line-height:1.55;font-family:'IBM Plex Sans',sans-serif\">" + _mdToHtml(answers[c.code] || "(vide)") + "</div>").join("");
      const refl = cfg.note_reflexive
        ? "<h3 style=\"color:#134547;margin:18px 0 6px;font-family:'IBM Plex Sans',sans-serif\">Note réflexive</h3><div style=\"color:#0B2B2D;line-height:1.55;font-family:'IBM Plex Sans',sans-serif\">" + _mdToHtml(reflexive || "(vide)") + "</div>"
        : "";

      // ── Portfolio visuel (carte enrichie 3 pages) — best-effort, jamais bloquant.
      let visualHtml = "";
      let attachments = [];
      const pf = cfg.portfolio;
      const cardAttempted = !!(pf && window.PACPortfolio && window.PACPortfolio.renderAndCapture);
      if (cardAttempted) {
        try {
          const nameParts = String(stu.name || "").trim().split(/\s+/).filter(Boolean);
          const shots = await window.PACPortfolio.renderAndCapture({
            blocCode: cfg.bloc || "",
            prenom: nameParts[0] || "",
            nom: nameParts.slice(1).join(" "),
            missionTitre: pf.missionTitre,
            miseEnSituation: pf.miseEnSituation,
            choix: pf.choix,
            justification: pf.justification,
            imageSrc: pf.imageSrc,
            competences: comps.map(c => c.code)
          });
          const order = [["cover", "1"], ["situation", "2"], ["choix", "3"]];
          attachments = order
            .map(([key, n]) => ({ filename: "portfolio-" + n + "-" + key + ".png", content: shots[key], content_id: "pac-" + key }))
            .filter(a => a.content);
          if (attachments.length) {
            visualHtml = "<div style=\"text-align:center;margin:0 0 28px\">" +
              attachments.map(a => "<img src=\"cid:" + a.content_id + "\" alt=\"\" width=\"340\" style=\"width:100%;max-width:340px;border-radius:16px;margin:0 0 16px;display:inline-block\" />").join("") +
              "</div>";
          }
        } catch (e) {
          console.warn("Portfolio visuel indisponible, envoi fonctionnel uniquement :", e.message);
        }
      }

      const html = "<div style=\"font-family:'IBM Plex Sans',sans-serif;max-width:680px;margin:auto;color:#0B2B2D\">" +
        visualHtml +
        "<div style=\"background:#0B2B2D;padding:24px 28px;border-radius:10px 10px 0 0\">" +
        // Logo retiré le 03/08/2026 : le fichier n'existe pas sur emineo-pac.vercel.app
        // (Vercel renvoie la page du portail), ce qui affichait un carré vide dans tous
        // les emails. Le bandeau serveur porte déjà l'identité « Éminéo Education · PAC ».
        "<h1 style=\"color:#5DE298;font-size:20px;margin:0 0 4px\">Portfolio de compétences</h1>" +
        "<p style=\"color:#E3FFF0;font-size:13px;margin:0\">" + (stu.name || "") + " · " + (cfg.dispositif || "PAC") + " " + (cfg.bloc || "") + " · " + (cfg.titre || cfg.epreuve || "") + "</p>" +
        "</div>" +
        "<div style=\"padding:24px 28px;border:1px solid #E3FFF0;border-top:none;border-radius:0 0 10px 10px\">" +
        rows + refl +
        "<hr style=\"border:none;border-top:2px solid #5DE298;margin:24px 0\">" +
        "<h2 style=\"color:#0B2B2D;font-size:16px;margin-bottom:8px\">Débrief de compétences</h2>" +
        "<div style=\"white-space:pre-wrap;color:#0B2B2D;line-height:1.55;font-size:13px\">" + debrief + "</div>" +
        "<hr style=\"border:none;border-top:1px solid #E3FFF0;margin:24px 0\">" +
        "<p style=\"font-size:11px;color:#999;text-align:center\">Ce document a été généré automatiquement par le dispositif PAC · Éminéo Education</p>" +
        "</div></div>";
      const resp = await fetch("/api/send-portfolio", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: stu.email, studentName: stu.name, portfolioHTML: html,
          bloc: cfg.bloc, campus: stu.campus || "", attachments, cardAttempted })
      });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok && !result.completed) throw new Error("erreur " + resp.status);
      setSent(result.sent === false
        ? "✓ Production validée. (Email temporairement indisponible)"
        : result.campusResolved === false
          ? "✓ Portfolio bien transmis à " + stu.email + ". Un rattachement à votre référent pédagogique sera effectué manuellement."
          : "✓ Portfolio envoyé à " + stu.email);
    } catch (e) { setSent("Échec de l'envoi (" + e.message + ")."); }
  };

  // ── Reprise après feedback ──
  const revise = () => { setStep("revision"); };

  // ══════════════ RENDU ══════════════
  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#f7f4ef", padding: "22px 26px", fontFamily: "var(--font-sans)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", color: "var(--accent)", textTransform: "uppercase" }}>
          {(cfg.dispositif || "PAC")} · {cfg.bloc} · Livrable
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, margin: "6px 0 4px" }}>{cfg.epreuve || cfg.titre || "Livrable certifiant"}</h1>
        <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 18 }}>
          {cfg.commanditaire ? "Commanditaire : " + cfg.commanditaire : null}
          {cfg.commanditaire && cfg.deadline ? " · " : null}
          {cfg.deadline ? "Échéance : " + cfg.deadline : null}
        </div>

        {/* ── F33 · État de la sauvegarde automatique ──
            Muet tant que tout va bien (une simple mention discrète).
            Devient un avertissement franc dès qu'une écriture échoue :
            l'étudiant doit apprendre TOUT DE SUITE que sa copie n'est
            plus protégée, pas au moment de la perdre. ── */}
        <SaveStatus />

        {/* ── Champs par compétence (saisie markdown-lite : toolbar + aperçu) ── */}
        {comps.map(c => (
          <LivField key={c.code}
            title={c.code + " — " + c.label}
            count={_wcMd(answers[c.code])} min={c.min || 0}
            placeholder={c.placeholder} conseil={c.conseil}
            value={answers[c.code]} onChange={v => set(c.code, v)}
            locked={step === "debrief"} rows={5}
            tableauModele={c.tableauModele} />
        ))}

        {/* ── Note réflexive ── */}
        {cfg.note_reflexive ? (
          <LivField title="Note réflexive"
            count={_wcMd(reflexive)} min={cfg.noteReflexiveMinMots || 0}
            value={reflexive} onChange={setReflexive}
            locked={step === "debrief"} rows={6} />
        ) : null}

        {err ? <div style={{ color: "#c4420f", fontSize: 12, marginBottom: 10 }}>{err}</div> : null}

        {/* ── F42 · Champs sous le plancher : seul cas réellement bloquant ── */}
        {(step === "draft" || step === "revision") && !plancherAtteint && !sending ? (
          <div style={{ background: "#fdecea", border: "1px solid #c4420f", borderRadius: 7, padding: "11px 14px", marginBottom: 12, fontSize: 12.5, color: "#7a2408", lineHeight: 1.6 }}>
            <strong>Une réponse par compétence est nécessaire avant de soumettre.</strong>
            <div style={{ marginTop: 6 }}>
              À renseigner : {videsOuTropCourts.join(", ")}
              {cfg.note_reflexive && _wcMd(reflexive) < PLANCHER_MOTS ? (videsOuTropCourts.length ? ", " : "") + "note réflexive" : ""}
            </div>
          </div>
        ) : null}

        {/* ── F38 + F42 · Volume recommandé — informatif, non bloquant ── */}
        {(step === "draft" || step === "revision") && plancherAtteint && !volumeAtteint && !sending ? (
          <div style={{ background: "#fff8e6", border: "1px solid #d9a300", borderRadius: 7, padding: "11px 14px", marginBottom: 12, fontSize: 12.5, color: "#6b4e00", lineHeight: 1.6 }}>
            <strong>Volume recommandé non atteint — vous pouvez soumettre malgré tout.</strong> Le jury évalue le fond ;
            une réponse trop brève est simplement plus difficile à valoriser.
            {manquants.length ? (
              <div style={{ marginTop: 6 }}>
                {manquants.map(m => (
                  <div key={m.code}>{m.code} — {m.manque} mot{m.manque > 1 ? "s" : ""} sous le repère</div>
                ))}
              </div>
            ) : null}
            {manqueReflexive ? <div style={{ marginTop: 6 }}>Note réflexive — {manqueReflexive} mot{manqueReflexive > 1 ? "s" : ""} sous le repère</div> : null}
            {manqueTotal ? <div style={{ marginTop: 6 }}>Total du livrable — {manqueTotal} mot{manqueTotal > 1 ? "s" : ""} sous le repère</div> : null}
          </div>
        ) : null}

        {/* ── F42 · Confirmation avant une remise sous le volume recommandé ── */}
        {(step === "draft" || step === "revision") && confirmCourt && !sending ? (
          <div style={{ background: "var(--paper, #fff)", border: "1px solid #134547", borderRadius: 7, padding: "13px 16px", marginBottom: 12, fontSize: 13, lineHeight: 1.6 }}>
            <strong>Soumettre malgré un volume inférieur au repère ?</strong>
            <div style={{ marginTop: 6, color: "var(--ink-soft, #555)" }}>
              Vos réponses partent telles quelles à l'évaluation. Vous pourrez les reprendre après le retour formatif.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={() => setConfirmCourt(false)}
                style={{ background: "transparent", color: "#134547", border: "1px solid #134547", borderRadius: 7, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Compléter d'abord
              </button>
              <button onClick={() => { setConfirmCourt(false); (step === "draft" ? submitForFeedback : submitFinal)(); }}
                style={{ background: "#134547", color: "white", border: "none", borderRadius: 7, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Soumettre quand même
              </button>
            </div>
          </div>
        ) : null}

        {/* ── Bouton étape 1 : soumettre pour évaluation ── */}
        {(step === "draft" || step === "revision") && !confirmCourt ? (
          <button
            onClick={canSubmit
              ? (volumeAtteint
                  ? (step === "draft" ? submitForFeedback : submitFinal)
                  : () => setConfirmCourt(true))
              : undefined}
            disabled={!canSubmit}
            style={{ background: canSubmit ? "#134547" : "rgba(20,24,36,0.1)", color: canSubmit ? "white" : "var(--ink-faint)", border: "none", borderRadius: 7, padding: "11px 24px", fontSize: 13, fontWeight: 600, cursor: canSubmit ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {sending ? "Évaluation en cours…" : step === "draft" ? "Soumettre pour évaluation →" : "Valider le livrable final →"}
          </button>
        ) : null}

        {/* ── Retour formatif (étape 1) ── */}
        {step === "feedback" && feedback ? (
          <div style={{ marginTop: 22 }}>
            <div style={{ background: "white", borderRadius: 10, padding: "18px 20px", border: "1px solid var(--rule)", whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", color: "#1a6641", textTransform: "uppercase", marginBottom: 10 }}>Retour d'évaluation</div>
              {feedback}
            </div>
            {/* Correctif 05/08/2026 — le débrief final prend 10 à 20 s : sans état
                d'attente ni verrouillage, le clic sur « Valider tel quel » restait
                sans effet visible et autorisait des appels concurrents. */}
            <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center" }}>
              <button onClick={sending ? undefined : revise} disabled={sending}
                style={{ background: "#134547", color: "white", border: "none", borderRadius: 7, padding: "11px 24px", fontSize: 13, fontWeight: 600, cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.45 : 1, fontFamily: "inherit" }}>
                ✏️ Reprendre ma copie
              </button>
              <button onClick={sending ? undefined : submitFinal} disabled={sending}
                style={{ background: "#1a6641", color: "white", border: "none", borderRadius: 7, padding: "11px 24px", fontSize: 13, fontWeight: 600, cursor: sending ? "progress" : "pointer", opacity: sending ? 0.65 : 1, fontFamily: "inherit" }}>
                {sending ? "Débrief en cours…" : "Valider tel quel → débrief final"}
              </button>
            </div>
            {sending ? (
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-mute)" }}>
                Le jury relit votre copie complète. Cela prend une quinzaine de secondes — ne quittez pas la fenêtre.
              </div>
            ) : null}
            {err ? <div style={{ marginTop: 10, color: "#c4420f", fontSize: 12 }}>{err}</div> : null}
          </div>
        ) : null}

        {/* ── Débrief final (étape 2) ── */}
        {step === "debrief" && debrief ? (
          <div style={{ marginTop: 22 }}>
            <div style={{ background: "#0B2B2D", borderRadius: 10, padding: "20px 22px", whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6, color: "#E3FFF0" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", color: "#5DE298", textTransform: "uppercase", marginBottom: 10 }}>Débrief de compétences</div>
              {debrief}
            </div>
            <div style={{ marginTop: 16 }}>
              <button onClick={sendPortfolio}
                style={{ background: "#5DE298", color: "#0B2B2D", border: "none", borderRadius: 7, padding: "11px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                ✉ Recevoir mon portfolio par email
              </button>
              {sent ? <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 8 }}>{sent}</div> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

window.LUMIO_APPS = window.LUMIO_APPS || {};
window.LUMIO_APPS.livrable = LivrableApp;
