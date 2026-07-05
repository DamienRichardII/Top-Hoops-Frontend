/* =====================================================================
   TOP HOOPS — Admin (login, dashboard, mails, PDF)
   Communique avec le backend via window.TOP_HOOPS_API_URL.
   Le token JWT est stocké en localStorage et envoyé en Bearer.
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
      .catch(function () { feedback($("loginFeedback"), "Serveur injoignable. Vérifie que le backend tourne.", true); });
  });

  $("showForgot").addEventListener("click", function () { $("loginForm").hidden = true; $("forgotForm").hidden = false; });
  $("backToLogin").addEventListener("click", function () { $("forgotForm").hidden = true; $("loginForm").hidden = false; });

  $("forgotForm").addEventListener("submit", function (e) {
    e.preventDefault();
    api("/api/auth/forgot-password", { method: "POST", body: { email: $("forgotEmail").value.trim() } })
      .then(function (r) { feedback($("forgotFeedback"), (r.data && r.data.message) || "Si un compte existe, un e-mail a été envoyé.", false); });
  });

  $("resetForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var token = new URLSearchParams(location.search).get("reset");
    api("/api/auth/reset-password", { method: "POST", body: {
      token: token, newPassword: $("resetPass").value, confirmPassword: $("resetConfirm").value
    } }).then(function (r) {
      if (r.ok) { feedback($("resetFeedback"), "Mot de passe réinitialisé. Tu peux te connecter.", false); setTimeout(function () { location.href = "admin.html"; }, 1500); }
      else { feedback($("resetFeedback"), (r.data && r.data.error) || "Lien invalide ou expiré.", true); }
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
      $("kpiLatest").textContent = last ? (last.first_name + " " + last.last_name) : "—";
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
        '<td><span class="tag-event">' + esc(EVENT_LABEL[r.event_type] || r.event_type) + "</span></td>" +
        "<td>" + esc(r.email) + "</td>" +
        "<td>" + esc(r.phone || "") + "</td>" +
        "<td>" + fmtDate(r.created_at) + "</td>" +
        '<td class="no-print"><div class="row-actions">' +
          '<button class="icon-btn" data-view="' + r.id + '" title="Voir détails">i</button>' +
          '<button class="icon-btn" data-mail="' + r.id + '" title="Envoyer un mail">@</button>' +
          '<button class="icon-btn danger" data-del="' + r.id + '" title="Supprimer">&times;</button>' +
        "</div></td>";
      tbody.appendChild(tr);
    });
  }

  // Délégation d'événements sur le tableau
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

  /* ---------- DÉTAIL ---------- */
  function openDetail(id) {
    var r = state.all.find(function (x) { return x.id === id; });
    if (!r) return;
    state.currentId = id;
    $("detailTitle").textContent = r.first_name + " " + r.last_name;
    var rows = [
      ["Nom", r.last_name], ["Prénom", r.first_name], ["Âge", r.age], ["Email", r.email],
      ["Téléphone", r.phone], ["Ville", r.city], ["Poste", r.position], ["Taille", r.height],
      ["Niveau", r.level], ["Instagram", r.instagram], ["Événement", EVENT_LABEL[r.event_type] || r.event_type],
      ["Disponible le 9/07", r.available_for_event], ["Déjà participé", r.already_participated]
    ];
    var html = rows.map(function (p) {
      return '<div class="d-item"><span>' + p[0] + "</span><strong>" + esc(p[1] || "—") + "</strong></div>";
    }).join("");
    if (r.motivation) html += '<div class="d-item full"><span>Motivation</span><strong>' + esc(r.motivation) + "</strong></div>";
    if (r.message) html += '<div class="d-item full"><span>Message</span><strong>' + esc(r.message) + "</strong></div>";
    html += '<div class="d-item full"><span>Date d\'inscription</span><strong>' + fmtDate(r.created_at) + "</strong></div>";
    $("detailBody").innerHTML = html;
    openModal("detailModal");
  }
  $("detailMailBtn").addEventListener("click", function () { closeModal("detailModal"); openMailSingle(state.currentId); });

  /* ---------- SUPPRESSION ---------- */
  function deleteReg(id) {
    if (!confirm("Supprimer définitivement cette inscription ?")) return;
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
    if (!n) { alert("Aucun joueur dans le filtre affiché."); return; }
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
        feedback($("mailFeedback"), "Envoyé à " + r.data.sent + "/" + r.data.total + " joueur(s).", false);
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
      if (r.ok) { feedback($("pwFeedback"), "Mot de passe modifié.", false); $("pwForm").reset(); setTimeout(function () { closeModal("pwModal"); }, 1200); }
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
    if (!window.jspdf) { alert("Librairie PDF non chargée."); return; }
    var doc = new window.jspdf.jsPDF();
    doc.setFontSize(16); doc.text("Top Hoops — Liste des joueurs inscrits", 14, 18);
    doc.setFontSize(10); doc.setTextColor(90);
    doc.text("Date d'export : " + new Date().toLocaleDateString("fr-FR"), 14, 25);
    doc.text("Filtre : " + filterLabel(), 14, 30);
    var rows = state.all.map(function (r) { return [r.last_name, r.first_name, r.position || "", r.level || "", r.age || ""]; });
    doc.autoTable({
      head: [["Nom", "Prénom", "Poste", "Niveau", "Âge"]],
      body: rows, startY: 36, styles: { fontSize: 9 },
      headStyles: { fillColor: [133, 218, 237], textColor: [6, 8, 11] }
    });
    doc.save("top-hoops-inscrits-" + state.filter + ".pdf");
  });

  $("btnPrint").addEventListener("click", function () { window.print(); });

  /* ---------- INIT ---------- */
  (function init() {
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
