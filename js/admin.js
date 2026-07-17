/* =====================================================================
   TOP HOOPS — Admin (login, dashboard, mails, PDF)
   Communique avec le backend via window.TOP_HOOPS_API_URL.
   Le token JWT est stocke en localStorage et envoye en Bearer.
   ===================================================================== */
(function () {
  "use strict";

  var API = (window.TOP_HOOPS_API_URL || "http://localhost:3001").replace(/\/$/, "");
  var TOKEN_KEY = "topHoops_admin_token";
  var $ = function (id) { return document.getElementById(id); };

  function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  function api(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers["Content-Type"] = "application/json";
    var tk = getToken();
    if (tk) headers["Authorization"] = "Bearer " + tk;
    return fetch(API + path, {
      method: opts.method || "GET",
      headers: headers,
      credentials: "include",
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { ok: r.ok, status: r.status, data: d };
      });
    });
  }

  function feedback(el, msg, isError) {
    if (!el) return;
    el.classList.add("show");
    el.style.color = isError ? "#ff8f8f" : "";
    el.textContent = msg;
  }

  var state = { all: [], filter: "all", search: "", currentId: null, mailMode: null };

  // Icones SVG (contour)
  var IC = {
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.2 6.2A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4-.9"/><path d="M9.5 10.5a3 3 0 0 0 4 4"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"/></svg>',
    resend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v5h-5"/></svg>',
    reject: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 8l8 8"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
  };

  // Bouton mail contextuel : "Envoyer" si pas encore confirmé, sinon état "confirmé" + renvoi possible
  function mailButton(r) {
    if (r.mail_sent) {
      return '<button class="icon-btn ok" data-mailconfirmed="1" data-remail="' + r.id + '" title="Déjà confirmé — renvoyer le mail" aria-label="Déjà confirmé, renvoyer le mail">' + IC.check + "</button>";
    }
    return '<button class="icon-btn" data-mail="' + r.id + '" title="Envoyer le mail de confirmation" aria-label="Envoyer le mail de confirmation">' + IC.mail + "</button>";
  }

  // Toggle "oeil" sur tous les champs mot de passe
  function initPasswordToggles() {
    document.querySelectorAll('input[type="password"]').forEach(function (inp) {
      if (inp.parentElement && inp.parentElement.classList.contains("pw-wrap")) return;
      var wrap = document.createElement("span");
      wrap.className = "pw-wrap";
      inp.parentNode.insertBefore(wrap, inp);
      wrap.appendChild(inp);
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "pw-toggle";
      btn.setAttribute("aria-label", "Afficher le mot de passe");
      btn.innerHTML = IC.eye;
      btn.addEventListener("click", function () {
        var show = inp.type === "password";
        inp.type = show ? "text" : "password";
        btn.innerHTML = show ? IC.eyeOff : IC.eye;
        btn.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe");
      });
      wrap.appendChild(btn);
    });
  }

  /* ---------- VUES ---------- */
  function showLogin() { $("loginView").hidden = false; $("dashboardView").hidden = true; }
  function showDashboard(withWelcome) {
    $("loginView").hidden = true;
    if (withWelcome) {
      var ov = $("welcomeOverlay");
      ov.classList.remove("hide");
      setTimeout(function () { ov.classList.add("hide"); }, 2600);
    }
    $("dashboardView").hidden = false;
    loadStats();
    loadRegistrations();
    loadSentEmails();
  }

  /* ---------- AUTH ---------- */
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    api("/api/auth/login", { method: "POST", body: { username: $("loginUser").value.trim(), password: $("loginPass").value } })
      .then(function (r) {
        if (r.ok && r.data.token) {
          setToken(r.data.token);
          showDashboard(true);
        } else {
          feedback($("loginFeedback"), (r.data && r.data.error) || "Connexion impossible.", true);
        }
      })
      .catch(function () { feedback($("loginFeedback"), "Serveur injoignable. Verifie que le backend tourne.", true); });
  });

  $("showForgot").addEventListener("click", function () { $("loginForm").hidden = true; $("forgotForm").hidden = false; });
  $("backToLogin").addEventListener("click", function () { $("forgotForm").hidden = true; $("loginForm").hidden = false; });

  $("forgotForm").addEventListener("submit", function (e) {
    e.preventDefault();
    api("/api/auth/forgot-password", { method: "POST", body: { email: $("forgotEmail").value.trim() } })
      .then(function (r) { feedback($("forgotFeedback"), (r.data && r.data.message) || "Si un compte existe, un e-mail a ete envoye.", false); });
  });

  $("resetForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var token = new URLSearchParams(location.search).get("reset");
    api("/api/auth/reset-password", { method: "POST", body: {
      token: token, newPassword: $("resetPass").value, confirmPassword: $("resetConfirm").value
    } }).then(function (r) {
      if (r.ok) { feedback($("resetFeedback"), "Mot de passe reinitialise. Tu peux te connecter.", false); setTimeout(function () { location.href = "admin.html"; }, 1500); }
      else { feedback($("resetFeedback"), (r.data && r.data.error) || "Lien invalide ou expire.", true); }
    });
  });

  $("btnLogout").addEventListener("click", function () {
    api("/api/auth/logout", { method: "POST" }).finally(function () { setToken(null); location.href = "admin.html"; });
  });

  /* ---------- STATS ---------- */
  function loadStats() {
    api("/api/admin/stats").then(function (r) {
      if (!r.ok) return;
      $("kpiTotal").textContent = r.data.total;
      $("kpiSummer").textContent = r.data.summerleague;
      $("kpiLigue").textContent = r.data.ligue_top_hoops;
      if ($("kpiPending")) $("kpiPending").textContent = r.data.pending != null ? r.data.pending : "-";
      if ($("kpiConfirmed")) $("kpiConfirmed").textContent = r.data.confirmed != null ? r.data.confirmed : "-";
      if ($("kpiRejected")) $("kpiRejected").textContent = r.data.rejected != null ? r.data.rejected : "-";
      if ($("kpiPaid")) $("kpiPaid").textContent = r.data.payments_received != null ? r.data.payments_received : "-";
      if ($("kpiUnpaid")) $("kpiUnpaid").textContent = r.data.payments_pending != null ? r.data.payments_pending : "-";
      if ($("kpiMethodTransfer")) $("kpiMethodTransfer").textContent = r.data.method_transfer != null ? r.data.method_transfer : "-";
      if ($("kpiMethodCash")) $("kpiMethodCash").textContent = r.data.method_cash != null ? r.data.method_cash : "-";
      if ($("kpiMethodNone")) $("kpiMethodNone").textContent = r.data.method_none != null ? r.data.method_none : "-";
      var last = (r.data.latest && r.data.latest[0]);
      $("kpiLatest").textContent = last ? (last.first_name + " " + last.last_name) : "-";
    });
  }

  /* ---------- LISTE ---------- */
  var EVENT_LABEL = { summerleague: "Summer League", ligue_top_hoops: "Ligue Top Hoops" };

  function loadRegistrations() {
    var q = "?";
    var f = state.filter;
    if (f && f !== "all") {
      if (f.indexOf("status:") === 0) q += "status=" + f.slice(7) + "&";
      else if (f.indexOf("event:") === 0) q += "event=" + f.slice(6) + "&";
      else if (f.indexOf("payment:") === 0) q += "payment=" + f.slice(8) + "&";
      else if (f.indexOf("method:") === 0) q += "payment_method=" + f.slice(7) + "&";
      else q += "event=" + f + "&"; // rétrocompat
    }
    if (state.search) q += "search=" + encodeURIComponent(state.search);
    api("/api/admin/registrations" + q).then(function (r) {
      if (r.status === 401) { setToken(null); showLogin(); return; }
      state.all = (r.data && r.data.registrations) || [];
      renderTable();
    });
  }

  // Badge de statut d'un joueur (pending / confirmed / rejected)
  var REG_STATUS = {
    confirmed: { cls: "ok", label: "Confirmé" },
    rejected: { cls: "danger", label: "Refusé" },
    pending: { cls: "warn", label: "En attente" }
  };
  function regStatusBadge(status) {
    var s = REG_STATUS[status] || REG_STATUS.pending;
    return '<span class="status-badge ' + s.cls + '">' + s.label + "</span>";
  }
  function mailCell(r) {
    if (r.mail_sent) {
      var d = r.mail_sent_at ? fmtDateTime(r.mail_sent_at) : "";
      return '<span class="status-badge ok">Envoyé</span>' + (d ? '<span class="mail-when">' + esc(d) + "</span>" : "");
    }
    return '<span class="status-badge muted">Non envoyé</span>';
  }
  // Mode de paiement DÉCLARÉ par le joueur (≠ paiement reçu)
  function paymentMethodLabel(m) {
    if (m === "cash") return "Espèces";
    if (m === "bank_transfer") return "Virement";
    return "Non renseigné";
  }
  function paymentMethodBadge(m) {
    if (!m) return '<span class="status-badge muted">Non renseigné</span>';
    return '<span class="status-badge method">' + paymentMethodLabel(m) + "</span>";
  }
  // Select éditable du mode de paiement (géré par l'admin) + badge
  function paymentMethodSelectCell(r) {
    var m = r.payment_method || "";
    function opt(v, label) { return '<option value="' + v + '"' + (m === v ? " selected" : "") + ">" + label + "</option>"; }
    return '<div class="method-cell">' +
      '<select class="payment-method-select" data-method="' + r.id + '" aria-label="Mode de paiement de ' + esc((r.first_name || "") + " " + (r.last_name || "")) + '">' +
        opt("", "Non renseigné") + opt("bank_transfer", "Virement") + opt("cash", "Espèces") +
      "</select>" +
      '<span class="method-badge-wrap">' + paymentMethodBadge(r.payment_method) + "</span>" +
    "</div>";
  }
  // Handler commun (tableau + fiche détail) : mise à jour sans rechargement
  document.addEventListener("change", function (e) {
    var sel = e.target;
    if (!sel.matches || !sel.matches("select.payment-method-select")) return;
    var id = sel.dataset.method;
    var value = sel.value === "" ? null : sel.value;
    sel.disabled = true;
    api("/api/admin/registrations/" + id + "/payment-method", { method: "PATCH", body: { payment_method: value } })
      .then(function (res) {
        sel.disabled = false;
        if (!res.ok) { alert("Mise à jour du mode de paiement impossible."); loadRegistrations(); return; }
        var row = state.all.find(function (x) { return x.id === id; });
        if (row) row.payment_method = value;
        // MAJ du badge à côté du select (dans le tableau)
        var wrap = sel.closest(".method-cell") && sel.closest(".method-cell").querySelector(".method-badge-wrap");
        if (wrap) wrap.innerHTML = paymentMethodBadge(value);
        loadStats(); // rafraîchit les KPI modes de paiement
      })
      .catch(function () { sel.disabled = false; alert("Serveur injoignable."); loadRegistrations(); });
  });

  // Cellule paiement : checkbox premium (toggle AJAX) + badge de statut
  function paymentCell(r) {
    var paid = r.payment_received === true;
    return '<div class="pay-cell">' +
      '<label class="pay-check' + (paid ? " checked" : "") + '" title="Cocher quand le paiement est reçu">' +
        '<input type="checkbox" data-pay="' + r.id + '"' + (paid ? " checked" : "") + '>' +
        '<span class="pay-box">' + IC.check + '</span>' +
        '<span class="pay-text">Paiement reçu</span>' +
      '</label>' +
      '<span class="status-badge ' + (paid ? "ok" : "warn") + ' pay-badge">' + (paid ? "Payé" : "En attente de paiement") + "</span>" +
    "</div>";
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]); }); }
  function fmtDate(d) { try { return new Date(d).toLocaleDateString("fr-FR"); } catch (e) { return d; } }

  function renderTable() {
    var tbody = $("regTbody");
    tbody.innerHTML = "";
    $("regEmpty").hidden = state.all.length > 0;
    state.all.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + esc(r.last_name) + "</td>" +
        "<td>" + esc(r.first_name) + "</td>" +
        "<td>" + esc(r.age || "") + "</td>" +
        "<td>" + esc(r.position || "") + "</td>" +
        "<td>" + esc(r.level || "") + "</td>" +
        "<td>" + esc(r.registration_fee_accepted || "-") + "</td>" +
        '<td><span class="tag-event">' + esc(EVENT_LABEL[r.event_type] || r.event_type) + "</span></td>" +
        "<td>" + regStatusBadge(r.status) + "</td>" +
        '<td class="method-col">' + paymentMethodSelectCell(r) + "</td>" +
        '<td class="pay-col">' + paymentCell(r) + "</td>" +
        '<td class="mail-col">' + mailCell(r) + "</td>" +
        "<td>" + esc(r.email) + "</td>" +
        "<td>" + esc(r.phone || "") + "</td>" +
        "<td>" + fmtDate(r.created_at) + "</td>" +
        '<td class="no-print"><div class="row-actions">' +
          '<button class="icon-btn" data-view="' + r.id + '" title="Voir details" aria-label="Voir details">' + IC.eye + "</button>" +
          mailButton(r) +
          (r.status !== "rejected"
            ? '<button class="icon-btn danger" data-reject="' + r.id + '" title="Refuser le joueur" aria-label="Refuser le joueur">' + IC.reject + "</button>"
            : "") +
          '<button class="icon-btn danger" data-del="' + r.id + '" title="Supprimer" aria-label="Supprimer">' + IC.trash + "</button>" +
        "</div></td>";
      tbody.appendChild(tr);
    });
  }

  // Delegation d'evenements sur le tableau
  $("regTbody").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.view) openDetail(b.dataset.view);
    else if (b.dataset.mail) openMailSingle(b.dataset.mail);
    else if (b.dataset.remail) {
      if (confirm("Ce joueur a déjà été confirmé. Renvoyer un mail ?")) openMailSingle(b.dataset.remail);
    }
    else if (b.dataset.reject) rejectReg(b.dataset.reject);
    else if (b.dataset.del) deleteReg(b.dataset.del);
  });

  // Toggle paiement (mise à jour instantanée sans rechargement)
  $("regTbody").addEventListener("change", function (e) {
    var cb = e.target;
    if (!cb.matches || !cb.matches('input[data-pay]')) return;
    var id = cb.dataset.pay;
    var paid = cb.checked;
    cb.disabled = true;
    api("/api/admin/registrations/" + id + "/payment", { method: "PATCH", body: { payment_received: paid } })
      .then(function (res) {
        cb.disabled = false;
        if (!res.ok) { cb.checked = !paid; alert("Mise à jour du paiement impossible."); return; }
        // MAJ locale + visuelle sans recharger toute la liste
        var row = state.all.find(function (x) { return x.id === id; });
        if (row) row.payment_received = paid;
        var label = cb.closest(".pay-check");
        if (label) label.classList.toggle("checked", paid);
        var badge = cb.closest(".pay-cell") && cb.closest(".pay-cell").querySelector(".pay-badge");
        if (badge) {
          badge.className = "status-badge " + (paid ? "ok" : "warn") + " pay-badge";
          badge.textContent = paid ? "Payé" : "En attente de paiement";
        }
        loadStats(); // rafraîchit les KPI paiements
      })
      .catch(function () { cb.disabled = false; cb.checked = !paid; alert("Serveur injoignable."); });
  });

  // Refuser un joueur (aucun mail envoyé)
  function rejectReg(id) {
    var r = state.all.find(function (x) { return x.id === id; });
    var who = r ? (r.first_name + " " + r.last_name) : "ce joueur";
    if (!confirm("Refuser " + who + " ? (aucun mail ne sera envoyé)")) return;
    api("/api/admin/registrations/" + id + "/status", { method: "PATCH", body: { status: "rejected" } }).then(function (res) {
      if (res.ok) { loadStats(); loadRegistrations(); }
      else alert("Impossible de refuser ce joueur.");
    });
  }

  // Filtres inscriptions (statut + événement)
  document.querySelectorAll(".filter-btn[data-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".filter-btn[data-filter]").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      state.filter = btn.getAttribute("data-filter");
      loadRegistrations();
    });
  });

  // Recherche (debounce)
  var searchTimer;
  $("searchInput").addEventListener("input", function () {
    clearTimeout(searchTimer);
    var v = this.value;
    searchTimer = setTimeout(function () { state.search = v; loadRegistrations(); }, 300);
  });

  /* ---------- DETAIL ---------- */
  function openDetail(id) {
    var r = state.all.find(function (x) { return x.id === id; });
    if (!r) return;
    state.currentId = id;
    $("detailTitle").textContent = r.first_name + " " + r.last_name;
    var rows = [
      ["Nom", r.last_name], ["Prenom", r.first_name], ["Age", r.age], ["Email", r.email],
      ["Telephone", r.phone], ["Poste", r.position], ["Taille", r.height],
      ["Taille maillot", r.jersey_size], ["Taille short", r.short_size],
      ["Niveau", r.level], ["Instagram", r.instagram], ["Frais 20\u20ac acceptes", r.registration_fee_accepted], ["Evenement", EVENT_LABEL[r.event_type] || r.event_type]
    ];
    var html = rows.map(function (p) {
      return '<div class="d-item"><span>' + p[0] + "</span><strong>" + esc(p[1] || "-") + "</strong></div>";
    }).join("");
    html += '<div class="d-item"><span>Statut</span><strong>' + regStatusBadge(r.status) + "</strong></div>";
    html += '<div class="d-item"><span>Mode de paiement</span><strong>' + paymentMethodSelectCell(r) + "</strong></div>";
    html += '<div class="d-item"><span>Paiement reçu</span><strong>' + (r.payment_received ? "Oui" : "Non") + "</strong></div>";
    html += '<div class="d-item"><span>Mail de confirmation</span><strong>' + mailCell(r) + "</strong></div>";
    html += '<div class="d-item full"><span>Date d\'inscription</span><strong>' + fmtDate(r.created_at) + "</strong></div>";
    $("detailBody").innerHTML = html;
    openModal("detailModal");
  }
  $("detailMailBtn").addEventListener("click", function () { closeModal("detailModal"); openMailSingle(state.currentId); });

  /* ---------- SUPPRESSION ---------- */
  function deleteReg(id) {
    if (!confirm("Supprimer definitivement cette inscription ?")) return;
    api("/api/admin/registrations/" + id, { method: "DELETE" }).then(function (r) {
      if (r.ok) { loadStats(); loadRegistrations(); }
      else alert("Suppression impossible.");
    });
  }

  /* ---------- MAIL ---------- */
  function openMailSingle(id) {
    var r = state.all.find(function (x) { return x.id === id; });
    state.mailMode = { ids: [id] };
    $("mailTarget").textContent = r ? ("Destinataire : " + r.first_name + " " + r.last_name + " (" + r.email + ")") : "";
    openModal("mailModal");
  }
  $("btnMailFiltered").addEventListener("click", function () {
    var n = state.all.length;
    if (!n) { alert("Aucun joueur dans le filtre affiche."); return; }
    state.mailMode = { ids: state.all.map(function (r) { return r.id; }) };
    var label = state.filter === "all" ? "tous les joueurs" : EVENT_LABEL[state.filter];
    $("mailTarget").textContent = "Destinataires : " + label + " (" + n + " joueur(s))";
    openModal("mailModal");
  });
  $("mailForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var body = { recipient_ids: state.mailMode.ids, subject: $("mailSubject").value, body: $("mailBody").value };
    var btn = this.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = "Envoi...";
    api("/api/admin/send-email", { method: "POST", body: body }).then(function (r) {
      btn.disabled = false; btn.textContent = "Envoyer";
      if (r.ok) {
        feedback($("mailFeedback"), "Envoye a " + r.data.sent + "/" + r.data.total + " joueur(s). Statut : Confirme.", false);
        $("mailForm").reset();
        loadStats();
        loadRegistrations();
        loadSentEmails();
        setTimeout(function () { closeModal("mailModal"); }, 1400);
      } else feedback($("mailFeedback"), (r.data && r.data.error) || "Envoi impossible.", true);
    });
  });

  /* ---------- CHANGE PASSWORD ---------- */
  $("btnChangePw").addEventListener("click", function () { openModal("pwModal"); });
  $("pwForm").addEventListener("submit", function (e) {
    e.preventDefault();
    api("/api/auth/change-password", { method: "POST", body: {
      currentPassword: $("pwCurrent").value, newPassword: $("pwNew").value, confirmPassword: $("pwConfirm").value
    } }).then(function (r) {
      if (r.ok) { feedback($("pwFeedback"), "Mot de passe modifie.", false); $("pwForm").reset(); setTimeout(function () { closeModal("pwModal"); }, 1200); }
      else feedback($("pwFeedback"), (r.data && r.data.error) || "Modification impossible.", true);
    });
  });

  /* ---------- MODALES (util) ---------- */
  function openModal(id) { $(id).classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeModal(id) { $(id).classList.remove("open"); document.body.style.overflow = ""; }
  document.querySelectorAll(".admin-modal").forEach(function (m) {
    m.addEventListener("click", function (e) {
      if (e.target === m || e.target.hasAttribute("data-close")) closeModal(m.id);
    });
  });

  /* ---------- PDF + IMPRESSION ---------- */
  function filterLabel() { return state.filter === "all" ? "Tous" : EVENT_LABEL[state.filter]; }

  $("btnExportPdf").addEventListener("click", function () {
    if (!window.jspdf) { alert("Librairie PDF non chargee."); return; }
    var doc = new window.jspdf.jsPDF();
    doc.setFontSize(16); doc.text("Top Hoops - Liste des joueurs inscrits", 14, 18);
    doc.setFontSize(10); doc.setTextColor(90);
    doc.text("Date d'export : " + new Date().toLocaleDateString("fr-FR"), 14, 25);
    doc.text("Filtre : " + filterLabel(), 14, 30);
    var STATUS_FR = { confirmed: "Confirme", rejected: "Refuse", pending: "En attente" };
    var METHOD_FR = { cash: "Especes", bank_transfer: "Virement" };
    var rows = state.all.map(function (r) {
      var mail = r.mail_sent ? ("Oui" + (r.mail_sent_at ? " (" + fmtDate(r.mail_sent_at) + ")" : "")) : "Non";
      var pay = r.payment_received ? "Paye" : "Non paye";
      var method = METHOD_FR[r.payment_method] || "Non renseigne";
      return [r.last_name, r.first_name, r.position || "", r.level || "", r.age || "",
              STATUS_FR[r.status] || "En attente", method, pay, mail];
    });
    doc.autoTable({
      head: [["Nom", "Prenom", "Poste", "Niveau", "Age", "Statut", "Mode paiement", "Paiement", "Mail envoye"]],
      body: rows, startY: 36, styles: { fontSize: 8 },
      headStyles: { fillColor: [133, 218, 237], textColor: [6, 8, 11] }
    });
    doc.save("top-hoops-inscrits-" + state.filter + ".pdf");
  });

  $("btnPrint").addEventListener("click", function () { window.print(); });

  /* ---------- HISTORIQUE DES MAILS ENVOYÉS ---------- */
  var mailState = { all: [], filter: "all", search: "", currentId: null };
  var MAIL_TYPE_LABEL = {
    admin_custom: "Mail admin",
    player_confirmation: "Confirmation joueur",
    admin_notification: "Notification chef de projet",
    password_reset: "Mot de passe",
    other: "Autre"
  };

  function loadSentEmails() {
    var q = "?";
    var f = mailState.filter;
    if (f !== "all") {
      if (f.indexOf("type:") === 0) q += "email_type=" + f.slice(5) + "&";
      else if (f.indexOf("status:") === 0) q += "status=" + f.slice(7) + "&";
      else if (f.indexOf("event:") === 0) q += "event_type=" + f.slice(6) + "&";
    }
    if (mailState.search) q += "search=" + encodeURIComponent(mailState.search);
    api("/api/admin/sent-emails" + q).then(function (r) {
      if (r.status === 401) { setToken(null); showLogin(); return; }
      mailState.all = (r.data && r.data.emails) || [];
      renderMailStats(r.data && r.data.stats);
      renderMailTable();
    });
  }

  function renderMailStats(stats) {
    stats = stats || {};
    $("mailKpiSent").textContent = stats.sent != null ? stats.sent : "-";
    $("mailKpiFailed").textContent = stats.failed != null ? stats.failed : "-";
    $("mailKpiTotal").textContent = stats.total != null ? stats.total : "-";
    var last = stats.latest;
    if (last) {
      var who = (last.recipient_first_name || last.recipient_last_name)
        ? ((last.recipient_first_name || "") + " " + (last.recipient_last_name || "")).trim()
        : last.recipient_email;
      $("mailKpiLatest").textContent = who + " — " + fmtDate(last.created_at);
    } else { $("mailKpiLatest").textContent = "-"; }
  }

  function statusBadge(s) {
    var cls = s === "failed" ? "danger" : (s === "pending" ? "warn" : "ok");
    var label = s === "failed" ? "Échec" : (s === "pending" ? "En attente" : "Envoyé");
    return '<span class="status-badge ' + cls + '">' + label + "</span>";
  }

  function renderMailTable() {
    var tbody = $("mailTbody");
    tbody.innerHTML = "";
    $("mailEmpty").hidden = mailState.all.length > 0;
    mailState.all.forEach(function (m) {
      var name = ((m.recipient_first_name || "") + " " + (m.recipient_last_name || "")).trim() || m.recipient_email || "—";
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + esc(name) + "</td>" +
        '<td><span class="tag-event">' + esc(EVENT_LABEL[m.event_type] || "—") + "</span></td>" +
        "<td>" + fmtDate(m.created_at) + "</td>" +
        "<td>" + esc(fmtTime(m.created_at)) + "</td>" +
        "<td>" + esc(m.sent_by || "—") + "</td>" +
        "<td>" + esc(m.subject || "") + "</td>" +
        "<td>" + statusBadge(m.status) + "</td>" +
        '<td class="no-print"><div class="row-actions">' +
          '<button class="icon-btn" data-mailview="' + m.id + '" title="Voir le détail" aria-label="Voir le détail">' + IC.eye + "</button>" +
          '<button class="icon-btn" data-mailresend="' + m.id + '" title="Renvoyer" aria-label="Renvoyer">' + IC.resend + "</button>" +
        "</div></td>";
      tbody.appendChild(tr);
    });
  }

  $("mailTbody").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.mailview) openSentEmailDetail(b.dataset.mailview);
    else if (b.dataset.mailresend) resendEmail(b.dataset.mailresend);
  });

  document.querySelectorAll(".mail-filter").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".mail-filter").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      mailState.filter = btn.getAttribute("data-mailfilter");
      loadSentEmails();
    });
  });

  var mailSearchTimer;
  $("mailSearchInput").addEventListener("input", function () {
    clearTimeout(mailSearchTimer);
    var v = this.value;
    mailSearchTimer = setTimeout(function () { mailState.search = v; loadSentEmails(); }, 300);
  });

  function openSentEmailDetail(id) {
    mailState.currentId = id;
    api("/api/admin/sent-emails/" + id).then(function (r) {
      if (!r.ok || !r.data.email) { alert("Mail introuvable."); return; }
      var m = r.data.email;
      var name = ((m.recipient_first_name || "") + " " + (m.recipient_last_name || "")).trim() || "—";
      $("mailDetailTitle").textContent = "Mail à " + name;
      var rows = [
        ["Destinataire", name],
        ["Email", m.recipient_email],
        ["Événement", EVENT_LABEL[m.event_type] || "—"],
        ["Type de mail", MAIL_TYPE_LABEL[m.email_type] || m.email_type || "—"],
        ["Sujet", m.subject],
        ["Envoyé par", m.sent_by || "—"],
        ["ID Resend", m.resend_email_id || "—"]
      ];
      var html = rows.map(function (p) {
        return '<div class="d-item"><span>' + p[0] + "</span><strong>" + esc(p[1] || "-") + "</strong></div>";
      }).join("");
      html += '<div class="d-item"><span>Statut</span><strong>' + statusBadge(m.status) + "</strong></div>";
      html += '<div class="d-item full"><span>Date d\'envoi</span><strong>' + fmtDateTime(m.created_at) + "</strong></div>";
      if (m.status === "failed" && m.error_message) {
        html += '<div class="d-item full"><span>Erreur</span><strong class="text-danger">' + esc(m.error_message) + "</strong></div>";
      }
      $("mailDetailBody").innerHTML = html;
      $("mailDetailMessage").textContent = m.body || "";
      feedback($("mailDetailFeedback"), "", false);
      $("mailDetailFeedback").classList.remove("show");
      openModal("mailDetailModal");
    });
  }

  $("mailResendBtn").addEventListener("click", function () {
    if (mailState.currentId) resendEmail(mailState.currentId, $("mailDetailFeedback"));
  });

  function resendEmail(id, fbEl) {
    if (!confirm("Renvoyer ce mail au destinataire ?")) return;
    api("/api/admin/sent-emails/" + id + "/resend", { method: "POST" }).then(function (r) {
      if (r.ok) {
        if (fbEl) feedback(fbEl, "Mail renvoyé.", false);
        loadSentEmails();
        if (!fbEl) alert("Mail renvoyé.");
      } else {
        var msg = (r.data && r.data.error) || "Renvoi impossible.";
        if (fbEl) feedback(fbEl, msg, true); else alert(msg);
      }
    });
  }

  function fmtDateTime(d) { try { return new Date(d).toLocaleString("fr-FR"); } catch (e) { return d; } }
  function fmtTime(d) { try { return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }

  // Export CSV de l'historique des mails
  $("btnExportMailsCsv").addEventListener("click", function () {
    if (!mailState.all.length) { alert("Aucun mail à exporter."); return; }
    var cols = ["Joueur", "Email", "Événement", "Date", "Heure", "Envoyé par", "Sujet", "Statut"];
    function csvCell(v) { v = String(v == null ? "" : v).replace(/"/g, '""'); return '"' + v + '"'; }
    var lines = [cols.map(csvCell).join(",")];
    mailState.all.forEach(function (m) {
      var name = ((m.recipient_first_name || "") + " " + (m.recipient_last_name || "")).trim();
      lines.push([
        name, m.recipient_email, EVENT_LABEL[m.event_type] || "",
        fmtDate(m.created_at), fmtTime(m.created_at), m.sent_by || "",
        m.subject || "", m.status || ""
      ].map(csvCell).join(","));
    });
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "top-hoops-historique-mails.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  /* ---------- INIT ---------- */
  (function init() {
    initPasswordToggles();
    var resetToken = new URLSearchParams(location.search).get("reset");
    if (resetToken) { showLogin(); $("loginForm").hidden = true; $("resetForm").hidden = false; return; }
    if (getToken()) {
      api("/api/auth/me").then(function (r) {
        if (r.ok) showDashboard(false);
        else { setToken(null); showLogin(); }
      }).catch(function () { showLogin(); });
    } else {
      showLogin();
    }
    document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  })();

})();
