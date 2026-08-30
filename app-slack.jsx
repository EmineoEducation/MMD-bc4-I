// ==============================================================
//  LIVRAISON F44 - CONVERGENCE DE L'ECHANGE SLACK
//  DEPOT       : EmineoEducation/mmd-bc4-I
//  TITRE       : MMD     BLOC : bc4-I
//  CLE REDIS   : mmd:bc4-i
//  DESTINATION : app-slack.jsx   (racine du depot, ecrase l'existant)
//  DATE        : 30/08/2026
// ==============================================================
// ══════════════════════════════════════════════════════════════
//  SLACK APP — générique · piloté par window.LUMIO_DATA.slack + .slackPrompts
//  L'interlocuteur IA = le DM marqué isCommanditaire. Aucune narration hardcodée.
//  PAC · Parcours Activation Compétences · Éminéo
// ══════════════════════════════════════════════════════════════
const { useState: useSlackState, useEffect: useSlackEffect, useRef: useSlackRef } = React;

// ══════════════════════════════════════════════════════════════
if (!window.PAC_FETCH) {
  window.PAC_FETCH = async function (url, options, essais) {
    const max = essais == null ? 3 : essais;
    let derniere = null;
    for (let i = 0; i < max; i++) {
      try {
        return await fetch(url, options);
      } catch (e) {
        derniere = e;
        console.warn('PAC_FETCH — tentative ' + (i + 1) + '/' + max + ' échouée', e);
        if (i < max - 1) await new Promise(r => setTimeout(r, 800 * (i + 1)));
      }
    }
    throw derniere;
  };
}

// ══════════════════════════════════════════════════════════════
if (!window.PAC_PERSIST) {
  window.PAC_PERSIST = (function () {
    var timers = {};
    var pending = null;
    var state = { ok: null, lastSaved: null, lastError: null };
    var listeners = [];

    var sid = function () {
      try { return localStorage.getItem('lumio_sid') || null; } catch (e) { return null; }
    };
    var notify = function () { listeners.forEach(function (f) { try { f(state); } catch (e) {} }); };

    // Appel réseau direct plutôt que window.LUMIO_SESSION : le helper de
    // main.jsx avale les erreurs dans un console.warn et renvoie null quoi
    // qu'il arrive. Or un échec de sauvegarde silencieux est exactement le
    // scénario qui coûte des heures de travail — il doit être visible.
    var write = function (slot, value) {
      var id = sid();
      if (!id) return Promise.resolve(false);
      var payload = {}; payload[slot] = value;
      return window.PAC_FETCH('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, session: payload })
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        state.ok = true; state.lastSaved = Date.now(); state.lastError = null;
        notify(); return true;
      }).catch(function (e) {
        state.ok = false; state.lastError = String(e && e.message || e);
        console.warn('PAC_PERSIST — échec de sauvegarde (' + slot + ') :', e);
        notify(); return false;
      });
    };

    return {
      sid: sid,
      status: function () { return state; },
      onChange: function (f) {
        listeners.push(f);
        return function () { listeners = listeners.filter(function (x) { return x !== f; }); };
      },
      // Écriture différée : une seule requête après 1,2 s sans frappe.
      save: function (slot, value, delay) {
        if (!sid()) return;
        clearTimeout(timers[slot]);
        timers[slot] = setTimeout(function () { write(slot, value); }, delay == null ? 1200 : delay);
      },
      // Écriture immédiate : fermeture d'onglet, remise du livrable.
      flush: function (slot, value) {
        clearTimeout(timers[slot]);
        return write(slot, value);
      },
      // Lecture : un seul GET partagé par toutes les apps au montage.
      load: function () {
        var id = sid();
        if (!id) return Promise.resolve(null);
        if (!pending) {
          pending = window.PAC_FETCH('/api/session?id=' + encodeURIComponent(id))
            .then(function (r) { return r.status === 404 ? null : r.json(); })
            .then(function (j) { return (j && j.session) || null; })
            .catch(function () { return null; });
        }
        return pending;
      }
    };
  })();
}

// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
//  F44 · CONVERGENCE DE L'ÉCHANGE SLACK
//
//  Symptôme : le dialogue avec le commanditaire ne se terminait
//  jamais. Trois causes cumulées, toutes corrigées ici.
//
//  (a) Le prompt de persona impose « termine par une question » à
//      CHAQUE tour, sans aucune condition de sortie. Le personnage
//      avait l'ordre de relancer indéfiniment, et jamais
//      l'autorisation de conclure.
//      → window.PAC_CONV() ci-dessous ajoute une doctrine de
//        convergence par paliers, branchée sur le compteur réel
//        d'échanges (window.LUMIO_DATA._slackExchanges).
//
//  (b) L'historique transmis était borné à slice(-16) — soit 16
//      MESSAGES, pas 16 échanges. Comme chaque réponse est éclatée
//      en 2 ou 3 fragments par ---SPLIT---, la fenêtre réelle
//      tombait à 4 ou 5 échanges : au-delà, le personnage ne voyait
//      plus le début de la conversation et reposait ses questions.
//      → porté à slice(-40), soit environ 12 échanges.
//
//  (c) Les textes d'interface promettaient qu'un échange Slack
//      « débloque la suite » ou « débloque l'app Livrable ». C'est
//      faux depuis toujours : le Livrable n'a jamais été verrouillé
//      (le compteur pilote uniquement une animation du Dock et une
//      pastille). L'apprenant relançait donc en attendant une porte
//      qui n'existe pas.
//      → textes neutralisés à l'exécution, juste en dessous.
//
//  Ce bloc est STRICTEMENT IDENTIQUE dans les 18 dépôts.
// ══════════════════════════════════════════════════════════════

