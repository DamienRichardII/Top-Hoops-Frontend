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

  var state = { all: [], filter: "all", search: "", currentId: null, mailMode: null, category: "seniors" };

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
    api("/api/admin/stats?category=" + state.category).then(function (r) {
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
    var q = "?category=" + state.category + "&";
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
  // Mode de paiement renseigné par l'admin (≠ paiement reçu)
  function paymentMethodLabel(m) {
    if (m === "cash") return "Espèces";
    if (m === "bank_transfer") return "Virement bancaire";
    if (m === "paypal") return "PayPal";
    if (m === "revolut") return "Revolut";
    return "Non renseigné";
  }
  // Un paiement électronique (≠ espèces) => ligne verte
  function isElectronic(m) { return m === "bank_transfer" || m === "paypal" || m === "revolut"; }
  // Classe de couleur de LIGNE, basée uniquement sur la valeur technique payment_method
  // (cash=rouge, électronique=vert, sinon neutre). Fonction unique réutilisée partout.
  function getPaymentRowClass(m) {
    if (m === "cash") return "payment-method-cash";
    if (isElectronic(m)) return "payment-method-transfer";
    return "payment-method-unknown";
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
        opt("", "Non renseigné") + opt("bank_transfer", "Virement bancaire") +
        opt("paypal", "PayPal") + opt("revolut", "Revolut") + opt("cash", "Espèces") +
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
        // MAJ immédiate de la COULEUR DE LIGNE (toutes les cellules via la classe du <tr>)
        var tr = sel.closest("tr");
        if (tr) {
          tr.classList.remove("payment-method-cash", "payment-method-transfer", "payment-method-unknown");
          tr.classList.add(getPaymentRowClass(value));
        }
        // MAJ du badge à côté du select (dans le tableau)
        var wrap = sel.closest(".method-cell") && sel.closest(".method-cell").querySelector(".method-badge-wrap");
        if (wrap) wrap.innerHTML = paymentMethodBadge(value);
        loadStats(); // rafraîchit les KPI modes de paiement
        // Si un filtre "mode de paiement" est actif et que la ligne n'y correspond plus, recalcul propre
        if (state.filter && state.filter.indexOf("method:") === 0) loadRegistrations();
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
      tr.className = getPaymentRowClass(r.payment_method);
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

  // Onglets catégorie (Seniors / U23) — chaque onglet est indépendant
  document.querySelectorAll(".admin-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".admin-tab").forEach(function (t) {
        t.classList.remove("active"); t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active"); tab.setAttribute("aria-selected", "true");
      state.category = tab.getAttribute("data-category");
      if ($("kpiTotalLabel")) $("kpiTotalLabel").textContent = state.category === "u23" ? "Total U23" : "Total Seniors";
      loadStats();
      loadRegistrations();
    });
  });

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
  // Libellé de l'événement pour l'en-tête d'export
  function eventExportLabel() {
    if (state.filter && state.filter.indexOf("event:") === 0) return EVENT_LABEL[state.filter.slice(6)] || "Tous";
    return "Tous";
  }

  // Tri OBLIGATOIRE : Électroniques (virement/paypal/revolut) -> Espèces -> Non renseigné,
  // puis Nom + Prénom (alpha FR) à l'intérieur de chaque groupe.
  function paymentSortKey(m) { return isElectronic(m) ? 0 : (m === "cash" ? 1 : 2); }
  function sortByPaymentMethod(list) {
    return list.slice().sort(function (a, b) {
      var ao = paymentSortKey(a.payment_method), bo = paymentSortKey(b.payment_method);
      if (ao !== bo) return ao - bo;
      return ((a.last_name || "") + " " + (a.first_name || ""))
        .localeCompare((b.last_name || "") + " " + (b.first_name || ""), "fr", { sensitivity: "base" });
    });
  }

  var PDF_STATUS_FR = { confirmed: "Confirme", rejected: "Refuse", pending: "En attente" };
  var PDF_METHOD_FR = { cash: "Especes", bank_transfer: "Virement bancaire", paypal: "PayPal", revolut: "Revolut" };
  // Définition des 3 groupes (ordre + couleurs). Fonds clairs + texte foncé = lisible.
  // "match" identifie l'appartenance au groupe selon payment_method.
  var PDF_GROUPS = [
    { match: function (m) { return isElectronic(m); }, title: "JOUEURS - PAIEMENTS ELECTRONIQUES (VIREMENT / PAYPAL / REVOLUT)", fill: [215, 245, 222], text: [15, 70, 35], bar: [15, 70, 35] },
    { match: function (m) { return m === "cash"; },    title: "JOUEURS - PAIEMENT EN ESPECES", fill: [255, 220, 220], text: [105, 20, 20], bar: [105, 20, 20] },
    { match: function (m) { return !m; },              title: "JOUEURS - MODE NON RENSEIGNE", fill: [235, 238, 242], text: [40, 45, 50], bar: [90, 95, 100] }
  ];

  $("btnExportPdf").addEventListener("click", function () {
    if (!window.jspdf) { alert("Librairie PDF non chargee."); return; }
    var doc = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    var M = 14;

    // En-tête (DA Top Hoops)
    doc.setTextColor(6, 8, 11); doc.setFontSize(16); doc.setFont(undefined, "bold");
    var catLabel = state.category === "u23" ? "U23" : "Seniors";
    doc.text("TOP HOOPS - LISTE FINALE DES JOUEURS - " + catLabel.toUpperCase(), M, 15);
    doc.setFont(undefined, "normal"); doc.setFontSize(10); doc.setTextColor(90);
    doc.text("Categorie : " + catLabel + "     Evenement : " + eventExportLabel(), M, 22);
    doc.text("Date d'export : " + new Date().toLocaleDateString("fr-FR"), M, 27);

    // Légende (carrés colorés + libellés) — compréhensible même en N&B via les libellés
    var lx = M, ly = 32.5, sq = 4;
    [[[215,245,222],"Vert : paiement par virement"],
     [[255,220,220],"Rouge : paiement en especes"],
     [[235,238,242],"Gris : mode non renseigne"]].forEach(function (item) {
      doc.setFillColor(item[0][0], item[0][1], item[0][2]);
      doc.setDrawColor(150); doc.rect(lx, ly - 3.2, sq, sq, "FD");
      doc.setTextColor(40); doc.setFontSize(9);
      doc.text(item[1], lx + sq + 2, ly);
      lx += doc.getTextWidth(item[1]) + sq + 12;
    });

    var head = [["Nom", "Prenom", "Age", "Poste", "Niveau", "Statut", "Mode de paiement", "Paiement recu", "Mail envoye"]];
    var sorted = sortByPaymentMethod(state.all);
    var startY = 38;
    var printedAny = false;

    PDF_GROUPS.forEach(function (g) {
      var players = sorted.filter(function (r) { return g.match(r.payment_method); });
      if (!players.length) return;
      printedAny = true;

      // Barre de sous-titre du groupe (fond foncé + texte blanc), sans données joueur
      doc.setFillColor(g.bar[0], g.bar[1], g.bar[2]);
      doc.rect(M, startY, 269, 7, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont(undefined, "bold");
      doc.text(g.title + "  (" + players.length + ")", M + 3, startY + 4.8);
      doc.setFont(undefined, "normal");

      var body = players.map(function (r) {
        var mail = r.mail_sent ? ("Oui" + (r.mail_sent_at ? " " + fmtDate(r.mail_sent_at) : "")) : "Non";
        return [r.last_name || "-", r.first_name || "-", r.age || "-", r.position || "-", r.level || "-",
                PDF_STATUS_FR[r.status] || "En attente", PDF_METHOD_FR[r.payment_method] || "Non renseigne",
                r.payment_received ? "Paye" : "Non paye", mail];
      });

      doc.autoTable({
        head: head, body: body, startY: startY + 7, theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 2.4, textColor: g.text, lineColor: [180, 190, 200], lineWidth: 0.2, valign: "middle" },
        headStyles: { fillColor: [6, 8, 11], textColor: [250, 250, 250], fontStyle: "bold" },
        bodyStyles: { fillColor: g.fill, textColor: g.text },
        margin: { left: M, right: M }
      });
      startY = doc.lastAutoTable.finalY + 6;
    });

    if (!printedAny) { doc.setTextColor(90); doc.text("Aucun joueur pour ce filtre.", M, startY + 4); }
    doc.save("top-hoops-liste-finale-" + state.category + ".pdf");
  });

  // Impression : même tri que le PDF (Virement -> Especes -> Non renseigne), puis restauration
  $("btnPrint").addEventListener("click", function () {
    var original = state.all;
    state.all = sortByPaymentMethod(original);
    renderTable();
    function restore() { state.all = original; renderTable(); window.removeEventListener("afterprint", restore); }
    window.addEventListener("afterprint", restore);
    window.print();
  });

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

  /* ---------- EXPORT WORD (.docx réel via JSZip) ---------- */
  function xmlEsc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]);
    });
  }
  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  // Groupe de couleur docx à partir de la classe de ligne (même logique que l'écran/PDF)
  var DOCX_COLORS = {
    green: { fill: "D7F5DE", color: "0F4623" },
    red: { fill: "FFDCDC", color: "691414" },
    grey: { fill: "EBEEF2", color: "282D32" }
  };
  function docxGroup(method) {
    var c = getPaymentRowClass(method);
    return c === "payment-method-cash" ? "red" : (c === "payment-method-transfer" ? "green" : "grey");
  }
  function docxCell(text, fill, color, bold, widthTwips) {
    return '<w:tc><w:tcPr>' +
      (widthTwips ? '<w:tcW w:w="' + widthTwips + '" w:type="dxa"/>' : '') +
      '<w:shd w:val="clear" w:color="auto" w:fill="' + fill + '"/></w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr>' + (bold ? '<w:b/>' : '') +
      '<w:color w:val="' + color + '"/><w:sz w:val="20"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEsc(text) + '</w:t></w:r></w:p></w:tc>';
  }
  function docxPara(text, opts) {
    opts = opts || {};
    return '<w:p><w:pPr>' + (opts.align ? '<w:jc w:val="' + opts.align + '"/>' : '') +
      '<w:spacing w:after="' + (opts.after != null ? opts.after : 120) + '"/></w:pPr>' +
      '<w:r><w:rPr>' + (opts.bold ? '<w:b/>' : '') + (opts.color ? '<w:color w:val="' + opts.color + '"/>' : '') +
      '<w:sz w:val="' + (opts.sz || 22) + '"/></w:rPr><w:t xml:space="preserve">' + xmlEsc(text) + '</w:t></w:r></w:p>';
  }
  // config: { title, subtitle:[lignes], columns:[noms], rows:[{cells:[...], method}], filename, orientation }
  function exportListToWord(config) {
    if (!window.JSZip) { alert("Librairie Word (JSZip) non chargee."); return; }
    var cols = config.columns, n = cols.length;
    var totalW = config.orientation === "landscape" ? 15200 : 9600;
    var colW = Math.floor(totalW / n);
    var b = '<w:tblBorders>' +
      '<w:top w:val="single" w:sz="4" w:color="B4BEC8"/><w:bottom w:val="single" w:sz="4" w:color="B4BEC8"/>' +
      '<w:left w:val="single" w:sz="4" w:color="B4BEC8"/><w:right w:val="single" w:sz="4" w:color="B4BEC8"/>' +
      '<w:insideH w:val="single" w:sz="4" w:color="B4BEC8"/><w:insideV w:val="single" w:sz="4" w:color="B4BEC8"/></w:tblBorders>';

    var headRow = '<w:tr>' + cols.map(function (c) { return docxCell(c, "06080B", "FAFAFA", true, colW); }).join("") + '</w:tr>';
    var dataRows = config.rows.map(function (row) {
      var g = DOCX_COLORS[docxGroup(row.method)];
      return '<w:tr>' + row.cells.map(function (cell) { return docxCell(cell, g.fill, g.color, false, colW); }).join("") + '</w:tr>';
    }).join("");

    var grid = '<w:tblGrid>' + cols.map(function () { return '<w:gridCol w:w="' + colW + '"/>'; }).join("") + '</w:tblGrid>';
    var table = '<w:tbl><w:tblPr><w:tblW w:w="' + totalW + '" w:type="dxa"/>' + b + '</w:tblPr>' + grid + headRow + dataRows + '</w:tbl>';

    var header = docxPara("TOP HOOPS", { bold: true, sz: 30, color: "0E7C93", align: "center", after: 40 }) +
      docxPara(config.title, { bold: true, sz: 32, align: "center", after: 80 }) +
      config.subtitle.map(function (l) { return docxPara(l, { sz: 20, color: "555555", align: "center", after: 40 }); }).join("") +
      docxPara("", { after: 80 });
    var footer = docxPara("", { after: 120 }) +
      docxPara("Top Hoops - Summer League 2026 - Document genere depuis l'espace Admin.", { sz: 16, color: "9AA9B5", align: "center", after: 0 });

    var pg = config.orientation === "landscape"
      ? '<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>'
      : '<w:pgSz w:w="11906" w:h="16838"/>';
    var sect = '<w:sectPr>' + pg + '<w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>';

    var docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      header + table + footer + sect + '</w:body></w:document>';

    var CT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>';
    var RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>';

    var zip = new JSZip();
    zip.file("[Content_Types].xml", CT);
    zip.folder("_rels").file(".rels", RELS);
    zip.folder("word").file("document.xml", docXml);
    zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
      .then(function (blob) { downloadBlob(blob, config.filename + ".docx"); });
  }

  // Export Word de la LISTE COMPLÈTE (respecte onglet/filtres/recherche actifs)
  $("btnExportWord").addEventListener("click", function () {
    var METHOD_FR = { cash: "Especes", bank_transfer: "Virement bancaire", paypal: "PayPal", revolut: "Revolut" };
    var STATUS_FR = { confirmed: "Confirme", rejected: "Refuse", pending: "En attente" };
    var sorted = sortByPaymentMethod(state.all);
    var rows = sorted.map(function (r) {
      return { method: r.payment_method, cells: [
        r.last_name || "-", r.first_name || "-", (r.age != null && r.age !== "" ? String(r.age) : "Non renseigne"),
        r.position || "Non renseigne", r.level || "Non renseigne", STATUS_FR[r.status] || "En attente",
        METHOD_FR[r.payment_method] || "Non renseigne", r.payment_received ? "Paye" : "Non paye",
        r.mail_sent ? "Oui" : "Non"
      ] };
    });
    exportListToWord({
      title: "LISTE DES JOUEURS INSCRITS - " + (state.category === "u23" ? "U23" : "SENIORS"),
      subtitle: ["Categorie : " + (state.category === "u23" ? "U23" : "Seniors"), "Date d'export : " + new Date().toLocaleDateString("fr-FR"), "Nombre de joueurs : " + rows.length],
      columns: ["Nom", "Prenom", "Age", "Poste", "Niveau", "Statut", "Mode de paiement", "Paiement recu", "Mail envoye"],
      rows: rows, filename: "top-hoops-liste-joueurs-" + state.category, orientation: "landscape"
    });
  });

  /* ---------- EXPORT EXCEL (.xlsx réel via JSZip) ---------- */
  function colLetter(i) { var s = ""; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  // Index de style xlsx par groupe de couleur (cf. styles.xml : 2=vert, 3=rouge, 4=gris)
  function xlsxStyleForGroup(g) { return g === "green" ? 2 : (g === "red" ? 3 : 4); }

  // config: { title, subtitle:[lignes], columns:[noms], rows:[{cells:[...], method}], filename, sheetName }
  function exportListToExcel(config) {
    if (!window.JSZip) { alert("Librairie Excel (JSZip) non chargee."); return; }
    var rowsXml = "", rn = 0;
    function addRow(cells) {
      rn++;
      var cx = cells.map(function (c, ci) {
        return '<c r="' + colLetter(ci) + rn + '" t="inlineStr" s="' + c.s + '"><is><t xml:space="preserve">' + xmlEsc(c.v) + '</t></is></c>';
      }).join("");
      rowsXml += '<row r="' + rn + '">' + cx + '</row>';
    }
    addRow([{ v: config.title, s: 5 }]);
    config.subtitle.forEach(function (l) { addRow([{ v: l, s: 0 }]); });
    addRow([{ v: "", s: 0 }]);
    addRow(config.columns.map(function (c) { return { v: c, s: 1 }; }));
    config.rows.forEach(function (r) {
      var gi = xlsxStyleForGroup(docxGroup(r.method));
      addRow(r.cells.map(function (c) { return { v: c, s: gi }; }));
    });

    // Largeurs de colonnes agréables
    var colsXml = '<cols>' + config.columns.map(function (_, i) {
      return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="20" customWidth="1"/>';
    }).join("") + '</cols>';

    var sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      colsXml + '<sheetData>' + rowsXml + '</sheetData></worksheet>';

    var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="6">' +
      '<font><sz val="11"/><color theme="1"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFAFAFA"/><name val="Calibri"/></font>' +
      '<font><sz val="11"/><color rgb="FF0F4623"/><name val="Calibri"/></font>' +
      '<font><sz val="11"/><color rgb="FF691414"/><name val="Calibri"/></font>' +
      '<font><sz val="11"/><color rgb="FF282D32"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="14"/><color rgb="FF06080B"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="6">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF06080B"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFD7F5DE"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFFDCDC"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFEBEEF2"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="6">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
      '<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
      '<xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
      '<xf numFmtId="0" fontId="4" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
      '<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';

    var workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="' + xmlEsc((config.sheetName || "Liste").slice(0, 31)) + '" sheetId="1" r:id="rId1"/></sheets></workbook>';
    var wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';
    var CT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>';
    var RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';

    var zip = new JSZip();
    zip.file("[Content_Types].xml", CT);
    zip.folder("_rels").file(".rels", RELS);
    var xl = zip.folder("xl");
    xl.file("workbook.xml", workbook);
    xl.folder("_rels").file("workbook.xml.rels", wbRels);
    xl.file("styles.xml", styles);
    xl.folder("worksheets").file("sheet1.xml", sheet);
    zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      .then(function (blob) { downloadBlob(blob, config.filename + ".xlsx"); });
  }

  // Export Excel de la LISTE COMPLÈTE (respecte onglet/filtres/recherche actifs)
  $("btnExportExcel").addEventListener("click", function () {
    var METHOD_FR = { cash: "Especes", bank_transfer: "Virement bancaire", paypal: "PayPal", revolut: "Revolut" };
    var STATUS_FR = { confirmed: "Confirme", rejected: "Refuse", pending: "En attente" };
    var sorted = sortByPaymentMethod(state.all);
    var rows = sorted.map(function (r) {
      return { method: r.payment_method, cells: [
        r.last_name || "-", r.first_name || "-", (r.age != null && r.age !== "" ? String(r.age) : "Non renseigne"),
        r.position || "Non renseigne", r.level || "Non renseigne", STATUS_FR[r.status] || "En attente",
        METHOD_FR[r.payment_method] || "Non renseigne", r.payment_received ? "Paye" : "Non paye",
        r.mail_sent ? "Oui" : "Non"
      ] };
    });
    exportListToExcel({
      title: "LISTE DES JOUEURS INSCRITS - " + (state.category === "u23" ? "U23" : "SENIORS"),
      subtitle: ["Categorie : " + (state.category === "u23" ? "U23" : "Seniors"), "Date d'export : " + new Date().toLocaleDateString("fr-FR"), "Nombre de joueurs : " + rows.length],
      columns: ["Nom", "Prenom", "Age", "Poste", "Niveau", "Statut", "Mode de paiement", "Paiement recu", "Mail envoye"],
      rows: rows, filename: "top-hoops-liste-joueurs-" + state.category, sheetName: "Joueurs"
    });
  });

  /* ---------- ROSTERS SUMMER LEAGUE 2026 ---------- */
  var rosterState = { category: "seniors", all: [] };

  // Catégorie d'âge (unique) : 23 et moins = U23, 24 et plus = Seniors, sinon inconnu
  function getPlayerCategory(age) {
    var n = Number(age);
    if (age === null || age === "" || !isFinite(n)) return "unknown";
    return n <= 23 ? "u23" : "senior";
  }
  // Format taille homogène : 182 -> "1,82 m", vide -> "Non renseignée"
  function formatHeight(h) {
    if (h == null || String(h).trim() === "") return "Non renseignée";
    var s = String(h).replace(",", ".").replace(/[^\d.]/g, "");
    var n = parseFloat(s);
    if (!isFinite(n) || n <= 0) return "Non renseignée";
    if (n > 3) n = n / 100;
    return n.toFixed(2).replace(".", ",") + " m";
  }
  function rosterConfig() {
    var isU23 = rosterState.category === "u23";
    return {
      title: isU23 ? "ROSTER U23 SUMMER LEAGUE 2026" : "ROSTER SUMMER LEAGUE 2026",
      filename: isU23 ? "roster-u23-summer-league-2026" : "roster-summer-league-2026"
    };
  }
  function getRosterPlayers() {
    var cat = rosterState.category; // seniors | u23
    return sortByPaymentMethod(rosterState.all.filter(function (r) {
      var c = getPlayerCategory(r.age);
      return cat === "u23" ? c === "u23" : c === "senior";
    }));
  }
  function loadRosters() {
    // Summer League uniquement (valeur technique event_type)
    api("/api/admin/registrations?event=summerleague").then(function (r) {
      if (r.status === 401) { setToken(null); showLogin(); return; }
      rosterState.all = (r.data && r.data.registrations) || [];
      renderRoster();
    });
  }
  function renderRoster() {
    var cfg = rosterConfig();
    var players = getRosterPlayers();
    $("rosterTitle").textContent = cfg.title;
    $("rosterMeta").textContent = "Date d'export : " + new Date().toLocaleDateString("fr-FR") +
      "   •   Début de l'événement : 22/07/2026 à 17h00";
    $("rosterCount").textContent = "Nombre de joueurs : " + players.length;

    // Alerte données incomplètes (n'empêche pas l'export)
    var noHeight = players.filter(function (p) { return !p.height || String(p.height).trim() === ""; }).length;
    var noPos = players.filter(function (p) { return !p.position; }).length;
    var noMethod = players.filter(function (p) { return !p.payment_method; }).length;
    var unknownAge = rosterState.all.filter(function (p) { return getPlayerCategory(p.age) === "unknown"; }).length;
    var msgs = [];
    if (noHeight) msgs.push(noHeight + " joueur(s) sans taille");
    if (noPos) msgs.push(noPos + " sans poste");
    if (noMethod) msgs.push(noMethod + " sans mode de paiement");
    if (unknownAge) msgs.push(unknownAge + " sans âge valide (non classé)");
    var al = $("rosterAlert");
    if (msgs.length) { al.hidden = false; al.textContent = "Attention : " + msgs.join(", ") + "."; }
    else { al.hidden = true; al.textContent = ""; }

    var tbody = $("rosterTbody");
    tbody.innerHTML = "";
    $("rosterEmpty").hidden = players.length > 0;
    players.forEach(function (p) {
      var tr = document.createElement("tr");
      tr.className = getPaymentRowClass(p.payment_method);
      tr.innerHTML =
        "<td>" + esc(p.last_name || "-") + "</td>" +
        "<td>" + esc(p.first_name || "-") + "</td>" +
        "<td>" + esc(p.position || "Non renseigné") + "</td>" +
        "<td>" + esc(p.age != null && p.age !== "" ? p.age : "Non renseigné") + "</td>" +
        "<td>" + esc(formatHeight(p.height)) + "</td>";
      tbody.appendChild(tr);
    });
  }

  // PDF roster : A4 portrait, 5 colonnes, groupes colorés + légende
  function exportRosterPdf() {
    if (!window.jspdf) { alert("Librairie PDF non chargee."); return; }
    var cfg = rosterConfig();
    var players = getRosterPlayers();
    var doc = new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    var M = 14;
    doc.setTextColor(6, 8, 11); doc.setFont(undefined, "bold"); doc.setFontSize(15);
    doc.text(cfg.title, 105, 16, { align: "center" });
    doc.setFont(undefined, "normal"); doc.setFontSize(10); doc.setTextColor(90);
    doc.text("Date d'export : " + new Date().toLocaleDateString("fr-FR"), 105, 22, { align: "center" });
    doc.text("Debut de l'evenement : 22/07/2026 a 17h00", 105, 27, { align: "center" });
    doc.setFont(undefined, "bold"); doc.text("Nombre de joueurs : " + players.length, 105, 32.5, { align: "center" });
    doc.setFont(undefined, "normal");
    var lx = M, ly = 40;
    [[[215,245,222],"Vert : virement / PayPal / Revolut"],[[255,220,220],"Rouge : especes"],[[235,238,242],"Gris : non renseigne"]].forEach(function (it) {
      doc.setFillColor(it[0][0], it[0][1], it[0][2]); doc.setDrawColor(150); doc.rect(lx, ly - 3.2, 4, 4, "FD");
      doc.setTextColor(40); doc.setFontSize(8.5); doc.text(it[1], lx + 6, ly); lx += doc.getTextWidth(it[1]) + 12;
    });
    var head = [["Nom", "Prenom", "Poste", "Age", "Taille"]];
    var startY = 45;
    PDF_GROUPS.forEach(function (g) {
      var gp = players.filter(function (r) { return g.match(r.payment_method); });
      if (!gp.length) return;
      doc.setFillColor(g.bar[0], g.bar[1], g.bar[2]); doc.rect(M, startY, 182, 7, "F");
      doc.setTextColor(255, 255, 255); doc.setFont(undefined, "bold"); doc.setFontSize(10);
      doc.text(g.title + "  (" + gp.length + ")", M + 3, startY + 4.8); doc.setFont(undefined, "normal");
      var body = gp.map(function (r) {
        return [r.last_name || "-", r.first_name || "-", r.position || "Non renseigne",
                (r.age != null && r.age !== "" ? String(r.age) : "Non renseigne"), formatHeight(r.height)];
      });
      doc.autoTable({
        head: head, body: body, startY: startY + 7, theme: "grid",
        styles: { fontSize: 9.5, cellPadding: 2.8, textColor: g.text, lineColor: [180, 190, 200], lineWidth: 0.2, valign: "middle" },
        headStyles: { fillColor: [6, 8, 11], textColor: [250, 250, 250], fontStyle: "bold" },
        bodyStyles: { fillColor: g.fill, textColor: g.text }, margin: { left: M, right: M }
      });
      startY = doc.lastAutoTable.finalY + 6;
    });
    if (!players.length) { doc.setTextColor(90); doc.text("Aucun joueur.", M, startY + 4); }
    doc.save(cfg.filename + ".pdf");
  }

  function exportRosterWord() {
    var cfg = rosterConfig();
    var players = getRosterPlayers();
    var rows = players.map(function (r) {
      return { method: r.payment_method, cells: [
        r.last_name || "-", r.first_name || "-", r.position || "Non renseigne",
        (r.age != null && r.age !== "" ? String(r.age) : "Non renseigne"), formatHeight(r.height)
      ] };
    });
    exportListToWord({
      title: cfg.title,
      subtitle: ["Date d'export : " + new Date().toLocaleDateString("fr-FR"),
                 "Début de l'événement : 22/07/2026 à 17h00", "Nombre de joueurs : " + rows.length],
      columns: ["Nom", "Prénom", "Poste", "Âge", "Taille"],
      rows: rows, filename: cfg.filename, orientation: "portrait"
    });
  }

  // Navigation principale (Joueurs inscrits / Rosters)
  document.querySelectorAll(".primary-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".primary-tab").forEach(function (t) { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
      tab.classList.add("active"); tab.setAttribute("aria-selected", "true");
      var v = tab.getAttribute("data-view");
      $("viewInscrits").hidden = v !== "inscrits";
      $("viewRosters").hidden = v !== "rosters";
      if (v === "rosters") loadRosters();
    });
  });
  // Sous-onglets roster (Seniors / U23)
  document.querySelectorAll(".roster-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".roster-tab").forEach(function (t) { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
      tab.classList.add("active"); tab.setAttribute("aria-selected", "true");
      rosterState.category = tab.getAttribute("data-roster");
      renderRoster();
    });
  });
  function exportRosterExcel() {
    var cfg = rosterConfig();
    var players = getRosterPlayers();
    var rows = players.map(function (r) {
      return { method: r.payment_method, cells: [
        r.last_name || "-", r.first_name || "-", r.position || "Non renseigne",
        (r.age != null && r.age !== "" ? String(r.age) : "Non renseigne"), formatHeight(r.height)
      ] };
    });
    exportListToExcel({
      title: cfg.title,
      subtitle: ["Date d'export : " + new Date().toLocaleDateString("fr-FR"),
                 "Debut de l'evenement : 22/07/2026 a 17h00", "Nombre de joueurs : " + rows.length],
      columns: ["Nom", "Prenom", "Poste", "Age", "Taille"],
      rows: rows, filename: cfg.filename, sheetName: rosterState.category === "u23" ? "Roster U23" : "Roster Seniors"
    });
  }

  $("btnRosterPdf").addEventListener("click", exportRosterPdf);
  $("btnRosterWord").addEventListener("click", exportRosterWord);
  $("btnRosterExcel").addEventListener("click", exportRosterExcel);
  $("btnRosterPrint").addEventListener("click", function () { window.print(); });

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
