// Chez Ann's — logique du site client
(function () {
  "use strict";
  var C = window.CHEZ_ANNS_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var state = { box: null, qty: 1 };
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
  $$('input[name="spice"]').forEach(function (r) {
    r.addEventListener("change", function () { $("#spice").classList.remove("is-missing"); });
  });

  // ── Choix de la box ──────────────────────────────────────
  function boxFromCard(card) {
    return {
      id: card.dataset.box,
      name: card.dataset.name,
      price: card.dataset.price ? Number(card.dataset.price) : null,
      max: Number(card.dataset.max),
      only: card.dataset.only || null
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

  function updateStatus() {
    var status = $("#compose-status");
    var bar = $("#cartbar");
    if (!state.box) {
      status.textContent = "Choisissez d'abord une box ci-dessus.";
      bar.hidden = true;
      return;
    }
    var n = selectedItems().length;
    var left = state.box.max - n;
    status.textContent = state.box.name + " : " + n + " / " + state.box.max + " variétés choisies" +
      (left > 0 ? " — encore " + left + " au choix" : " — c'est complet !");
    bar.hidden = false;
    $("#cartbar-name").textContent = state.box.name + (state.box.price ? " · " + euros(state.box.price) : " · sur devis");
    $("#cartbar-count").textContent = plural(n, "variété choisie", "variétés choisies") + " sur " + state.box.max;
    $("#cartbar-go").disabled = n === 0;
  }

  // ── Fenêtre de commande ──────────────────────────────────
  var dlg = $("#order-dialog");
  var form = $("#order-form");
  var pct = Number(C.DEPOSIT_PERCENT || 30);

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

  function isQuote() { return state.box && state.box.price === null; }

  function renderRecap() {
    var b = state.box;
    $("#recap-name").textContent = b.name;
    $("#qty-value").textContent = state.qty;
    var list = $("#recap-items");
    list.innerHTML = "";
    selectedItems().forEach(function (c) {
      var li = document.createElement("li");
      li.textContent = c.parentNode.textContent.trim();
      list.appendChild(li);
    });
    var spice = getSpice() || 0;
    var chilis = "";
    for (var i = 0; i < Math.max(1, spice); i++) {
      chilis += '<svg class="chili"' + (spice ? "" : ' style="filter:grayscale(1);opacity:.4"') + ' aria-hidden="true"><use href="#chili"/></svg>';
    }
    $("#recap-spice").innerHTML = chilis + "<span>" + SPICE_LABELS[spice] + "</span>";

    var quote = isQuote();
    $("#qty-wrap").hidden = quote;
    $("#recap-money").hidden = quote;
    $("#recap-quote").hidden = !quote;
    $$(".quote-only", form).forEach(function (el) {
      el.hidden = !quote;
      $("input", el).required = quote;
    });
    $("#date-label").textContent = quote ? "Date souhaitée *" : "Date de retrait *";
    $("#submit-btn").textContent = quote ? "Envoyer ma demande de devis" : payFull() ? "Payer et réserver" : "Payer l'acompte et réserver";
    $("#consent-text").textContent = quote
      ? "J'ai bien noté que le retrait se fait en " + (C.PICKUP_PLACE || "Essonne (91)") + " et qu'Annie me recontacte avec un devis."
      : "J'ai bien noté que le retrait se fait en " + (C.PICKUP_PLACE || "Essonne (91)") +
        (payFull() ? "." : " et que le solde est à régler sur place.");
    if (!quote) {
      var total = b.price * state.qty;
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
    if (getSpice() === null) {
      var sp = $("#spice");
      sp.classList.remove("is-missing");
      void sp.offsetWidth; // relance l'animation
      sp.classList.add("is-missing");
      sp.scrollIntoView({ behavior: "smooth", block: "center" });
      toast("Choisissez le niveau d'épices de votre box.");
      return;
    }
    var min = addDays(parisToday(), Number(C.LEAD_DAYS || 2));
    var dateInput = form.elements.pickup_date;
    dateInput.min = min;
    if (!dateInput.value || dateInput.value < min) dateInput.value = "";
    $("#form-error").hidden = true;
    renderRecap();
    dlg.showModal();
  });

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
    if (f.pickup_date.value < f.pickup_date.min) return showError("La date doit être au plus tôt le " + new Date(f.pickup_date.min + "T12:00:00").toLocaleDateString("fr-FR") + ".");
    if (!f.consent.checked) return showError("Merci de cocher la case de confirmation.");

    if (!C.SUPABASE_URL || C.SUPABASE_URL.indexOf("VOTRE") !== -1) {
      return showError("Le site n'est pas encore relié à Supabase (fichier js/config.js).");
    }

    var payload = {
      box_id: state.box.id,
      qty: isQuote() ? 1 : state.qty,
      items: selectedItems().map(function (c) { return c.value; }),
      spice: getSpice(),
      pay_full: !isQuote() && payFull(),
      customer_name: f.customer_name.value.trim(),
      phone: f.phone.value.trim(),
      email: f.email.value.trim(),
      pickup_date: f.pickup_date.value,
      pickup_slot: f.pickup_slot.value,
      notes: f.notes.value.trim(),
      guests: isQuote() ? Number(f.guests.value) : null
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
    $$('input[name="spice"]').forEach(function (r) { r.checked = false; });
    cards.forEach(function (c) { c.classList.remove("is-selected"); $(".pill", c).setAttribute("aria-pressed", "false"); });
    $(".menu--classique").classList.remove("is-locked");
    state.box = null; state.qty = 1;
    form.reset();
    var dflt = $('input[name="pay_mode"][value="acompte"]');
    if (dflt) dflt.checked = true;
    updateStatus();
  }

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
      " est confirmée. Vous recevez le reçu par e-mail. " + (C.PICKUP_INFO || ""));
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
