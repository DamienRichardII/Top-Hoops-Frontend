/* =====================================================================
   TOP HOOPS — Script principal (JS vanilla)
   Menu mobile, header au scroll, galerie + lightbox + filtres,
   espace abonné (compte + YouTube), verrous vidéo, formulaires mailto,
   animations d'apparition, feedback utilisateur.
   Réalisé par DamCompany
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- 1. MENU BURGER RESPONSIVE ---------- */
  var burger = document.querySelector(".burger");
  var nav = document.querySelector(".nav");
  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      burger.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("open");
        burger.classList.remove("open");
      });
    });
  }

  /* ---------- 2. HEADER STICKY : classe .scrolled ---------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("scrolled", window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- 3. ANIMATION D'APPARITION AU SCROLL ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("visible"); });
  }

  /* ---------- 4. ÉTAT ABONNÉ (localStorage) ---------- */
  var SUB_KEY = "topHoops_isSubscriber";
  function isSubscriber() {
    try { return localStorage.getItem(SUB_KEY) === "true"; }
    catch (e) { return false; }
  }
  function setSubscriber(val) {
    try { localStorage.setItem(SUB_KEY, val ? "true" : "false"); } catch (e) {}
    applySubscriberState();
  }

  function applySubscriberState() {
    var sub = isSubscriber();
    document.querySelectorAll(".video-card.locked").forEach(function (card) {
      card.classList.toggle("unlocked", sub);
    });
    document.querySelectorAll("[data-sub-status]").forEach(function (el) {
      el.textContent = sub ? "Mode abonné test : ACTIVÉ" : "Mode abonné test : désactivé";
    });
    document.querySelectorAll("[data-sub-toggle]").forEach(function (btn) {
      btn.textContent = sub ? "Désactiver le mode test" : "Activer le mode abonné test";
    });
    document.querySelectorAll(".account-btn").forEach(function (b) {
      b.classList.toggle("is-sub", sub);
    });
    renderAccountSteps();
  }

  document.querySelectorAll("[data-sub-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () { setSubscriber(!isSubscriber()); });
  });

  document.querySelectorAll("[data-unlock]").forEach(function (btn) {
    btn.addEventListener("click", function () { openAccountModal(); });
  });

  /* ---------- 4b. ESPACE ABONNÉ : MODALE (icône header) ---------- */
  var ACCOUNT_KEY = "topHoops_account";
  var accountModal = null;

  function getAccount() {
    try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null"); }
    catch (e) { return null; }
  }
  function saveAccount(acc) {
    try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc)); } catch (e) {}
  }
  function clearAccount() {
    try { localStorage.removeItem(ACCOUNT_KEY); } catch (e) {}
    setSubscriber(false);
  }

  function buildAccountModal() {
    accountModal = document.createElement("div");
    accountModal.className = "account-modal";
    accountModal.innerHTML =
      '<div class="account-panel" role="dialog" aria-modal="true" aria-label="Espace abonne Top Hoops">' +
        '<button class="ap-close" aria-label="Fermer">&times;</button>' +
        '<div class="ap-head">' +
          '<div class="ap-avatar"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path></svg></div>' +
          '<h3>Espace Abonne</h3>' +
          '<p class="ap-sub">Cree ton compte et debloque le contenu exclusif Top Hoops.</p>' +
        '</div>' +
        '<div class="ap-step" data-step="signup">' +
          '<div class="field"><label>Prenom</label><input type="text" id="apName" placeholder="Ton prenom"></div>' +
          '<div class="field"><label>Email</label><input type="email" id="apEmail" placeholder="ton@email.com"></div>' +
          '<div class="field"><label>Mot de passe</label><input type="password" id="apPass" placeholder="********"></div>' +
          '<button class="btn btn--primary btn--block" id="apCreate">Creer mon compte</button>' +
          '<p class="ap-note">Prototype : les identifiants restent en local sur cet appareil.</p>' +
        '</div>' +
        '<div class="ap-step" data-step="subscribe">' +
          '<div class="ap-user">Connecte en tant que <b class="ap-username"></b></div>' +
          '<p class="ap-sub" style="text-align:center">Abonne-toi a la chaine YouTube Top Hoops pour debloquer les replays et videos exclusives.</p>' +
          '<a href="https://www.youtube.com/@TOPHOOPS24" target="_blank" rel="noopener" class="btn btn--primary btn--block" style="margin-bottom:10px">Sabonner sur YouTube</a>' +
          '<button class="btn btn--ghost btn--block" id="apUnlock">Jai abonne, debloquer le contenu</button>' +
          '<p class="ap-note"><button class="ap-link-btn" id="apLogout1">Se deconnecter</button></p>' +
        '</div>' +
        '<div class="ap-step" data-step="done">' +
          '<div class="ap-user">Connecte en tant que <b class="ap-username"></b></div>' +
          '<div class="ap-unlocked">Contenu exclusif debloque</div>' +
          '<a href="livestream.html" class="btn btn--primary btn--block" style="margin-bottom:10px">Voir les contenus abonnes</a>' +
          '<p class="ap-note"><button class="ap-link-btn" id="apLogout2">Se deconnecter</button></p>' +
        '</div>' +
      '</div>';
    document.body.appendChild(accountModal);

    accountModal.querySelector(".ap-close").addEventListener("click", closeAccountModal);
    accountModal.addEventListener("click", function (e) { if (e.target === accountModal) closeAccountModal(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && accountModal.classList.contains("open")) closeAccountModal();
    });

    accountModal.querySelector("#apCreate").addEventListener("click", function () {
      var name = accountModal.querySelector("#apName").value.trim();
      var email = accountModal.querySelector("#apEmail").value.trim();
      var pass = accountModal.querySelector("#apPass").value.trim();
      if (!name || !email || !pass) { alert("Merci de remplir tous les champs."); return; }
      saveAccount({ name: name, email: email });
      renderAccountSteps();
    });
    accountModal.querySelector("#apUnlock").addEventListener("click", function () { setSubscriber(true); });
    accountModal.querySelector("#apLogout1").addEventListener("click", clearAccount);
    accountModal.querySelector("#apLogout2").addEventListener("click", clearAccount);
  }

  function renderAccountSteps() {
    if (!accountModal) return;
    var acc = getAccount();
    var sub = isSubscriber();
    var stepName = !acc ? "signup" : (sub ? "done" : "subscribe");
    accountModal.querySelectorAll(".ap-step").forEach(function (el) {
      el.classList.toggle("active", el.getAttribute("data-step") === stepName);
    });
    accountModal.querySelectorAll(".ap-username").forEach(function (el) {
      el.textContent = acc ? acc.name : "";
    });
  }

  function openAccountModal() {
    if (!accountModal) buildAccountModal();
    renderAccountSteps();
    accountModal.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeAccountModal() {
    if (!accountModal) return;
    accountModal.classList.remove("open");
    document.body.style.overflow = "";
  }

  document.querySelectorAll("#accountBtn, [data-open-account]").forEach(function (btn) {
    btn.addEventListener("click", function (e) { e.preventDefault(); openAccountModal(); });
  });

  applySubscriberState();

  /* ---------- 5. GALERIE : rendu + filtres ---------- */
  var galleryImages = [
    { src: "assets/DSC03683.jpg", category: "players", alt: "Joueur Top Hoops au shoot" },
    { src: "assets/DSC03686.jpg", category: "players", alt: "Joueurs Top Hoops sur le terrain" },
    { src: "assets/DSC03688.jpg", category: "matchs", alt: "Action de jeu Top Hoops" },
    { src: "assets/DSC03691.jpg", category: "players", alt: "Joueur Top Hoops" },
    { src: "assets/DSC03692.jpg", category: "matchs", alt: "Match Summer League Top Hoops" },
    { src: "assets/DSC03695.jpg", category: "players", alt: "Joueur Top Hoops sur le parquet" },
    { src: "assets/DSC03696.jpg", category: "matchs", alt: "Lancer franc Top Hoops" },
    { src: "assets/DSC03697.jpg", category: "matchs", alt: "Dribble en match Top Hoops" },
    { src: "assets/DSC03699.jpg", category: "matchs", alt: "Penetration au panier Top Hoops" },
    { src: "assets/DSC03705.jpg", category: "matchs", alt: "Action de match Top Hoops" },
    { src: "assets/DSC03706.jpg", category: "matchs", alt: "Contre-attaque Top Hoops" },
    { src: "assets/DSC03707.jpg", category: "matchs", alt: "Defense en match Top Hoops" },
    { src: "assets/DSC03709.jpg", category: "matchs", alt: "Vue du match Top Hoops" },
    { src: "assets/DSC03711.jpg", category: "matchs", alt: "Duel sur le terrain Top Hoops" },
    { src: "assets/DSC03716.jpg", category: "events", alt: "Ambiance evenement Top Hoops" },
    { src: "assets/DSC03718.jpg", category: "events", alt: "Celebration Top Hoops" },
    { src: "assets/DSC03721.jpg", category: "matchs", alt: "Opposition en match Top Hoops" },
    { src: "assets/DSC03724.jpg", category: "events", alt: "Joueur celebre un panier" },
    { src: "assets/DSC03728.jpg", category: "events", alt: "Temps fort du tournoi Top Hoops" },
    { src: "assets/DSC03730.jpg", category: "events", alt: "Banc et equipe Top Hoops" },
    { src: "assets/DSC03732.jpg", category: "backstage", alt: "Coulisses Top Hoops" },
    { src: "assets/DSC03733.jpg", category: "backstage", alt: "Staff Top Hoops en bord de terrain" },
    { src: "assets/DSC03734.jpg", category: "matchs", alt: "Action rapide en match Top Hoops" },
    { src: "assets/DSC03737.jpg", category: "matchs", alt: "Defense serree Top Hoops" },
    { src: "assets/DSC03739.jpg", category: "events", alt: "Public et banc Top Hoops" },
    { src: "assets/DSC03740.jpg", category: "events", alt: "Poignee de main fair-play Top Hoops" },
    { src: "assets/DSC03742.jpg", category: "matchs", alt: "Sous le panier Top Hoops" },
    { src: "assets/DSC03745.jpg", category: "backstage", alt: "Coulisses et preparation Top Hoops" },
    { src: "assets/champion-summerleague.jpeg", category: "events", alt: "Champions Summer League 2K25 Top Hoops" },
    { src: "assets/champion-summerleague-U21.jpeg", category: "events", alt: "Champions U21 Summer League Top Hoops" }
  ];

  var galleryGrid = document.getElementById("galleryGrid");
  var lightbox, lbImg, currentList = [], currentIndex = 0;

  var CAT_LABELS = {
    matchs: "Matchs", players: "Players", events: "Events", backstage: "Behind the scenes"
  };

  function renderGallery(filter) {
    if (!galleryGrid) return;
    galleryGrid.innerHTML = "";
    currentList = galleryImages.filter(function (im) {
      return filter === "all" || im.category === filter;
    });

    if (currentList.length === 0) {
      var empty = document.createElement("p");
      empty.className = "gallery-empty";
      empty.textContent = "Les photos officielles arrivent bientot.";
      galleryGrid.appendChild(empty);
      return;
    }

    currentList.forEach(function (im, i) {
      var fig = document.createElement("figure");
      fig.className = "gallery-item reveal visible";
      fig.innerHTML =
        '<img src="' + im.src + '" alt="' + im.alt + '" loading="lazy">' +
        '<span class="badge g-tag">' + (CAT_LABELS[im.category] || "") + '</span>';
      fig.addEventListener("click", function () { openLightbox(i); });
      galleryGrid.appendChild(fig);
    });
  }

  document.querySelectorAll(".filter-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".filter-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      renderGallery(btn.getAttribute("data-filter"));
    });
  });

  /* ---------- 6. LIGHTBOX ---------- */
  function buildLightbox() {
    lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.innerHTML =
      '<button class="lb-close" aria-label="Fermer">&times;</button>' +
      '<button class="lb-nav lb-prev" aria-label="Precedent">&#8249;</button>' +
      '<img src="" alt="">' +
      '<button class="lb-nav lb-next" aria-label="Suivant">&#8250;</button>';
    document.body.appendChild(lightbox);
    lbImg = lightbox.querySelector("img");

    lightbox.querySelector(".lb-close").addEventListener("click", closeLightbox);
    lightbox.querySelector(".lb-prev").addEventListener("click", function (e) { e.stopPropagation(); step(-1); });
    lightbox.querySelector(".lb-next").addEventListener("click", function (e) { e.stopPropagation(); step(1); });
    lightbox.addEventListener("click", function (e) { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener("keydown", function (e) {
      if (!lightbox.classList.contains("open")) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    });
  }
  function openLightbox(index) {
    if (!lightbox) buildLightbox();
    currentIndex = index;
    updateLightbox();
    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function updateLightbox() {
    var im = currentList[currentIndex];
    if (im) { lbImg.src = im.src; lbImg.alt = im.alt; }
  }
  function step(dir) {
    currentIndex = (currentIndex + dir + currentList.length) % currentList.length;
    updateLightbox();
  }
  function closeLightbox() {
    lightbox.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (galleryGrid) renderGallery("all");

  /* ---------- 7. FORMULAIRES VIA MAILTO ---------- */
  function serializeForm(form) {
    var lines = [];
    form.querySelectorAll("input, select, textarea").forEach(function (el) {
      if (!el.name || el.type === "submit") return;
      var label = el.getAttribute("data-label") || el.name;
      if (el.type === "checkbox") {
        lines.push(label + " : " + (el.checked ? "Oui" : "Non"));
      } else if (el.value.trim() !== "") {
        lines.push(label + " : " + el.value.trim());
      }
    });
    return lines.join("\n");
  }

  function handleMailForm(form) {
    var to = form.getAttribute("data-mailto");
    var subject = form.getAttribute("data-subject") || "Message Top Hoops";
    var feedback = form.querySelector(".form-feedback");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var body = serializeForm(form);
      var href = "mailto:" + to +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);

      window.location.href = href;

      if (feedback) {
        feedback.classList.add("show");
        feedback.textContent = form.getAttribute("data-success") ||
          "Merci ! Ton message est pret a etre envoye a Top Hoops depuis ta messagerie.";
      }
    });
  }
  document.querySelectorAll("form[data-mailto]").forEach(handleMailForm);

  /* ---------- 7b. FORMULAIRES INSCRIPTION -> BACKEND (fetch) ---------- */
  // Correspondance champs FR -> clés backend
  var FIELD_MAP = {
    prenom: "first_name", nom: "last_name", age: "age", email: "email",
    telephone: "phone", ville: "city", poste: "position", taille: "height",
    niveau: "level", instagram: "instagram", message: "message",
    dispo: "available_for_event", deja_participe: "already_participated",
    motivation: "motivation", consentement: "consent"
  };

  function apiBase() { return (window.TOP_HOOPS_API_URL || "http://localhost:3001").replace(/\/$/, ""); }

  function handleApiForm(form) {
    var feedback = form.querySelector(".form-feedback");
    var eventType = form.getAttribute("data-event-type");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var payload = { event_type: eventType };
      form.querySelectorAll("input, select, textarea").forEach(function (el) {
        if (!el.name) return;
        var key = FIELD_MAP[el.name] || el.name;
        payload[key] = (el.type === "checkbox") ? el.checked : el.value.trim();
      });

      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = "Envoi..."; }

      fetch(apiBase() + "/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
        if (feedback) { feedback.classList.add("show"); }
        if (res.ok) {
          if (feedback) {
            feedback.style.color = "";
            feedback.textContent = form.getAttribute("data-success") || "Merci, ton inscription a bien été envoyée à Top Hoops.";
          }
          form.reset();
        } else if (feedback) {
          feedback.style.color = "#ff8f8f";
          feedback.textContent = (res.d && res.d.error) ? res.d.error : "Une erreur est survenue. Merci de réessayer.";
        }
      })
      .catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
        if (feedback) {
          feedback.classList.add("show");
          feedback.style.color = "#ff8f8f";
          feedback.textContent = "Une erreur est survenue. Merci de réessayer.";
        }
      });
    });
  }
  document.querySelectorAll('form[data-api="registrations"]').forEach(handleApiForm);

  /* ---------- 8. ANNEE DYNAMIQUE FOOTER ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- 9. PAGE INSCRIPTION : choix du parcours + query param ---------- */
  var regChoice = document.querySelector(".reg-choice");
  if (regChoice) {
    var regCards = regChoice.querySelectorAll("[data-reg]");
    var showRegistrationForm = function (type, doScroll) {
      document.querySelectorAll(".reg-form").forEach(function (frm) { frm.hidden = true; });
      var target = document.getElementById("form-" + type);
      if (target) target.hidden = false;
      regCards.forEach(function (c) {
        c.classList.toggle("active", c.getAttribute("data-reg") === type);
      });
      if (target && doScroll) target.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    regCards.forEach(function (c) {
      c.addEventListener("click", function () { showRegistrationForm(c.getAttribute("data-reg"), true); });
    });
    // Ouverture directe selon l'URL : inscription.html?type=summer|ligue
    var regType = new URLSearchParams(window.location.search).get("type");
    if (regType === "summer" || regType === "ligue") { showRegistrationForm(regType, false); }
  }

})();
