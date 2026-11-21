// Chez Ann's — tableau de bord d'Annie
(function () {
  "use strict";
  var C = window.CHEZ_ANNS_CONFIG || {};
  var $ = function (s) { return document.querySelector(s); };
  var DEMO = new URLSearchParams(location.search).has("demo");
  var PIECES = { decouverte: 20, signature: 35, prestige: 60 }; // pièces par box

  var sb = null;
  var orders = [];
  var tab = "week";

  // ── Utilitaires ─────────────────────────────────────────
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()); }
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dayLabel(iso) {
    var t = today();
    var txt = new Date(iso + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    if (iso === t) return "Aujourd'hui · " + txt;
    if (iso === addDays(t, 1)) return "Demain · " + txt;
    if (iso < t) return "Passé · " + txt;
    return txt;
  }
  function eur(cents) {
    var c = Math.round(cents || 0), d = c % 100 ? 2 : 0;
    return (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €";
  }
  var toastTimer;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, msg.length > 60 ? 9000 : 2600);
  }
  var SPICE_LABELS = ["Pas épicé", "Peu épicé", "Épicé", "Ça décoiffe"];
  function chilis(level) {
    level = Number(level) || 0;
    var s = "";
    for (var i = 0; i < Math.max(1, level); i++) s += '<svg class="chili' + (level ? "" : " chili--off") + '" aria-hidden="true"><use href="#chili"/></svg>';
    return s;
  }
  function spiceBadge(level) {
    level = Number(level) || 0;
    return '<span class="badge badge--spice badge--spice' + level + '">' + chilis(level) + SPICE_LABELS[level] + "</span>";
  }
  function telHref(p) { return "tel:" + String(p).replace(/[^\d+]/g, ""); }

  // ── Données ─────────────────────────────────────────────
  function demoData() {
    var t = today(), n = 0;
    var o = function (d, slot, box, qty, name, phone, items, status, extra) {
      var price = { decouverte: 3000, signature: 6500, prestige: 12000 }[box] || null;
      return Object.assign({
        id: Math.random().toString(36).slice(2), ref: "CA-" + Math.random().toString(36).slice(2, 7).toUpperCase(),
        pickup_date: addDays(t, d), pickup_slot: slot, box_id: box,
        box_name: { decouverte: "Box Découverte", signature: "Box Signature", prestige: "Box Prestige", caraibes: "Box Caraïbes" }[box],
        qty: qty, customer_name: name, phone: phone, email: "client@exemple.fr", items: items, status: status,
        total_cents: price ? price * qty : null, deposit_cents: price ? Math.round(price * qty * 0.3) : null,
        deposit_paid: !!price, pay_full: false, notes: null, guests: null, spice: [2, 0, 0, 3, 1, 2, 2][n++ % 7]
      }, extra || {});
    };
    return [
      o(0, "10h – 12h", "signature", 2, "Marie Laurent", "06 12 34 56 78", ["Mini burger", "Accras de morue", "Mini bokit poulet", "Samoussa poulet", "Verrine guacamole", "Mini croque-monsieur"], "confirmee"),
      o(0, "17h – 19h", "decouverte", 1, "Karine Bellune", "06 98 76 54 32", ["Mini hot-dog", "Accras de morue", "Mini tartelette au thon"], "prete"),
      o(1, "14h – 16h", "decouverte", 3, "Jessica Toto", "07 45 12 89 63", ["Accras de morue", "Mini burger", "Verrine de crudités", "Samoussa poulet"], "confirmee", { notes: "Sans piment pour les enfants svp" }),
      o(3, "17h – 19h", "prestige", 1, "Stéphane Moreau", "06 33 21 45 87", ["Mini burger", "Accras de morue", "Mini bokit poulet", "Toast avocat crevette", "Dizé milé salé au poulet", "Mini quiche saumon"], "confirmee", { notes: "Anniversaire 40 ans" }),
      o(4, "10h – 12h", "signature", 1, "Nadia Rivière", "06 71 09 22 15", ["Accras de morue", "Kalawang (salade de mangue)", "Mini sandwich madras"], "confirmee", { pay_full: true, deposit_cents: 6500 }),
      o(11, "14h – 16h", "prestige", 2, "Lydie Marceau", "06 55 18 72 40", ["Accras de morue", "Mini burger", "Samoussa poulet"], "confirmee", { notes: "Baptême" }),
      o(9, "14h – 16h", "caraibes", 1, "Fabrice Delage", "07 82 63 14 50", ["Accras de morue", "Mini bokit poulet", "Dizé milé salé au poulet", "Verrine guacamole", "Kalawang (salade de mangue)"], "devis", { guests: 40, notes: "Pour un mariage, on peut en parler ?" })
    ];
  }

  function load() {
    if (DEMO) { if (!orders.length) orders = demoData(); render(); return Promise.resolve(); }
    return sb.from("orders")
      .select("*")
      .gte("pickup_date", addDays(today(), -60))
      .not("status", "in", "(attente_paiement,annulee)")
      .order("pickup_date", { ascending: true })
      .order("pickup_slot", { ascending: true })
      .then(function (res) {
        if (res.error) { toast("Impossible de charger les commandes"); console.error(res.error); return; }
        orders = res.data || [];
        render();
      });
  }

  function setStatus(id, status, btn) {
    if (btn) btn.disabled = true;
    var current = orders.filter(function (o) { return o.id === id; })[0] || {};
    var apply = function (msg, extra) {
      orders.forEach(function (o) { if (o.id === id) { o.status = status; Object.assign(o, extra || {}); } });
      render();
      toast(msg || { prete: "Box marquée prête", recuperee: "Commande récupérée", confirmee: "Remise à préparer", devis_traite: "Devis marqué traité", devis: "Devis remis en attente" }[status] || "Enregistré");
    };
    if (DEMO) {
      return status === "prete" && current.status === "confirmee"
        ? apply("Box prête — e-mail envoyé au client (démo)", { ready_email_sent_at: new Date().toISOString() })
        : apply();
    }

    // « Marquer prête » : passe par la fonction qui envoie l'e-mail avec l'adresse de retrait
    if (status === "prete" && current.status === "confirmee") {
      sb.functions.invoke("notify-ready", { body: { order_id: id } }).then(function (res) {
        if (res.error || !res.data || !res.data.ok) {
          toast("Erreur : la box n'a pas pu être marquée prête");
          if (btn) btn.disabled = false;
          return;
        }
        if (res.data.emailed) apply("Box prête — e-mail envoyé au client", { ready_email_sent_at: new Date().toISOString() });
        else if (res.data.already) apply("Box prête (le client avait déjà reçu l'e-mail)");
        else {
          console.error("E-mail non envoyé :", res.data.error);
          apply("Box prête, mais l'e-mail n'est pas parti (" + (res.data.error || "erreur inconnue") + ")");
        }
      });
      return;
    }
    sb.from("orders").update({ status: status }).eq("id", id).then(function (res) {
      if (res.error) { toast("Erreur : modification non enregistrée"); if (btn) btn.disabled = false; return; }
      apply();
    });
  }

  // ── Affichage ───────────────────────────────────────────
  function inPeriod(o) {
    var t = today();
    if (tab === "today") return o.pickup_date === t;
    if (tab === "week") return o.pickup_date >= t && o.pickup_date <= addDays(t, 6);
    return o.pickup_date >= t;
  }

  function render() {
    var showDone = $("#show-done").checked;
    var isQuotes = tab === "quotes";
    var quotes = orders.filter(function (o) { return o.status === "devis"; });
    $("#quote-badge").hidden = !quotes.length;
    $("#quote-badge").textContent = quotes.length;

    var sales = orders.filter(function (o) { return ["confirmee", "prete", "recuperee"].indexOf(o.status) !== -1 && inPeriod(o); });
    var visible = isQuotes
      ? orders.filter(function (o) { return o.status === "devis" || (showDone && o.status === "devis_traite"); })
      : sales.filter(function (o) { return showDone || o.status !== "recuperee"; });

    renderKpis(sales, quotes);
    renderList(visible, isQuotes);
    renderPrep(sales.filter(function (o) { return o.status === "confirmee"; }));
    $("#list-title").textContent = isQuotes ? "Demandes de devis" : "Retraits prévus";
    $(".toggle").lastChild.textContent = isQuotes ? " Afficher les devis traités" : " Afficher les commandes récupérées";
    $("#prep-panel").hidden = isQuotes;
  }

  function renderKpis(sales, quotes) {
    var toPrep = sales.filter(function (o) { return o.status === "confirmee"; });
    var nBoxes = toPrep.reduce(function (s, o) { return s + o.qty; }, 0);
    var nReady = sales.filter(function (o) { return o.status === "prete"; }).reduce(function (s, o) { return s + o.qty; }, 0);
    var paid = sales.reduce(function (s, o) { return s + (o.deposit_paid ? o.deposit_cents || 0 : 0); }, 0);
    var rest = sales.filter(function (o) { return o.status !== "recuperee"; })
      .reduce(function (s, o) { return s + ((o.total_cents || 0) - (o.deposit_paid ? o.deposit_cents || 0 : 0)); }, 0);
    var label = { today: "aujourd'hui", week: "sur 7 jours", all: "à venir", quotes: "à venir" }[tab];
    $("#kpis").innerHTML =
      kpi("Commandes", sales.length, label, "main") +
      kpi("Box à préparer", nBoxes, nReady + " déjà prête" + (nReady > 1 ? "s" : "")) +
      kpi("Déjà encaissé", eur(paid), label, "green") +
      kpi("Reste à encaisser", eur(rest), quotes.length + " devis en attente");
  }
  function kpi(label, value, sub, mod) {
    return '<div class="kpi' + (mod === "main" ? " kpi--main" : "") + '"><span class="kpi__label">' + esc(label) +
      '</span><span class="kpi__value' + (mod === "green" ? " kpi__value--green" : "") + '">' + esc(value) +
      '</span><span class="kpi__sub">' + esc(sub) + "</span></div>";
  }

  function renderList(list, isQuotes) {
    var box = $("#orders");
    if (!list.length) {
      box.innerHTML = '<div class="empty">' + (isQuotes ? "Aucune demande de devis en attente." : "Aucun retrait prévu sur cette période.") + "</div>";
      return;
    }
    var html = "", current = null, groups = {};
    list.forEach(function (o) { groups[o.pickup_date] = (groups[o.pickup_date] || 0) + 1; });
    list.forEach(function (o) {
      if (o.pickup_date !== current) {
        current = o.pickup_date;
        html += '<div class="day"><strong>' + esc(dayLabel(current)) + '</strong><span class="line"></span><span class="count">' +
          groups[current] + (isQuotes ? " demande" : " commande") + (groups[current] > 1 ? "s" : "") + "</span></div>";
      }
      html += orderCard(o);
    });
    box.innerHTML = html;
  }

  function orderCard(o) {
    var cls = o.status === "prete" ? " is-ready" : (o.status === "recuperee" || o.status === "devis_traite") ? " is-done" : "";
    var badges = spiceBadge(o.spice);
    if (o.status === "devis" || o.status === "devis_traite") {
      badges += '<span class="badge badge--quote">' + (o.status === "devis" ? "Devis à faire" : "Devis traité") + " · " + esc(o.guests) + " pers.</span>";
    } else {
      var restCents = (o.total_cents || 0) - (o.deposit_cents || 0);
      if (restCents <= 0) {
        badges += '<span class="badge badge--full">Payé en totalité · ' + eur(o.deposit_cents) + "</span>";
      } else {
        badges += '<span class="badge badge--paid">Acompte reçu · ' + eur(o.deposit_cents) + "</span>";
        badges += '<span class="badge">Reste ' + eur(restCents) + "</span>";
      }
      if (o.status === "prete") badges += '<span class="badge badge--ready">✓ Prête' + (o.ready_email_sent_at ? " · client prévenu par e-mail" : "") + "</span>";
      if (o.status === "recuperee") badges += '<span class="badge badge--done">Récupérée</span>';
    }
    var actions = "";
    if (o.status === "confirmee") actions = btn("prete", "Marquer prête", "ready") + btn("recuperee", "Récupérée", "ghost");
    if (o.status === "prete") actions = btn("recuperee", "Récupérée", "done") + btn("confirmee", "Pas encore prête", "ghost");
    if (o.status === "recuperee") actions = btn("prete", "Annuler « récupérée »", "ghost");
    if (o.status === "devis") actions = '<a class="act act--ready" href="' + esc(telHref(o.phone)) + '" style="text-align:center;text-decoration:none">Appeler</a>' + btn("devis_traite", "Devis traité", "ghost");
    if (o.status === "devis_traite") actions = btn("devis", "Remettre en attente", "ghost");

    return '<article class="order' + cls + '" data-id="' + esc(o.id) + '">' +
      '<div class="order__time"><small>' + (o.status.indexOf("devis") === 0 ? "Souhaité" : "Retrait") + "</small><strong>" + esc(o.pickup_slot) + "</strong></div>" +
      '<div class="order__body">' +
        '<div class="order__title"><b>' + esc(o.box_name) + "</b>" + (o.guests ? "" : '<span class="qty">× ' + esc(o.qty) + "</span>") + '<span class="ref">' + esc(o.ref) + "</span></div>" +
        '<div class="order__client">' + esc(o.customer_name) + ' · <a href="' + esc(telHref(o.phone)) + '">' + esc(o.phone) + "</a></div>" +
        '<div class="chips">' + (o.items || []).map(function (i) { return '<span class="chip">' + esc(i) + "</span>"; }).join("") + "</div>" +
        '<div class="badges">' + badges + "</div>" +
        (o.notes ? '<div class="order__note">« ' + esc(o.notes) + " »</div>" : "") +
      "</div>" +
      '<div class="order__actions">' + actions + "</div>" +
    "</article>";
  }
  function btn(status, label, kind) {
    return '<button type="button" class="act act--' + kind + '" data-status="' + status + '">' + esc(label) + "</button>";
  }

  function renderPrep(toPrep) {
    var labels = { today: "pour aujourd'hui", week: "sur les 7 prochains jours", all: "pour toutes les commandes à venir" };
    $("#prep-sub").textContent = "Box " + labels[tab] + ", hors box déjà prêtes.";
    var byBox = {}, byItem = {};
    toPrep.forEach(function (o) {
      var key = o.box_name + "|" + (Number(o.spice) || 0);
      byBox[key] = (byBox[key] || 0) + o.qty;
      var pieces = (PIECES[o.box_id] || 0) * o.qty;
      var n = (o.items || []).length;
      if (pieces && n) (o.items || []).forEach(function (i) { byItem[i] = (byItem[i] || 0) + pieces / n; });
    });
    var boxes = Object.keys(byBox).sort();
    $("#prep-boxes").innerHTML = boxes.length
      ? boxes.map(function (k) {
          var parts = k.split("|"), lvl = Number(parts[1]);
          return '<div class="prep__row"><span class="prep__box">' + esc(parts[0]) +
            '<small><span class="prep__chilis">' + chilis(lvl) + "</span>" + SPICE_LABELS[lvl] + "</small></span><b>" + byBox[k] + "</b></div>";
        }).join("")
      : '<p class="prep__sub">Tout est prêt, bravo !</p>';
    var items = Object.keys(byItem).sort(function (a, b) { return byItem[b] - byItem[a]; });
    $("#prep-items").innerHTML = items.length
      ? items.map(function (k) { return '<div class="prep__row prep__row--small"><span>' + esc(k) + "</span><b>≈ " + Math.round(byItem[k]) + "</b></div>"; }).join("")
      : "";
  }

  // ── Événements ──────────────────────────────────────────
  document.querySelectorAll(".tabs button").forEach(function (b) {
    b.addEventListener("click", function () {
      tab = b.dataset.tab;
      document.querySelectorAll(".tabs button").forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
      render();
    });
  });
  $("#show-done").addEventListener("change", render);
  $("#orders").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-status]");
    if (!b) return;
    setStatus(b.closest(".order").dataset.id, b.dataset.status, b);
  });
  $("#refresh-btn").addEventListener("click", function () { load().then(function () { toast("Commandes à jour"); }); });

  $("#today-label").textContent = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ── Connexion ───────────────────────────────────────────
  function showApp() { $("#login").hidden = true; $("#app").hidden = false; load(); }
  function showLogin() { $("#app").hidden = true; $("#login").hidden = false; }

  if (DEMO) {
    $("#demo-banner").hidden = false;
    $("#logout-btn").hidden = true;
    showApp();
    return;
  }
  if (!C.SUPABASE_URL || C.SUPABASE_URL.indexOf("VOTRE") !== -1 || !window.supabase) {
    showLogin();
    var err = $("#login-error");
    err.textContent = "Le tableau de bord n'est pas encore relié à Supabase (js/config.js). Astuce : ajoutez ?demo à l'adresse pour voir la démo.";
    err.hidden = false;
    return;
  }

  sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

  $("#login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target.elements;
    var err = $("#login-error");
    err.hidden = true;
    sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value }).then(function (res) {
      if (res.error) { err.textContent = "E-mail ou mot de passe incorrect."; err.hidden = false; return; }
      showApp();
    });
  });
  $("#logout-btn").addEventListener("click", function () { sb.auth.signOut().then(showLogin); });

  sb.auth.getSession().then(function (res) { if (res.data && res.data.session) showApp(); else showLogin(); });

  // Rafraîchissement automatique toutes les 2 minutes
  setInterval(function () { if (!$("#app").hidden && !document.hidden) load(); }, 120000);
})();
