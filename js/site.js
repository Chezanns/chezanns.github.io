// Chez Ann's — logique du site client
(function () {
  "use strict";
  var C = window.CHEZ_ANNS_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var state = { box: null, qty: 1, mode: "box", noel: {} };
  var cards = $$(".box-card");
  var checks = $$('.menu input[type="checkbox"]');

  // ── Utilitaires ──────────────────────────────────────────
  function euros(n) {
    return n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €";
  }
  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function parisToday() {
    // AAAA-MM-JJ dans le fuseau de Paris
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  }
  function addDays(iso, n) {
    var d = new Date(iso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function selectedItems() {
    return checks.filter(function (c) { return c.checked; });
  }
  function plural(n, one, many) { return n + " " + (n > 1 ? many : one); }

  // ── Niveau d'épices ──────────────────────────────────────
  var SPICE_LABELS = ["Pas épicé", "Peu épicé", "Épicé", "Ça décoiffe !"];
  function getSpice() {
    var r = $('input[name="spice"]:checked');
    return r ? Number(r.value) : null;
  }
  // Le même choix d'épices est proposé sous les Classiques et sous les Caraïbes : les deux restent synchronisés
  $$('input[name="spice"], input[name="spice_caraibes"]').forEach(function (r) {
    r.addEventListener("change", function () {
      var other = r.name === "spice" ? "spice_caraibes" : "spice";
      var twin = $('input[name="' + other + '"][value="' + r.value + '"]');
      if (twin) twin.checked = true;
      $$(".menu .spice-mini").forEach(function (g) { g.classList.remove("is-missing"); });
    });
  });

  // ── Choix de la box ──────────────────────────────────────
  function boxFromCard(card) {
    return {
      id: card.dataset.box,
      name: card.dataset.name,
      price: card.dataset.price ? Number(card.dataset.price) : null,
      max: Number(card.dataset.max),
      only: card.dataset.only || null,
      custom: card.dataset.custom === "1"
    };
  }

  function selectBox(card, scroll) {
    state.box = boxFromCard(card);
    cards.forEach(function (c) {
      var on = c === card;
      c.classList.toggle("is-selected", on);
      $(".pill", c).setAttribute("aria-pressed", on ? "true" : "false");
    });
    // Box Caraïbes : uniquement l'univers Caraïbes
    var lockClassique = state.box.only === "caraibes";
    $(".menu--classique").classList.toggle("is-locked", lockClassique);
    checks.forEach(function (c) {
      if (c.dataset.univers === "classique") {
        c.disabled = lockClassique;
        if (lockClassique) c.checked = false;
      }
    });
    // Trop de variétés cochées pour la nouvelle box : on garde les premières
    var sel = selectedItems();
    if (sel.length > state.box.max) {
      sel.slice(state.box.max).forEach(function (c) { c.checked = false; });
      toast("Cette box contient " + state.box.max + " variétés : on a gardé les " + state.box.max + " premières.");
    }
    if (state.box.id === "caraibes") distributeCarib();
    updateStatus();
    if (scroll) $("#compose").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  cards.forEach(function (card) {
    card.addEventListener("click", function () { selectBox(card, true); });
  });

  // ── Variétés ─────────────────────────────────────────────
  checks.forEach(function (c) {
    c.addEventListener("change", function () {
      if (!c.checked) return updateStatus();
      if (!state.box) {
        c.checked = false;
        toast("Choisissez d'abord votre box.");
        $("#box").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (selectedItems().length > state.box.max) {
        c.checked = false;
        toast("Maximum " + state.box.max + " variétés pour la " + state.box.name + ".");
      }
      updateStatus();
    });
  });

  // ── Box Caraïbes sur mesure ──────────────────────────────
  var K = C.CARAIBES || {};
  var KSTEP = K.STEP || 6, KPP = K.PIECES_PER_PERSON || 6;
  var KMIN = K.MIN_PERSONS || 6, KMAX = K.MAX_PERSONS || 150;
  state.carib = { persons: K.DEFAULT_PERSONS || 10, qty: {} };
  var caribChecks = checks.filter(function (c) { return c.dataset.univers === "caraibes"; });

  function isCarib() { return state.mode !== "noel" && !!state.box && state.box.id === "caraibes"; }
  function caribSelected() { return caribChecks.filter(function (c) { return c.checked; }); }
  function caribPieces() { return caribSelected().reduce(function (t, c) { return t + (state.carib.qty[c.value] || 0); }, 0); }
  function caribTotal() {
    return Math.round(caribSelected().reduce(function (t, c) { return t + (state.carib.qty[c.value] || 0) * (K.PRICES[c.value] || 0); }, 0) * 100) / 100;
  }
  function caribName(c) { return c.parentNode.textContent.trim(); }

  // Chaque mignardise Caraïbes reçoit son prix et un sélecteur de quantité
  caribChecks.forEach(function (c) {
    var label = c.parentNode;
    var row = document.createElement("div");
    row.className = "carib-row";
    row.dataset.id = c.value;
    label.parentNode.insertBefore(row, label);
    row.appendChild(label);
    var price = document.createElement("span");
    price.className = "carib-price";
    price.textContent = euros(K.PRICES[c.value] || 0) + " / pièce";
    row.appendChild(price);
    var st = document.createElement("div");
    st.className = "stepper";
    st.innerHTML = '<button type="button" data-cstep="-1">−</button><output>0</output><button type="button" data-cstep="1">+</button>';
    $('[data-cstep="-1"]', st).setAttribute("aria-label", "6 pièces de moins : " + caribName(c));
    $('[data-cstep="1"]', st).setAttribute("aria-label", "6 pièces de plus : " + caribName(c));
    row.appendChild(st);
    c.addEventListener("change", function () {
      if (isCarib()) { distributeCarib(); updateStatus(); }
    });
  });

  // Répartit (nombre de personnes × 6) pièces entre les mignardises cochées, par tranches de 6
  function distributeCarib() {
    var sel = caribSelected();
    state.carib.qty = {};
    if (!sel.length) return;
    var units = state.carib.persons * KPP / KSTEP;
    var base = Math.floor(units / sel.length), rem = units % sel.length;
    sel.forEach(function (c, i) { state.carib.qty[c.value] = Math.max(1, base + (i < rem ? 1 : 0)) * KSTEP; });
  }

  function renderCarib() {
    var on = isCarib();
    $(".menus").classList.toggle("is-carib", on);
    $("#carib-persons").hidden = !on;
    $("#carib-help").hidden = !on;
    $("#carib-total").hidden = !on || !caribSelected().length;
    if (!on) return;
    $("#carib-n").textContent = state.carib.persons;
    $("#carib-minus").disabled = state.carib.persons <= KMIN;
    $("#carib-plus").disabled = state.carib.persons >= KMAX;
    caribChecks.forEach(function (c) {
      var row = c.closest(".carib-row");
      var q = c.checked ? state.carib.qty[c.value] || 0 : 0;
      row.classList.toggle("is-on", c.checked);
      $("output", row).textContent = q + " pc";
      $('[data-cstep="-1"]', row).disabled = q <= KSTEP;
    });
    var pieces = caribPieces(), total = caribTotal(), advised = state.carib.persons * KPP;
    $("#carib-pieces").textContent = pieces + " pièces pour " + state.carib.persons + " personnes";
    $("#carib-price").textContent = euros(total);
    var sub = $("#carib-sub");
    var msg = "soit " + euros(Math.round(total / state.carib.persons * 100) / 100) + " par personne";
    var warn = false;
    if (pieces !== advised) { msg += " · conseillé : " + advised + " pièces"; }
    if (pieces < KMIN * KPP) { msg = "Minimum " + (KMIN * KPP) + " pièces (" + KMIN + " personnes)"; warn = true; }
    else if (pieces > (K.BIG_PIECES || 240)) msg += " · plus de " + (K.BIG_PIECES || 240) + " pièces : " + (K.BIG_LEAD_DAYS || 5) + " jours de préparation";
    sub.textContent = msg;
    sub.classList.toggle("is-warn", warn);
  }

  function setPersons(n) {
    state.carib.persons = Math.min(KMAX, Math.max(KMIN, n));
    distributeCarib();
    updateStatus();
  }
  $("#carib-minus").addEventListener("click", function () { setPersons(state.carib.persons - 1); });
  $("#carib-plus").addEventListener("click", function () { setPersons(state.carib.persons + 1); });
  $("#carib-list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-cstep]");
    if (!b || !isCarib()) return;
    var id = b.closest(".carib-row").dataset.id;
    var q = (state.carib.qty[id] || 0) + Number(b.dataset.cstep) * KSTEP;
    state.carib.qty[id] = Math.min(600, Math.max(KSTEP, q));
    updateStatus();
  });

  function updateStatus() {
    renderCarib();
    var status = $("#compose-status");
    var bar = $("#cartbar");
    if (!state.box) {
      status.textContent = "Choisissez d'abord une box ci-dessus.";
      bar.hidden = true;
      syncBars();
      return;
    }
    var n = selectedItems().length;
    var left = state.box.max - n;
    status.textContent = state.box.name + " : " + n + " / " + state.box.max + " variétés choisies" +
      (left > 0 ? " — encore " + left + " au choix" : " — c'est complet !");
    bar.hidden = false;
    if (isCarib()) {
      $("#cartbar-name").textContent = state.box.name + " · " + (n ? euros(caribTotal()) : "dès 9 €/pers.");
      $("#cartbar-count").textContent = plural(n, "variété", "variétés") + " · " + caribPieces() + " pièces pour " + state.carib.persons + " pers.";
    } else {
      $("#cartbar-name").textContent = state.box.name + (state.box.price ? " · " + euros(state.box.price) : " · sur devis");
      $("#cartbar-count").textContent = plural(n, "variété choisie", "variétés choisies") + " sur " + state.box.max;
    }
    $("#cartbar-go").disabled = n === 0;
    syncBars();
  }

  // ── Fenêtre de commande ──────────────────────────────────
  var dlg = $("#order-dialog");
  var form = $("#order-form");
  var pct = Number(C.DEPOSIT_PERCENT || 50);

  // Créneaux + infos de retrait
  var slotSelect = $("#slot-select");
  (C.SLOTS || ["10h – 12h", "14h – 16h", "17h – 19h"]).forEach(function (s) {
    var o = document.createElement("option");
    o.value = s; o.textContent = s;
    slotSelect.appendChild(o);
  });
  $("#pickup-place").textContent = C.PICKUP_PLACE || "Essonne (91)";
  $("#pickup-info").textContent = C.PICKUP_INFO || "";
  $("#recap-pct").textContent = pct;

  function payFull() {
    var r = $('input[name="pay_mode"]:checked');
    return !!r && r.value === "total";
  }
  $$('input[name="pay_mode"]').forEach(function (r) {
    r.addEventListener("change", function () { renderRecap(); });
  });

  function isQuote() { return state.mode !== "noel" && !!state.box && state.box.price === null && !state.box.custom; }

  function renderRecap() {
    if (state.mode === "noel") return renderNoelRecap();
    $("#recap-pct").textContent = pct;
    $("#recap-spice").hidden = false;
    var b = state.box;
    var custom = isCarib();
    $("#recap-name").textContent = custom ? b.name + " · " + state.carib.persons + " personnes" : b.name;
    $("#qty-value").textContent = state.qty;
    var list = $("#recap-items");
    list.innerHTML = "";
    selectedItems().forEach(function (c) {
      var li = document.createElement("li");
      li.textContent = c.parentNode.textContent.trim() + (custom ? " × " + (state.carib.qty[c.value] || 0) : "");
      list.appendChild(li);
    });
    var spice = getSpice() || 0;
    var chilis = "";
    for (var i = 0; i < Math.max(1, spice); i++) {
      chilis += '<svg class="chili"' + (spice ? "" : ' style="filter:grayscale(1);opacity:.4"') + ' aria-hidden="true"><use href="#chili"/></svg>';
    }
    $("#recap-spice").innerHTML = chilis + "<span>" + SPICE_LABELS[spice] + "</span>";

    var quote = isQuote();
    $("#qty-wrap").hidden = quote || custom;
    $("#recap-money").hidden = quote;
    $("#recap-quote").hidden = !quote;
    $$(".quote-only", form).forEach(function (el) {
      el.hidden = !quote;
      $("input", el).required = quote;
    });
    $("#date-label").textContent = quote ? "Date souhaitée *" : "Date de retrait *";
    $("#submit-btn").textContent = quote ? "Envoyer ma demande de devis" : payFull() ? "Payer et réserver" : "Payer l'acompte et réserver";
    $("#consent-text").textContent = quote
      ? "J'accepte les conditions générales de vente et j'ai bien noté que le retrait se fait en " + (C.PICKUP_PLACE || "Essonne (91)") + " et qu'Annie me recontacte avec un devis."
      : "J'accepte les conditions générales de vente et j'ai bien noté que le retrait se fait en " + (C.PICKUP_PLACE || "Essonne (91)") +
        (payFull() ? "" : ", que le solde est à régler sur place") +
        " et que l'acompte n'est pas remboursable en cas d'annulation moins de 48 h avant le retrait.";
    $("#cancel-note").hidden = quote;
    if (!quote) {
      var total = custom ? caribTotal() : b.price * state.qty;
      var dep = Math.round(total * pct) / 100;
      $("#recap-total").textContent = euros(total);
      $("#recap-deposit").textContent = euros(dep);
      $("#recap-rest").textContent = euros(Math.round((total - dep) * 100) / 100);
      $("#recap-full").textContent = euros(total);
    }
  }

  $("#qty-minus").addEventListener("click", function () { state.qty = Math.max(1, state.qty - 1); renderRecap(); });
  $("#qty-plus").addEventListener("click", function () { state.qty = Math.min(10, state.qty + 1); renderRecap(); });

  $("#cartbar-go").addEventListener("click", function () {
    if (!state.box || !selectedItems().length) return;
    state.mode = "box";
    if (getSpice() === null) {
      $$(".menu .spice-mini").forEach(function (g) {
        g.classList.remove("is-missing");
        void g.offsetWidth; // relance l'animation
        g.classList.add("is-missing");
      });
      $(state.box.only === "caraibes" ? "#spice-caraibes" : "#spice").scrollIntoView({ behavior: "smooth", block: "center" });
      toast("Choisissez le niveau d'épices de votre box.");
      return;
    }
    if (isCarib() && caribPieces() < KMIN * KPP) {
      toast("La Box Caraïbes se commande à partir de " + (KMIN * KPP) + " pièces (" + KMIN + " personnes).");
      return;
    }
    var big = isCarib() && caribPieces() > (K.BIG_PIECES || 240);
    var min = addDays(parisToday(), big ? Number(K.BIG_LEAD_DAYS || 5) : Number(C.LEAD_DAYS || 3));
    openOrder(min, "", (big
      ? "Plus de " + (K.BIG_PIECES || 240) + " pièces : " + (K.BIG_LEAD_DAYS || 5) + " jours de préparation minimum, premier jour possible le <strong>"
      : "Commande au moins 72 h avant le retrait : premier jour possible le <strong>") + dayFr(min) + "</strong>.");
  });

  function dayFr(iso, opts) {
    return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", opts || { weekday: "long", day: "numeric", month: "long" });
  }
  function openOrder(min, max, hint) {
    var dateInput = form.elements.pickup_date;
    dateInput.min = min;
    dateInput.max = max;
    $("#date-hint").innerHTML = hint;
    if (!dateInput.value || dateInput.value < min || (max && dateInput.value > max)) dateInput.value = "";
    $("#form-error").hidden = true;
    renderRecap();
    dlg.showModal();
  }

  $$("[data-close]").forEach(function (b) {
    b.addEventListener("click", function () { b.closest("dialog").close(); });
  });
  $$("dialog").forEach(function (d) {
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
  });

  function showError(msg) {
    var e = $("#form-error");
    e.textContent = msg;
    e.hidden = false;
    e.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = form.elements;
    var phoneDigits = (f.phone.value || "").replace(/\D/g, "");
    if (!f.customer_name.value.trim()) return showError("Indiquez votre prénom et votre nom.");
    if (phoneDigits.length < 9) return showError("Indiquez un numéro de téléphone valide.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())) return showError("Indiquez une adresse e-mail valide.");
    if (isQuote() && !(Number(f.guests.value) > 0)) return showError("Indiquez le nombre de personnes.");
    if (!f.pickup_date.value) return showError("Choisissez une date.");
    if (f.pickup_date.value < f.pickup_date.min) return showError("La date doit être au plus tôt le " + dayFr(f.pickup_date.min) + ".");
    if (f.pickup_date.max && f.pickup_date.value > f.pickup_date.max) return showError("La date doit être au plus tard le " + dayFr(f.pickup_date.max) + ".");
    if (!f.consent.checked) return showError("Merci de cocher la case de confirmation.");

    if (!C.SUPABASE_URL || C.SUPABASE_URL.indexOf("VOTRE") !== -1) {
      return showError("Le site n'est pas encore relié à Supabase (fichier js/config.js).");
    }

    var customer = {
      customer_name: f.customer_name.value.trim(),
      phone: f.phone.value.trim(),
      email: f.email.value.trim(),
      pickup_date: f.pickup_date.value,
      pickup_slot: f.pickup_slot.value,
      notes: f.notes.value.trim(),
      pay_full: !isQuote() && payFull()
    };
    var payload = state.mode === "noel" ? Object.assign({
      kind: "noel",
      lines: noelLines().map(function (l) { return { id: l.p.id, qty: l.qty }; }),
      spice: noelHasBoudin() ? getNoelSpice() : 0,
      boudin_fresh: noelHasBoudin() && getNoelFresh()
    }, customer) : {
      box_id: state.box.id,
      qty: isQuote() || isCarib() ? 1 : state.qty,
      carib_lines: isCarib() ? caribSelected().map(function (c) { return { id: c.value, qty: state.carib.qty[c.value] }; }) : undefined,
      items: selectedItems().map(function (c) { return c.value; }),
      spice: getSpice(),
      pay_full: !isQuote() && payFull(),
      customer_name: f.customer_name.value.trim(),
      phone: f.phone.value.trim(),
      email: f.email.value.trim(),
      pickup_date: f.pickup_date.value,
      pickup_slot: f.pickup_slot.value,
      notes: f.notes.value.trim(),
      guests: isCarib() ? state.carib.persons : isQuote() ? Number(f.guests.value) : null
    };

    var btn = $("#submit-btn");
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Un instant…";
    $("#form-error").hidden = true;

    fetch(C.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": C.SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + C.SUPABASE_ANON_KEY
      },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.body && res.body.error || "Erreur");
        if (res.body.url) { window.location.href = res.body.url; return; }
        // Demande de devis enregistrée
        dlg.close();
        showReturn("Demande envoyée !", "Votre demande de devis (réf. " + res.body.ref + ") est bien arrivée. Annie vous recontacte très vite par téléphone ou par e-mail.");
        resetAll();
      })
      .catch(function (err) {
        showError(err.message && err.message !== "Erreur" && err.message !== "Failed to fetch"
          ? err.message
          : "Impossible d'envoyer la commande pour le moment. Réessayez dans un instant.");
      })
      .then(function () { btn.disabled = false; btn.textContent = label; });
  });

  function resetAll() {
    checks.forEach(function (c) { c.checked = false; c.disabled = false; });
    $$('input[name="spice"], input[name="spice_caraibes"]').forEach(function (r) { r.checked = false; });
    cards.forEach(function (c) { c.classList.remove("is-selected"); $(".pill", c).setAttribute("aria-pressed", "false"); });
    $(".menu--classique").classList.remove("is-locked");
    state.box = null; state.qty = 1;
    state.carib = { persons: K.DEFAULT_PERSONS || 10, qty: {} };
    form.reset();
    var dflt = $('input[name="pay_mode"][value="acompte"]');
    if (dflt) dflt.checked = true;
    updateStatus();
  }


  // ── Boutique de Noël ─────────────────────────────────────
  var N = C.NOEL || {};
  var noelPct = Number(N.DEPOSIT_PERCENT || 50);
  var noelProducts = N.PRODUCTS || [];

  function qtyLabel(p, q) {
    if (p.unit === "kg") return q < 1000 ? q + " g" : (q / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " kg";
    if (p.unit === "litre") return q + " L";
    return q + " pièce" + (q > 1 ? "s" : "");
  }
  function linePrice(p, q) { return p.unit === "kg" ? Math.round(p.price * q / 10) / 100 : Math.round(p.price * q * 100) / 100; }
  function noelLines() {
    return noelProducts.filter(function (p) { return state.noel[p.id] > 0; })
      .map(function (p) { var q = state.noel[p.id]; return { p: p, qty: q, price: linePrice(p, q) }; });
  }
  function noelTotal() { return noelLines().reduce(function (s, l) { return s + l.price; }, 0); }
  function boudinGrams() {
    return noelProducts.filter(function (p) { return p.group === "boudins"; })
      .reduce(function (s, p) { return s + (state.noel[p.id] || 0); }, 0);
  }
  function noelHasBoudin() { return boudinGrams() > 0; }
  function getNoelFresh() {
    var r = $('input[name="noel_state"]:checked');
    return !!r && r.value === "frais";
  }
  function getNoelSpice() {
    var r = $('input[name="noel_spice"]:checked');
    return r ? Number(r.value) : null;
  }

  function noelOpen() {
    var today = parisToday();
    var visible = N.ENABLED !== false && today <= (N.LAST_PICKUP || "2026-12-22");
    var orderable = visible && today <= (N.LAST_ORDER_DAY || "2026-12-11");
    return { visible: visible, orderable: orderable };
  }

  function renderNoel() {
    var st = noelOpen();
    $("#noel").hidden = !st.visible;
    $(".nav__noel").hidden = !st.visible;
    $("#hero-noel").hidden = !st.visible;
    if (!st.visible) return;
    $("#noel-dates").textContent = st.orderable
      ? "Commandes jusqu'au " + dayFr(N.LAST_ORDER_DAY) + " · Retrait du " + dayFr(N.FIRST_PICKUP, { day: "numeric" }) + " au " + dayFr(N.LAST_PICKUP, { day: "numeric", month: "long" })
      : "Retraits jusqu'au " + dayFr(N.LAST_PICKUP);
    $("#noel-closed").hidden = st.orderable;
    $("#noel-groups").hidden = !st.orderable;
    if (!st.orderable) { $("#noelbar").hidden = true; return; }

    ["douceurs", "boudins"].forEach(function (g) {
      var box = $("#noel-" + g);
      if (box.childElementCount) return;
      noelProducts.filter(function (p) { return p.group === g; }).forEach(function (p) {
        var el = document.createElement("div");
        el.className = "noel-item";
        el.dataset.id = p.id;
        var price = euros(p.price) + (p.unit === "kg" ? " le kilo" : p.unit === "litre" ? " le litre" : " la pièce");
        el.innerHTML =
          (p.img ? '<button type="button" class="noel-item__img" data-zoom><img alt="" loading="lazy"></button>' : "") +
          '<div class="noel-item__txt">' +
            '<span class="noel-item__name"></span>' +
            (p.desc ? '<span class="noel-item__desc"></span>' : "") +
            '<span class="noel-item__price"></span>' +
            '<span class="noel-item__line" aria-live="polite"></span>' +
          "</div>" +
          '<div class="stepper">' +
            '<button type="button" data-step="-1">−</button>' +
            "<output>0</output>" +
            '<button type="button" data-step="1">+</button>' +
          "</div>";
        $(".noel-item__name", el).textContent = p.name;
        if (p.img) {
          var im = $(".noel-item__img img", el);
          im.src = p.img;
          im.alt = p.name;
          $(".noel-item__img", el).setAttribute("aria-label", "Voir la photo : " + p.name);
          $(".noel-item__img", el).dataset.large = p.imgLarge || p.img;
        }
        if (p.desc) $(".noel-item__desc", el).textContent = p.desc;
        $(".noel-item__price", el).textContent = price + (p.min > 1 ? " · min. " + qtyLabel(p, p.min) : "");
        $('[data-step="-1"]', el).setAttribute("aria-label", "Retirer " + p.name);
        $('[data-step="1"]', el).setAttribute("aria-label", "Ajouter " + p.name);
        box.appendChild(el);
      });
    });
    updateNoel();
  }

  function stepNoel(id, dir) {
    var p = noelProducts.filter(function (x) { return x.id === id; })[0];
    var q = state.noel[id] || 0;
    if (dir > 0) {
      var next = q === 0 ? p.min : q + p.step;
      if (p.group === "boudins" && boudinGrams() - q + next > (N.MAX_BOUDIN_G || 10000)) {
        toast("Maximum " + qtyLabel({ unit: "kg" }, N.MAX_BOUDIN_G || 10000) + " de boudin par commande.");
        return;
      }
      q = next;
    } else {
      q = q - p.step < p.min ? 0 : q - p.step;
    }
    state.noel[id] = q;
    updateNoel();
  }

  function updateNoel() {
    $$(".noel-item").forEach(function (el) {
      var p = noelProducts.filter(function (x) { return x.id === el.dataset.id; })[0];
      var q = state.noel[p.id] || 0;
      $("output", el).textContent = q ? qtyLabel(p, q) : "0";
      $(".noel-item__line", el).textContent = q ? "= " + euros(linePrice(p, q)) : "";
      $('[data-step="-1"]', el).disabled = !q;
      el.classList.toggle("has-qty", q > 0);
    });
    var lines = noelLines();
    var bar = $("#noelbar");
    bar.hidden = !lines.length;
    $("#noelbar-total").textContent = euros(noelTotal());
    var g = boudinGrams();
    $("#noelbar-count").textContent = lines.length + " produit" + (lines.length > 1 ? "s" : "") +
      (g ? " · " + qtyLabel({ unit: "kg" }, g) + " de boudin" : "");
    $("#noel-spice").hidden = !g;
    $("#noel-state").hidden = !g;
    syncBars();
  }
  function syncBars() {
    var stack = !$("#cartbar").hidden && !$("#noelbar").hidden;
    $("#noelbar").classList.toggle("cartbar--stack", stack);
  }

  $("#noel").addEventListener("click", function (e) {
    var z = e.target.closest("[data-zoom]");
    if (z) {
      $("#photo-img").src = z.dataset.large;
      $("#photo-img").alt = $("img", z).alt;
      $("#photo-dialog").showModal();
      return;
    }
    var b = e.target.closest("[data-step]");
    if (!b) return;
    stepNoel(b.closest(".noel-item").dataset.id, Number(b.dataset.step));
  });
  $$('input[name="noel_spice"]').forEach(function (r) {
    r.addEventListener("change", function () { $("#noel-spice").classList.remove("is-missing"); });
  });

  $("#noelbar-go").addEventListener("click", function () {
    if (!noelLines().length) return;
    if (noelHasBoudin() && getNoelSpice() === null) {
      var sp = $("#noel-spice");
      sp.classList.remove("is-missing");
      void sp.offsetWidth;
      sp.classList.add("is-missing");
      sp.scrollIntoView({ behavior: "smooth", block: "center" });
      toast("Choisissez le niveau d'épices de vos boudins.");
      return;
    }
    state.mode = "noel";
    var big = boudinGrams() > (N.BIG_ORDER_G || 8000);
    var min = addDays(parisToday(), big ? Number(N.BIG_LEAD_DAYS || 5) : Number(C.LEAD_DAYS || 3));
    if (min < N.FIRST_PICKUP) min = N.FIRST_PICKUP;
    if (min > N.LAST_PICKUP) {
      toast(big
        ? "Plus de " + qtyLabel({ unit: "kg" }, N.BIG_ORDER_G || 8000) + " de boudin demande 5 jours de préparation : ce n'est plus possible avant le " + dayFr(N.LAST_PICKUP) + ". Réduisez la quantité."
        : "Il n'y a plus de date de retrait disponible pour Noël.");
      return;
    }
    openOrder(min, N.LAST_PICKUP,
      (big ? "Plus de " + qtyLabel({ unit: "kg" }, N.BIG_ORDER_G || 8000) + " de boudin : 5 jours de préparation minimum. " : "") +
      "Retrait possible du <strong>" + dayFr(min) + "</strong> au <strong>" + dayFr(N.LAST_PICKUP) + "</strong>.");
  });

  function renderNoelRecap() {
    $("#recap-name").textContent = "Commande de Noël";
    $("#qty-wrap").hidden = true;
    var list = $("#recap-items");
    list.innerHTML = "";
    noelLines().forEach(function (l) {
      var li = document.createElement("li");
      li.textContent = l.p.name + " · " + qtyLabel(l.p, l.qty) + " · " + euros(l.price);
      list.appendChild(li);
    });
    var hasB = noelHasBoudin();
    $("#recap-spice").hidden = !hasB;
    if (hasB) {
      var sp = getNoelSpice() || 0, ch = "";
      for (var i = 0; i < Math.max(1, sp); i++) ch += '<svg class="chili"' + (sp ? "" : ' style="filter:grayscale(1);opacity:.4"') + ' aria-hidden="true"><use href="#chili"/></svg>';
      $("#recap-spice").innerHTML = ch + "<span>Boudins : " + SPICE_LABELS[sp] + " · " + (getNoelFresh() ? "frais" : "congelés") + "</span>";
    }
    $("#recap-money").hidden = false;
    $("#recap-quote").hidden = true;
    $$(".quote-only", form).forEach(function (el) { el.hidden = true; $("input", el).required = false; });
    $("#date-label").textContent = "Date de retrait *";
    $("#recap-pct").textContent = noelPct;
    var total = noelTotal();
    var dep = Math.round(total * noelPct) / 100;
    $("#recap-total").textContent = euros(total);
    $("#recap-deposit").textContent = euros(dep);
    $("#recap-rest").textContent = euros(Math.round((total - dep) * 100) / 100);
    $("#recap-full").textContent = euros(total);
    $("#submit-btn").textContent = payFull() ? "Payer et réserver" : "Payer l'acompte et réserver";
    $("#consent-text").textContent = "J'accepte les conditions générales de vente et j'ai bien noté que le retrait se fait en " + (C.PICKUP_PLACE || "Essonne (91)") +
      (payFull() ? "" : ", que le solde est à régler sur place") +
      " et que l'acompte n'est pas remboursable en cas d'annulation moins de 48 h avant le retrait.";
    $("#cancel-note").hidden = false;
  }

  function resetNoel() {
    state.noel = {};
    $$('input[name="noel_spice"]').forEach(function (r) { r.checked = false; });
    var cg = $('input[name="noel_state"][value="congele"]'); if (cg) cg.checked = true;
    updateNoel();
  }

  renderNoel();

  // ── Retour après paiement Stripe ─────────────────────────
  function showReturn(title, text) {
    $("#return-title").textContent = title;
    $("#return-text").textContent = text;
    $("#return-dialog").showModal();
  }
  var params = new URLSearchParams(window.location.search);
  if (params.get("commande") === "ok") {
    showReturn("Merci !", "Votre paiement est bien reçu et votre commande" +
      (params.get("ref") ? " (réf. " + params.get("ref") + ")" : "") +
      " est confirmée. Un e-mail de confirmation vient de vous être envoyé : pensez à regarder dans vos spams si vous ne le voyez pas. " + (C.PICKUP_INFO || ""));
  } else if (params.get("commande") === "annulee") {
    showReturn("Paiement annulé", "Aucun montant n'a été débité. Vous pouvez recommencer votre commande quand vous voulez.");
  }
  if (params.has("commande")) {
    history.replaceState(null, "", window.location.pathname + window.location.hash);
  }

  // ── Pied de page ────────────────────────────────────────
  $("#year").textContent = new Date().getFullYear();
  var links = [];
  if (C.INSTAGRAM_URL) links.push('<a href="' + encodeURI(C.INSTAGRAM_URL) + '" target="_blank" rel="noopener">Instagram</a>');
  if (C.CONTACT_PHONE) links.push('<a href="tel:' + C.CONTACT_PHONE.replace(/[^\d+]/g, "") + '">' + C.CONTACT_PHONE.replace(/[<>&"]/g, "") + "</a>");
  if (links.length) $("#footer-links").innerHTML = " · " + links.join(" · ");

  // Menu actif au défilement
  var navLinks = $$(".nav a");
  var sections = navLinks.map(function (a) { return $(a.getAttribute("href")); });
  window.addEventListener("scroll", function () {
    var y = window.scrollY + 140, current = 0, best = -1;
    sections.forEach(function (s, i) { if (s && s.offsetTop <= y && s.offsetTop > best) { best = s.offsetTop; current = i; } });
    navLinks.forEach(function (a, i) { a.classList.toggle("is-active", i === current); });
  }, { passive: true });
})();