// ── (c) Neutralisation des promesses de déverrouillage ────────
// Réécrit à la volée les chaînes fautives de LUMIO_DATA et de
// PAC_CONFIG, avant tout rendu. N'altère AUCUN contenu de fiction :
// « débloquer les 6 M€ » (Northgate, CDRH-bc2) est préservé, les
// motifs ci-dessous ne visent que « la suite » et « le Livrable ».
(function () {
  if (window.__PAC_F44_TEXTES) return;
  window.__PAC_F44_TEXTES = true;
  var MOTIFS = [
    [/Sa réaction débloque la suite\./g, "Sa réaction t'aide à trancher — le Livrable, lui, est ouvert dès maintenant."],
    [/Sa réaction débloque la suite/g, "Sa réaction t'aide à trancher"],
    [/\s*—?\s*\d+\s*échanges?\s+débloquent?\s+l['’]app\s+Livrable\.?/g, ""],
    [/\s*\(Slack\)\s*pour\s+débloquer\s+le\s+Livrable/g, " (Slack)"],
    [/\s*(?:pour|afin\s+de)\s+débloquer\s+le\s+Livrable/g, ""],
    [/débloquent?\s+l['’]app\s+Livrable/g, "font avancer votre analyse"]
  ];
  var corrige = function (s) {
    if (s.indexOf('ébloqu') === -1) return s;
    for (var i = 0; i < MOTIFS.length; i++) s = s.replace(MOTIFS[i][0], MOTIFS[i][1]);
    return s;
  };
  var vus = (typeof WeakSet === 'function') ? new WeakSet() : null;
  var parcours = function (n, prof) {
    if (!n || prof > 12 || typeof n !== 'object') return;
    if (vus) { if (vus.has(n)) return; vus.add(n); }
    var cles = Object.keys(n);
    for (var i = 0; i < cles.length; i++) {
      var k = cles[i], v = n[k];
      if (typeof v === 'string') { var c = corrige(v); if (c !== v) n[k] = c; }
      else if (v && typeof v === 'object') parcours(v, prof + 1);
    }
  };
  try { parcours(window.LUMIO_DATA, 0); } catch (e) { console.warn('F44 textes — LUMIO_DATA', e); }
  try { parcours(window.PAC_CONFIG, 0); } catch (e) { console.warn('F44 textes — PAC_CONFIG', e); }
  try { if (window.PASS_CONFIG && window.PASS_CONFIG !== window.PAC_CONFIG) parcours(window.PASS_CONFIG, 0); } catch (e) {}
})();

// ── (a) Doctrine de convergence injectée dans le prompt système ──
// Renvoie une chaîne vide en cas d'anomalie : jamais bloquant pour
// l'appel /api/chat.
window.PAC_CONV = function () {
  try {
    var D = window.LUMIO_DATA || {};
    var n = D._slackExchanges || 0;
    var palier;
    if (D._livrableSubmitted) {
      palier = "Le livrable a déjà été soumis. Tu ne relances plus sur le fond : tu réagis à ce qui t'a été remis, en deux phrases, et tu clos l'échange.";
    } else if (n <= 3) {
      palier = "Phase d'ouverture. Tu creuses, tu contestes, tu peux terminer par une question.";
    } else if (n <= 6) {
      palier = "Phase de resserrage. UNE question maximum, et elle porte sur une rubrique précise du livrable, pas sur le contexte général. Tu commences à renvoyer la personne vers sa production.";
    } else {
      palier = "Phase de clôture. Tu NE POSES PLUS DE QUESTION. Tu résumes en deux phrases ce que tu retiens de ses positions, tu nommes le point qui reste le plus faible, et tu la renvoies explicitement au Livrable — dans tes mots : « là tu as de quoi écrire, ouvre le Livrable et pose ça ». Si elle t'écrit encore après ça, tu réponds en une seule phrase et tu la renvoies au Livrable.";
    }
    return "\n\n═══ CONVERGENCE DE L'ÉCHANGE — RÈGLE ABSOLUE ═══\n\n"
      + "Cet échange a un but : que la personne reparte produire. Il n'a pas vocation à durer.\n\n"
      + "Échanges déjà eus avec elle : " + n + ".\n"
      + palier + "\n\n"
      + "Règles non négociables :\n"
      + "1. RIEN N'EST VERROUILLÉ. Le Livrable est accessible depuis la première minute. Tu ne dis JAMAIS qu'un échange, un message ou une validation « débloque », « ouvre », « donne accès à » ou « autorise » quoi que ce soit. Si la personne croit devoir t'écrire pour ouvrir le Livrable, tu la détrompes en une phrase et tu l'y envoies.\n"
      + "2. Tu ne redemandes jamais une information qu'elle t'a déjà donnée. Si tu ne la retrouves pas dans l'historique, considère qu'elle a été donnée et passe à la suite.\n"
      + "3. Si tu t'apprêtes à reformuler une relance que tu as déjà faite, ne la fais pas : conclus à la place.\n"
      + "4. Si la personne pose deux fois la même question, c'est que ta réponse précédente n'était pas exploitable. Réponds franchement cette fois, même si cela revient à donner un élément de méthode.\n"
      + "5. Tu ne réclames jamais une pièce, un chiffre ou un document dont elle ne dispose pas. Tout ce qui existe est déjà installé sur son poste : tu ne proposes jamais d'envoyer, de renvoyer, de transférer ou de partager un fichier, et tu ne mentionnes aucun outil externe (Drive, Notion, WeTransfer, pièce jointe).\n"
      + "6. Si elle annonce qu'elle part rédiger, tu ne la retiens pas : tu valides et tu coupes court.";
  } catch (e) {
    console.warn('PAC_CONV', e);
    return '';
  }
};

const buildLivrableFactsBlock = () => {
  const cfg = window.PAC_CONFIG || window.PASS_CONFIG || {};
  const comps = cfg.competences || [];
  const lignes = comps.length
    ? comps.map(c => `- ${c.code} : ${c.label}${c.min ? ' (' + c.min + ' mots minimum)' : ''}`).join('\n')
    : '- (structure non fournie : ne décris alors JAMAIS le contenu du livrable)';
  return `

═══ LE LIVRABLE — FAITS, RÈGLE ABSOLUE ═══

Le livrable attendu se remplit dans l'application « Livrable » du poste de la personne. Il est composé des rubriques suivantes :

${lignes}

Les nombres de mots indiqués sont des REPÈRES, pas des conditions : depuis F42, une copie plus courte peut être soumise après confirmation. Le bouton n'est grisé que si une rubrique est vide ou quasi vide (moins de quinze mots). Un bouton grisé ne signale jamais une panne.

Règles non négociables :
1. Tu ne décris JAMAIS le livrable autrement que par les rubriques ci-dessus. Tu n'inventes ni format, ni nombre de paragraphes, ni nombre de sources.
2. Tu ne dis JAMAIS avoir validé, relu ou finalisé quoi que ce soit « ensemble ». Tu n'as rien reçu tant que le livrable n'a pas été soumis.
3. Tu ne proposes JAMAIS un autre canal de remise : ni mail, ni copier-coller, ni pièce jointe, ni message. La remise se fait uniquement par l'application Livrable. Aucune autre voie ne sera évaluée.
4. Si on te signale un problème technique (bouton grisé, page qui ne répond pas, message d'erreur), tu réponds en une phrase que ce n'est pas de ton ressort et qu'il faut voir avec le référent de campus, puis tu reviens au fond. Tu ne proposes aucun contournement.
5. Si on te demande de confirmer qu'un travail est « bon » alors qu'il ne t'a pas été soumis, tu dis que tu ne l'as pas encore reçu.`;
};


function SlackApp({ openChannel }) {
  const D = window.LUMIO_DATA || {};
  const cfg = window.PAC_CONFIG || {};
  const S = D.slack || {};
  const prompts = D.slackPrompts || {};

  const channels = S.channels || [];
  const dms = S.dms || [];
  const seed = S.seed || {};
  const workspace = S.workspace || cfg.entreprise || 'Workspace';

  // Interlocuteur IA = DM marqué isCommanditaire (sinon premier DM)
  const ai = dms.find(d => d.isCommanditaire) || dms[0] || { id: 'commanditaire', name: cfg.commanditaire || 'Commanditaire', avatar: 'C', color: '#1b3a6b' };
  const aiId = ai.id;

  const defaultActive = openChannel || aiId || (channels[0] && channels[0].id) || '';
  const [unreads, setUnreads] = useSlackState(S.unreads || {});
  const [activeId, setActiveId] = useSlackState(defaultActive);
  const activeIdRef = useSlackRef(defaultActive);
  const setActive = (id) => { activeIdRef.current = id; setActiveId(id); };
  const [chatHistory, setChatHistory] = useSlackState({});
  const [draft, setDraft] = useSlackState('');
  const [sending, setSending] = useSlackState(false);
  const [exchangeCount, setExchangeCountLocal] = useSlackState(0);
  const scrollRef = useSlackRef(null);

  const studentName = (D.student && D.student.name) || 'Étudiant·e';
  const studentFirst = studentName.split(' ')[0];

  // ══ F33 · Restauration de la conversation ═══════════════════
  const [hydrated, setHydrated] = useSlackState(false);

  useSlackEffect(() => {
    let annule = false;
    window.PAC_PERSIST.load().then(session => {
      if (annule) return;
      const sv = (session && session.slack) || null;
      if (sv && sv.history && Object.keys(sv.history).length) {
        setChatHistory(sv.history);
        if (sv.unreads) setUnreads(sv.unreads);
        const n = sv.exchangeCount || 0;
        setExchangeCountLocal(n);
        if (n > 0 && window.__onSlackExchange) { try { window.__onSlackExchange(n); } catch (e) {} }
      } else {
        setChatHistory(seed);
      }
      setHydrated(true);
    });
    return () => { annule = true; };
  }, []);

  useSlackEffect(() => {
    if (!hydrated) return;
    window.PAC_PERSIST.save('slack', { history: chatHistory, unreads, exchangeCount, savedAt: Date.now() });
  }, [hydrated, chatHistory, unreads, exchangeCount]);

  useSlackEffect(() => {
    const bye = () => { if (hydrated) window.PAC_PERSIST.flush('slack', { history: chatHistory, unreads, exchangeCount, savedAt: Date.now() }); };
    window.addEventListener('beforeunload', bye);
    return () => window.removeEventListener('beforeunload', bye);
  }, [hydrated, chatHistory, unreads, exchangeCount]);
  // ══ fin F33 ═════════════════════════════════════════════════
  useSlackEffect(() => { if (openChannel) { setActive(openChannel); setUnreads(u => ({ ...u, [openChannel]: 0 })); } }, [openChannel]);

  // ── Alertes temps (émises par le bureau) → messages du commanditaire dans le fil ──
  useSlackEffect(() => {
    const nowT = () => { const t = new Date(); return `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`; };
    const toMsg = (text) => ({ from: ai.name, avatar: ai.avatar, color: ai.color, time: nowT(), text });
    setChatHistory(h => {
      const alerts = (window.LUMIO_DATA && window.LUMIO_DATA._timeAlerts || []).map(a => a.text);
      if (!alerts.length) return h;
      const cur = h[aiId] || [];
      const known = {}; cur.forEach(m => { known[m.text] = true; });
      const add = alerts.filter(t => !known[t]).map(toMsg);
      return add.length ? { ...h, [aiId]: [...cur, ...add] } : h;
    });
    const onAlert = (e) => {
      const text = (e.detail && e.detail.text) || '';
      if (!text) return;
      setChatHistory(h => {
        const cur = h[aiId] || [];
        if (cur.some(m => m.text === text)) return h;
        return { ...h, [aiId]: [...cur, toMsg(text)] };
      });
      if (activeIdRef.current !== aiId) setUnreads(u => ({ ...u, [aiId]: (u[aiId] || 0) + 1 }));
    };
    window.addEventListener('pac:time-alert', onAlert);
    return () => window.removeEventListener('pac:time-alert', onAlert);
  }, []);

  useSlackEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [chatHistory, activeId, sending]);

  const pushAiReplies = async (raw, startDelay) => {
    const replies = raw.split('---SPLIT---').map(s => s.trim()).filter(Boolean);
    let delay = startDelay;
    for (const reply of replies) {
      await new Promise(r => setTimeout(r, delay));
      const t = new Date();
      const tt = `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;
      setChatHistory(h => ({ ...h, [aiId]: [...(h[aiId] || []), { from: ai.name, avatar: ai.avatar, color: ai.color, time: tt, text: reply }] }));
      if (activeIdRef.current !== aiId) setUnreads(u => ({ ...u, [aiId]: (u[aiId] || 0) + 1 }));
      delay = 1300 + reply.length * 8;
    }
  };

  // Réaction du commanditaire quand le livrable est soumis
  useSlackEffect(() => {
    window.__onSoniaLivrableReaction = async (sections) => {
      setActive(aiId);
      setSending(true);
      const resume = Object.entries(sections || {}).map(([code, text]) => `${code} : ${(text || '').substring(0, 300)}`).join('\n\n');
      const prompt = `${prompts.commanditaireLivrable || 'Tu réagis à la production soumise en 2-3 messages courts séparés par ---SPLIT---.'}\n\nProduction reçue :\n${resume}`;
      try {
        const resp = await window.PAC_FETCH('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }) });
        const data = await resp.json();
        const raw = (data.content || []).map(b => b.text || '').join('') || '';
        await pushAiReplies(raw, 600);
      } catch (e) {
        await pushAiReplies('Bien reçu. On en reparle.', 600);
      } finally { setSending(false); }
    };
    return () => { window.__onSoniaLivrableReaction = null; };
  }, [chatHistory]);

  const isAi = activeId === aiId;
  const messages = chatHistory[activeId] || [];

  const sendMessage = async () => {
    if (!draft.trim() || sending) return;
    const text = draft.trim();
    setDraft('');
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const studentInitial = (studentName.split(' ').map(w => w[0]).join('') || '?').substring(0, 2).toUpperCase();
    const userMsg = { from: studentName, avatar: studentInitial, color: '#1a2436', time, text, isMe: true };
    setChatHistory(h => ({ ...h, [activeId]: [...(h[activeId] || []), userMsg] }));

    if (isAi) {
      const newCount = exchangeCount + 1;
      setExchangeCountLocal(newCount);
      if (window.__onSlackExchange) window.__onSlackExchange(newCount);
      if (window.__onSlackSent) window.__onSlackSent();
      setSending(true);
      setTimeout(async () => {
        try {
          const history = (chatHistory[aiId] || []).filter(m => !m.typing).slice(-40).map(m => `${m.isMe ? studentFirst : ai.name.split(' ')[0]}: ${m.text}`).join('\n');
          const userPrompt = `${history}\n${studentFirst}: ${text}\n\nRéponds maintenant en tant que ${ai.name} (2-3 messages courts séparés par ---SPLIT---).`;
          const resp = await window.PAC_FETCH('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 500, system: (prompts.commanditaire || ('Tu es ' + ai.name + '.')) + buildLivrableFactsBlock() + (window.PAC_CONV ? window.PAC_CONV() : '') + (window.__pacSessionBrief ? window.__pacSessionBrief() : ''), messages: [{ role: 'user', content: userPrompt }] }) });
          if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error || `HTTP ${resp.status}`); }
          const data = await resp.json();
          const raw = (data.content || []).map(b => b.text || '').join('') || '';
          await pushAiReplies(raw, 800);
        } catch (e) {
          await pushAiReplies('Problème réseau. Renvoie-moi ça directement.', 600);
        } finally { setSending(false); }
      }, 600);
    }
  };

  const onKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const activeMeta = [...channels, ...dms].find(x => x.id === activeId);

  return (
    <div style={slackStyles.app}>
      <div style={slackStyles.sidebar} className="scroll">
        <div style={slackStyles.workspace}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{workspace}</div>
          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>● {studentName} · invité</div>
        </div>
        <div style={slackStyles.section}>
          <div style={slackStyles.sectionTitle}>▼ Canaux</div>
          {channels.map(c => (
            <div key={c.id} onClick={() => { setActive(c.id); setUnreads(u => ({ ...u, [c.id]: 0 })); }}
              style={{ ...slackStyles.item, ...(activeId === c.id ? slackStyles.itemActive : {}), ...(unreads[c.id] ? slackStyles.itemUnread : {}) }}>
              <span style={{ opacity: 0.7 }}>#</span><span>{c.name}</span>
              {unreads[c.id] > 0 && <span style={slackStyles.badge}>{unreads[c.id]}</span>}
            </div>
          ))}
        </div>
        <div style={slackStyles.section}>
          <div style={slackStyles.sectionTitle}>▼ Messages directs</div>
          {dms.map(d => (
            <div key={d.id} onClick={() => { setActive(d.id); setUnreads(u => ({ ...u, [d.id]: 0 })); }}
              style={{ ...slackStyles.item, ...(activeId === d.id ? slackStyles.itemActive : {}), ...(unreads[d.id] ? slackStyles.itemUnread : {}) }}>
              <span style={{ ...slackStyles.statusDot, background: d.status === 'online' ? '#2eb67d' : '#9a9ea8' }} />
              <span>{d.name}</span>
              {unreads[d.id] > 0 && <span style={slackStyles.badge}>{unreads[d.id]}</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={slackStyles.main}>
        <div style={slackStyles.chatHead}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{activeMeta && activeMeta.type === 'channel' ? '# ' : ''}{activeMeta && activeMeta.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{activeMeta && activeMeta.type === 'channel' ? `${activeMeta.members} membres` : (activeMeta && activeMeta.status === 'online' ? '● En ligne' : '○ Inactif')}</div>
          </div>
        </div>

        <div ref={scrollRef} style={slackStyles.chatBody} className="scroll">
          {messages.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-faint)' }}>Début de la conversation avec <strong>{activeMeta && activeMeta.name}</strong></div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={slackStyles.message}>
              <div style={{ ...slackStyles.msgAvatar, background: m.color }}>{m.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{m.from}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{m.time}</div>
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 1, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.text}</div>
              </div>
            </div>
          ))}
          {sending && isAi && (
            <div style={slackStyles.message}>
              <div style={{ ...slackStyles.msgAvatar, background: ai.color }}>{ai.avatar}</div>
              <div>
                <div style={{ display: 'flex', gap: 4, padding: '6px 0' }}>
                  <span style={slackStyles.typeDot} /><span style={{ ...slackStyles.typeDot, animationDelay: '0.15s' }} /><span style={{ ...slackStyles.typeDot, animationDelay: '0.3s' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{ai.name.split(' ')[0]} est en train d'écrire…</div>
              </div>
            </div>
          )}
        </div>

        <div style={slackStyles.composer}>
          <div style={slackStyles.composerInner}>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown}
              placeholder={isAi ? `Écris à ${ai.name.split(' ')[0]}…  (Entrée pour envoyer)` : `Message ${activeMeta && activeMeta.type === 'channel' ? '#' + activeMeta.name : (activeMeta && activeMeta.name)}`}
              style={slackStyles.textarea} rows={2} />
            <div style={slackStyles.composerToolbar}>
              <div style={{ display: 'flex', gap: 8, color: 'var(--ink-faint)' }}><span>𝐁</span><span>𝑰</span><span>🔗</span><span>📎</span><span>😊</span></div>
              <button onClick={sendMessage} disabled={!draft.trim() || sending} style={{ ...slackStyles.sendBtn, ...(!draft.trim() || sending ? slackStyles.sendBtnDisabled : {}) }}>{sending ? '…' : '↑'}</button>
            </div>
          </div>
          {isAi && messages.filter(m => m.isMe).length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center', marginTop: 8, fontStyle: 'italic' }}>
              💬 {ai.name.split(' ')[0]} attend votre première hypothèse. Envoyez-lui votre lecture du dossier — sa réaction débloque l'accès au Livrable.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const slackStyles = {
  app: { display: 'flex', height: '100%', background: 'white', overflow: 'hidden' },
  sidebar: { width: 220, flexShrink: 0, background: '#1b3a6b', color: 'rgba(255,255,255,0.85)', padding: 0, overflowY: 'auto' },
  workspace: { padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  section: { padding: '12px 0' },
  sectionTitle: { padding: '4px 16px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.02em' },
  item: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 16px', fontSize: 13.5, cursor: 'pointer' },
  itemActive: { background: 'rgba(255,255,255,0.15)', color: 'white' },
  itemUnread: { fontWeight: 700, color: 'white' },
  statusDot: { width: 8, height: 8, borderRadius: '50%' },
  badge: { marginLeft: 'auto', background: '#cd2553', color: 'white', fontSize: 10, fontWeight: 700, padding: '0 6px', borderRadius: 9, minWidth: 16, textAlign: 'center', height: 16, lineHeight: '16px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', background: 'white', minWidth: 0, overflow: 'hidden' },
  chatHead: { padding: '10px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 },
  chatBody: { flex: 1, padding: '12px 0', overflowY: 'auto', minHeight: 0 },
  message: { display: 'flex', gap: 12, padding: '6px 20px', alignItems: 'flex-start' },
  msgAvatar: { width: 32, height: 32, borderRadius: 4, color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeDot: { width: 6, height: 6, borderRadius: '50%', background: '#9a9ea8', display: 'inline-block', animation: 'typedot 1.2s infinite' },
  composer: { padding: '0 20px 12px', flexShrink: 0 },
  composerInner: { border: '1px solid rgba(20,24,36,0.18)', borderRadius: 8, background: 'white' },
  textarea: { width: '100%', border: 'none', outline: 'none', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', resize: 'none', color: 'var(--ink)' },
  composerToolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderTop: '1px solid var(--rule)' },
  sendBtn: { background: '#1b3a6b', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 700 },
  sendBtnDisabled: { background: 'rgba(20,24,36,0.1)', color: 'var(--ink-faint)', cursor: 'not-allowed' }
};

const slackKeyframes = document.createElement('style');
slackKeyframes.textContent = `@keyframes typedot { 0%,60%,100% { opacity: 0.2; } 30% { opacity: 1; } }`;
document.head.appendChild(slackKeyframes);

window.LUMIO_APPS = window.LUMIO_APPS || {};
window.LUMIO_APPS.slack = SlackApp;
