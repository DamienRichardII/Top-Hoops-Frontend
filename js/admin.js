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
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"/></svg>'
  };

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
      var last = (r.data.latest && r.data.latest[0]);
      $("kpiLatest").textContent = last ? (last.first_name + " " + last.last_name) : "-";
    });
  }

  /* ---------- LISTE ---------- */
  var EVENT_LABEL = { summerleague: "Summer League", ligue_top_hoops: "Ligue Top Hoops" };

  function loadRegistrations() {
    var q = "?";
    if (state.filter !== "all") q += "event=" + state.filter + "&";
    if (state.search) q += "search=" + encodeURIComponent(state.search);
    api("/api/admin/registrations" + q).then(function (r) {
      if (r.status === 401) { setToken(null); showLogin(); return; }
      state.all = (r.data && r.data.registrations) || [];
      renderTable();
    });
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
        "<td>" + esc(r.email) + "</td>" +
        "<td>" + esc(r.phone || "") + "</td>" +
        "<td>" + fmtDate(r.created_at) + "</td>" +
        '<td class="no-print"><div class="row-actions">' +
          '<button class="icon-btn" data-view="' + r.id + '" title="Voir details" aria-label="Voir details">' + IC.eye + "</button>" +
          '<button class="icon-btn" data-mail="' + r.id + '" title="Envoyer un mail" aria-label="Envoyer un mail">' + IC.mail + "</button>" +
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
    else if (b.dataset.del) deleteReg(b.dataset.del);
  });

  // Filtres
  document.querySelectorAll(".filter-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".filter-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      state.filter = btn.getAttribute("data-evt");
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
        feedback($("mailFeedback"), "Envoye a " + r.data.sent + "/" + r.data.total + " joueur(s).", false);
        $("mailForm").reset();
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
    var rows = state.all.map(function (r) { return [r.last_name, r.first_name, r.position || "", r.level || "", r.age || "", r.registration_fee_accepted || "-"]; });
    doc.autoTable({
      head: [["Nom", "Prenom", "Poste", "Niveau", "Age", "Frais 20\u20ac"]],
      body: rows, startY: 36, styles: { fontSize: 9 },
      headStyles: { fillColor: [133, 218, 237], textColor: [6, 8, 11] }
    });
    doc.save("top-hoops-inscrits-" + state.filter + ".pdf");
  });

  $("btnPrint").addEventListener("click", function () { window.print(); });

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
