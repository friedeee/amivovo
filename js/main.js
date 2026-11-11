/*
 * Amì vɔ̀vɔ̀ : interface commune (menu, thème, animations, photos)
 * et affichage des prix et des annonces. Les textes fixes sont dans les pages HTML.
 */
(function () {
    'use strict';

    const A = window.Amivovo;
    const PHOTOS = window.AMIVOVO_PHOTOS || {};
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const COULEURS = ['#c2410c', '#1f5130', '#d98a1c', '#9f1239', '#2f5fa8', '#6b4228'];

    const ICONES = {
        hausse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>',
        baisse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l10 10M17 9v8H9"/></svg>',
        stable: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/></svg>',
        lieu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
        whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3z"/></svg>',
    };

    /* ============================================================
       Interface commune
       ============================================================ */

    /* Thème clair / sombre (choix mémorisé). */
    const boutonTheme = $('#bouton-theme');
    if (boutonTheme) {
        const appliquer = (theme) => {
            document.documentElement.dataset.theme = theme;
            boutonTheme.setAttribute('aria-label', theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre');
            /* Les icônes sont des SVG : il faut l'attribut « hidden », la propriété n'existe pas sur SVG. */
            $('.icone-soleil', boutonTheme).toggleAttribute('hidden', theme !== 'dark');
            $('.icone-lune', boutonTheme).toggleAttribute('hidden', theme === 'dark');
        };
        appliquer(document.documentElement.dataset.theme || 'light');
        boutonTheme.addEventListener('click', () => {
            const suivant = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
            appliquer(suivant);
            try { localStorage.setItem('amivovo-theme', suivant); } catch (e) { /* stockage indisponible */ }
            document.dispatchEvent(new CustomEvent('theme-change'));
        });
    }

    /* Menu mobile. */
    const burger = $('.burger');
    const nav = $('#menu');
    const entete = $('.entete');
    if (burger && nav) {
        const ouvrir = (ouvert) => {
            nav.classList.toggle('est-ouvert', ouvert);
            entete.classList.toggle('menu-ouvert', ouvert);
            burger.setAttribute('aria-expanded', String(ouvert));
            burger.setAttribute('aria-label', ouvert ? 'Fermer le menu' : 'Ouvrir le menu');
            document.body.classList.toggle('menu-open', ouvert);
        };
        burger.addEventListener('click', () => ouvrir(!nav.classList.contains('est-ouvert')));
        document.addEventListener('keydown', (e) => e.key === 'Escape' && ouvrir(false));
        $$('a', nav).forEach((a) => a.addEventListener('click', () => ouvrir(false)));
    }

    /* En-tête qui se pose au défilement. */
    const surDefilement = () => entete && entete.classList.toggle('est-defile', window.scrollY > 20);
    surDefilement();
    window.addEventListener('scroll', surDefilement, { passive: true });

    /* Apparition au défilement. */
    const observer = !reduit && 'IntersectionObserver' in window
        ? new IntersectionObserver((entrees) => entrees.forEach((e) => {
            if (e.isIntersecting) { e.target.classList.add('est-visible'); observer.unobserve(e.target); }
        }), { rootMargin: '0px 0px -60px 0px' })
        : null;
    const observer2 = (el) => (observer ? observer.observe(el) : el.classList.add('est-visible'));
    $$('.apparait').forEach(observer2);

    /* Crédits des photos (obligatoires pour les licences libres). */
    const creditTexte = (cle) => {
        const p = PHOTOS[cle];
        return p ? `${p.legende} · <a href="${p.source}" target="_blank" rel="noopener">${p.auteur}, ${p.licence}</a>` : '';
    };
    $$('[data-credit]').forEach((el) => { el.innerHTML = creditTexte(el.dataset.credit); });

    /* Diaporama du héros. */
    const heros = $('.heros-photos');
    if (heros) {
        const images = $$('img', heros);
        const credit = $('.heros-credit');
        let actuelle = 0;
        const montrer = (i) => {
            images.forEach((img, j) => img.classList.toggle('est-active', i === j));
            const p = PHOTOS[images[i].dataset.photo];
            if (credit && p) { credit.textContent = `${p.legende} · ${p.auteur}, ${p.licence}`; credit.href = p.source; }
        };
        montrer(0);
        if (!reduit && images.length > 1) {
            setInterval(() => { actuelle = (actuelle + 1) % images.length; montrer(actuelle); }, 6500);
        }
    }

    /* Bande de photos qui défile. */
    $$('.bande[data-photos]').forEach((bande) => {
        const cles = bande.dataset.photos.split(',').map((s) => s.trim());
        const piste = document.createElement('div');
        piste.className = 'bande-piste';
        [0, 1].forEach((tour) => cles.forEach((cle) => {
            const img = document.createElement('img');
            img.src = `images/photos/${cle}-600.jpg`;
            img.alt = tour === 0 && PHOTOS[cle] ? `${PHOTOS[cle].legende} (${PHOTOS[cle].auteur}, ${PHOTOS[cle].licence})` : '';
            img.loading = 'lazy';
            if (tour === 1) img.setAttribute('aria-hidden', 'true');
            piste.appendChild(img);
        }));
        bande.appendChild(piste);
    });

    /* Liens WhatsApp vers l'équipe, avec message déjà rédigé. */
    $$('[data-whatsapp-equipe]').forEach((lien) => {
        lien.href = A.lienWhatsapp(A.REGLAGES.whatsapp, lien.dataset.whatsappEquipe || 'Bonjour Amì vɔ̀vɔ̀ !');
        lien.target = '_blank';
        lien.rel = 'noopener';
    });
    $$('[data-formulaire]').forEach((lien) => {
        if (A.REGLAGES.formulaire) { lien.href = A.REGLAGES.formulaire; lien.target = '_blank'; lien.rel = 'noopener'; }
        else lien.hidden = true;
    });

    $$('[data-annee]').forEach((el) => { el.textContent = new Date().getFullYear(); });

    /* ============================================================
       Prix
       ============================================================ */

    const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function badgeTendance(variation) {
        const sens = variation > 0.01 ? 'hausse' : variation < -0.01 ? 'baisse' : 'stable';
        const texte = sens === 'stable' ? 'Stable' : A.pourcent(variation);
        return `<span class="tendance ${sens}" title="Sur 7 jours">${ICONES[sens]}${texte}</span>`;
    }

    /** Prix moyen par jour (médiane entre marchés) pour une mesure, sur N jours. */
    function serieMoyenne(series, mesure, jours = 30) {
        const limite = new Date(); limite.setHours(0, 0, 0, 0); limite.setDate(limite.getDate() - jours);
        const parJour = new Map();
        series.filter((s) => s.mesure === mesure).forEach((s) => s.points.forEach((p) => {
            if (p.date < limite) return;
            const k = p.date.getTime();
            if (!parJour.has(k)) parJour.set(k, []);
            parJour.get(k).push(p.prix);
        }));
        return [...parJour.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ date: new Date(t), prix: A.mediane(v) }));
    }

    function miniCourbe(points, couleur) {
        if (points.length < 2) return '';
        const w = 96; const h = 34;
        const min = Math.min(...points.map((p) => p.prix));
        const max = Math.max(...points.map((p) => p.prix));
        const d = points.map((p, i) => {
            const x = (i / (points.length - 1)) * w;
            const y = h - 3 - ((p.prix - min) / (max - min || 1)) * (h - 6);
            return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        return `<svg class="mini-courbe" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="${couleur}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }

    /** Cartes « prix moyen du jour » : une par mesure. */
    function cartesPrix(conteneur, resumes, series) {
        const mesures = A.trierMesures([...new Set(resumes.map((r) => r.mesure))]);
        conteneur.innerHTML = mesures.map((mesure, i) => {
            const liste = resumes.filter((r) => r.mesure === mesure);
            const prix = A.prixReference(resumes, mesure);
            const variation = A.mediane(liste.map((r) => r.variation * 1000)) / 1000;
            const litres = A.MESURES[mesure];
            const couleur = variation > 0.01 ? 'var(--hausse)' : variation < -0.01 ? 'var(--baisse)' : 'var(--encre-douce)';
            return `
                <article class="carte carte-prix apparait" style="--delai:${i * 90}ms">
                    <p class="mesure">${echapper(mesure)}</p>
                    <p class="valeur">${A.fcfa(prix)}</p>
                    <p class="par-litre">${litres && litres !== 1 ? `soit ${A.fcfa(prix / litres)} le litre · ` : ''}${liste.length} marché${liste.length > 1 ? 's' : ''}</p>
                    <div class="bas">${badgeTendance(variation)}${miniCourbe(serieMoyenne(series, mesure), couleur)}</div>
                </article>`;
        }).join('');
        $$('.apparait', conteneur).forEach(observer2);
    }

    /** Grand graphique : une courbe par marché, pour la mesure choisie. */
    function graphique(zone, series, mesure, jours = 30) {
        const limite = new Date(); limite.setHours(0, 0, 0, 0); limite.setDate(limite.getDate() - jours);
        const choix = series.filter((s) => s.mesure === mesure)
            .map((s) => ({ ...s, points: s.points.filter((p) => p.date >= limite) }))
            .filter((s) => s.points.length > 1)
            .sort((a, b) => a.marche.localeCompare(b.marche));
        if (!choix.length) { zone.innerHTML = '<p class="vide">Pas encore assez de relevés pour tracer une courbe.</p>'; return; }

        const W = 820; const H = 320; const G = 56; const D = 16; const HAUT = 16; const BAS = 34;
        const tous = choix.flatMap((s) => s.points);
        const t0 = Math.min(...tous.map((p) => p.date.getTime()));
        const t1 = Math.max(...tous.map((p) => p.date.getTime()));
        let min = Math.min(...tous.map((p) => p.prix));
        let max = Math.max(...tous.map((p) => p.prix));
        const marge = (max - min || max * 0.1) * 0.15; min -= marge; max += marge;
        const x = (t) => G + ((t - t0) / (t1 - t0 || 1)) * (W - G - D);
        const y = (v) => HAUT + (1 - (v - min) / (max - min)) * (H - HAUT - BAS);

        const graduations = 4;
        let svg = `<svg class="graphique" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du prix (${echapper(mesure)}) sur ${jours} jours, par marché">`;
        for (let i = 0; i <= graduations; i++) {
            const v = min + ((max - min) * i) / graduations;
            svg += `<line class="grille" x1="${G}" x2="${W - D}" y1="${y(v)}" y2="${y(v)}"/><text class="axe" x="${G - 8}" y="${y(v) + 4}" text-anchor="end">${Math.round(v).toLocaleString('fr-FR')}</text>`;
        }
        for (let i = 0; i <= 4; i++) {
            const t = t0 + ((t1 - t0) * i) / 4;
            svg += `<text class="axe" x="${x(t)}" y="${H - 10}" text-anchor="middle">${A.dateCourte(new Date(t))}</text>`;
        }
        choix.forEach((s, i) => {
            const d = s.points.map((p, j) => `${j ? 'L' : 'M'}${x(p.date.getTime()).toFixed(1)},${y(p.prix).toFixed(1)}`).join(' ');
            svg += `<path class="courbe" d="${d}" stroke="${COULEURS[i % COULEURS.length]}" style="--longueur:2000;animation-delay:${i * 150}ms"/>`;
        });
        svg += `<line class="repere" x1="0" x2="0" y1="${HAUT}" y2="${H - BAS}" stroke="var(--encre-douce)" stroke-dasharray="4 4" opacity="0"/>`;
        svg += `<rect class="zone-survol" x="${G}" y="0" width="${W - G - D}" height="${H}" fill="transparent"/></svg>`;

        zone.style.position = 'relative';
        zone.innerHTML = `${svg}<div class="bulle-graphique"></div><div class="legende">${choix.map((s, i) => `<span><i style="background:${COULEURS[i % COULEURS.length]}"></i>${echapper(s.marche)}</span>`).join('')}</div>`;

        /* Bulle au survol : le prix de chaque marché à la date la plus proche. */
        const el = $('svg', zone); const bulle = $('.bulle-graphique', zone); const repere = $('.repere', zone);
        const jours2 = [...new Set(tous.map((p) => p.date.getTime()))].sort((a, b) => a - b);
        const montrer = (evenement) => {
            const rect = el.getBoundingClientRect();
            const px = ((evenement.clientX - rect.left) / rect.width) * W;
            const t = jours2.reduce((m, j) => (Math.abs(x(j) - px) < Math.abs(x(m) - px) ? j : m), jours2[0]);
            const lignes = choix.map((s, i) => {
                const p = s.points.find((q) => q.date.getTime() === t);
                return p ? `<div><i class="puce" style="background:${COULEURS[i % COULEURS.length]}"></i> ${echapper(s.marche)} : <b>${A.fcfa(p.prix)}</b></div>` : '';
            }).join('');
            bulle.innerHTML = `<div style="opacity:.7;margin-bottom:4px">${new Date(t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>${lignes}`;
            bulle.style.left = `${(x(t) / W) * rect.width}px`;
            bulle.style.top = `${(evenement.clientY - rect.top)}px`;
            bulle.style.opacity = '1';
            repere.setAttribute('x1', x(t)); repere.setAttribute('x2', x(t)); repere.setAttribute('opacity', '1');
        };
        const cacher = () => { bulle.style.opacity = '0'; repere.setAttribute('opacity', '0'); };
        $('.zone-survol', zone).addEventListener('pointermove', montrer);
        $('.zone-survol', zone).addEventListener('pointerleave', cacher);
    }

    /** Boutons de choix de mesure au-dessus d'un graphique. */
    function choixMesure(conteneur, mesures, auChoix, defaut) {
        conteneur.innerHTML = mesures.map((m) => `<button type="button" class="pastille" aria-pressed="${m === defaut}" data-mesure="${echapper(m)}">${echapper(m)}</button>`).join('');
        conteneur.addEventListener('click', (e) => {
            const bouton = e.target.closest('.pastille');
            if (!bouton) return;
            $$('.pastille', conteneur).forEach((b) => b.setAttribute('aria-pressed', String(b === bouton)));
            auChoix(bouton.dataset.mesure);
        });
    }

    /** Petite carte du héros : prix du litre, marché par marché. */
    function carteHeros(el, resumes) {
        const litre = resumes.filter((r) => r.mesure === 'Litre').sort((a, b) => a.prix - b.prix);
        if (!litre.length) return;
        const ref = A.prixReference(resumes, 'Litre');
        const variation = A.mediane(litre.map((r) => r.variation * 1000)) / 1000;
        el.innerHTML = `
            <p class="etiquette"><span class="point-direct"></span> Prix du litre aujourd'hui</p>
            <p class="gros-prix">${A.fcfa(ref)}</p>
            ${badgeTendance(variation)} <span style="opacity:.75;font-size:.9rem">sur 7 jours</span>
            <ul>${litre.slice(0, 5).map((r, i) => `<li><span>${echapper(r.marche)}${i === 0 ? ' <span class="meilleur">le moins cher</span>' : ''}</span><b>${A.fcfa(r.prix)}</b></li>`).join('')}</ul>`;
        el.hidden = false;
    }

    /** Tableau complet de la page Prix. */
    function tableauPrix(corps, resumes, marche, mesure) {
        const ordreMesures = A.trierMesures([...new Set(resumes.map((r) => r.mesure))]);
        const lignes = resumes
            .filter((r) => (!marche || r.marche === marche) && (!mesure || r.mesure === mesure))
            .sort((a, b) => ordreMesures.indexOf(a.mesure) - ordreMesures.indexOf(b.mesure) || a.prix - b.prix);
        const moinsCher = {};
        resumes.forEach((r) => { if (!moinsCher[r.mesure] || r.prix < moinsCher[r.mesure]) moinsCher[r.mesure] = r.prix; });
        corps.innerHTML = lignes.length ? lignes.map((r) => `
            <tr>
                <td><b>${echapper(r.marche)}</b></td>
                <td>${echapper(r.mesure)}</td>
                <td><b>${A.fcfa(r.prix)}</b>${r.prix === moinsCher[r.mesure] && !marche ? '<span class="meilleur">le moins cher</span>' : ''}</td>
                <td>${r.prixLitre ? A.fcfa(r.prixLitre) : '—'}</td>
                <td>${badgeTendance(r.variation)}</td>
                <td class="texte-doux">${A.ilYa(r.date)} · ${r.releves} relevé${r.releves > 1 ? 's' : ''}</td>
            </tr>`).join('') : '<tr><td colspan="6" class="texte-doux">Aucun prix pour ce choix.</td></tr>';
    }

    /* ============================================================
       Annonces
       ============================================================ */

    function carteAnnonce(a, resumes, i = 0) {
        const ref = A.prixReference(resumes, a.mesure);
        let comparaison = '';
        if (ref && a.prix < ref * 0.98) comparaison = `<span class="badge vert">${ICONES.baisse.replace('<svg', '<svg width="14" height="14"')} Moins cher que le marché</span>`;
        else if (ref && a.prix > ref * 1.05) comparaison = '<span class="badge orange">Au-dessus du prix moyen</span>';
        const message = `Bonjour ${a.vendeuse}, j'ai vu votre annonce sur Amì vɔ̀vɔ̀ : ${a.quantite} × ${a.mesure} à ${A.fcfa(a.prix)} (${a.marche}). Est-ce toujours disponible ?`;
        return `
            <article class="carte annonce apparait ${a.disponible ? '' : 'epuisee'}" style="--delai:${(i % 3) * 100}ms">
                <div class="annonce-entete">
                    <span class="avatar" aria-hidden="true">${echapper(a.vendeuse.replace(/^(maman|da|tanti|tante|mama)\s+/i, '').charAt(0).toUpperCase())}</span>
                    <div>
                        <a class="lien-vendeuse" href="vendeuse.html?id=${encodeURIComponent(a.telephone || a.vendeuse)}"><strong>${echapper(a.vendeuse)}</strong></a>
                        <small>${ICONES.lieu}${echapper(a.marche)} · ${a.date ? A.ilYa(a.date) : ''}</small>
                    </div>
                </div>
                <div class="annonce-prix">
                    <span class="valeur">${A.fcfa(a.prix)}</span>
                    <span class="texte-doux">/ ${echapper(a.mesure.charAt(0).toLowerCase() + a.mesure.slice(1))}</span>
                </div>
                <div class="badges">
                    <span class="badge">${a.quantite || '?'} disponible${a.quantite > 1 ? 's' : ''}</span>
                    ${a.disponible ? comparaison : '<span class="badge">Épuisé</span>'}
                </div>
                ${a.note ? `<p class="note">${echapper(a.note)}</p>` : ''}
                ${a.disponible && a.telephone
                    ? `<a class="bouton bouton-whatsapp" href="${A.lienWhatsapp(a.telephone, message)}" target="_blank" rel="noopener">${ICONES.whatsapp} Contacter sur WhatsApp</a>`
                    : ''}
            </article>`;
    }

    function listeAnnonces(conteneur, annonces, resumes) {
        conteneur.innerHTML = annonces.length
            ? annonces.map((a, i) => carteAnnonce(a, resumes, i)).join('')
            : '<p class="vide">Aucune annonce pour ce choix. Revenez bientôt !</p>';
        $$('.apparait', conteneur).forEach(observer2);
    }

    function remplirSelecteur(select, valeurs, libelleTous) {
        select.innerHTML = `<option value="">${libelleTous}</option>${valeurs.map((v) => `<option>${echapper(v)}</option>`).join('')}`;
    }

    /** Cartes « vendeuse » qui mènent à leur fiche. */
    function cartesVendeuses(conteneur, liste) {
        conteneur.innerHTML = liste.map((v, i) => {
            const actives = v.annonces.filter((a) => a.disponible).length;
            return `
                <a class="carte carte-vendeuse apparait" style="--delai:${(i % 4) * 80}ms" href="vendeuse.html?id=${encodeURIComponent(v.telephone || v.nom)}">
                    <span class="avatar" aria-hidden="true">${echapper(initiale(v.nom))}</span>
                    <span class="carte-vendeuse-texte">
                        <strong>${echapper(v.nom)}</strong>
                        <small>${ICONES.lieu}${echapper(v.marches.join(', '))}</small>
                        <span class="badges">${v.mesures.map((m) => `<span class="badge">${echapper(m)}</span>`).join('')}</span>
                    </span>
                    <span class="carte-vendeuse-nombre"><b>${actives}</b> annonce${actives > 1 ? 's' : ''}</span>
                </a>`;
        }).join('');
        $$('.apparait', conteneur).forEach(observer2);
    }

    function initiale(nom) {
        return String(nom).replace(/^(maman|da|tanti|tante|mama|coop[ée]rative)\s+/i, '').charAt(0).toUpperCase();
    }

    /** Bandeau quand une alerte de prix est déclenchée (les alertes sont réglées dans la page Outils). */
    function afficherAlertes(resumes) {
        const declenchees = A.alertesDeclenchees(resumes);
        if (!declenchees.length || $('.bandeau-alerte')) return;
        const bandeau = document.createElement('div');
        bandeau.className = 'bandeau-alerte';
        bandeau.setAttribute('role', 'status');
        const premiere = declenchees[0];
        bandeau.innerHTML = `
            <span class="bandeau-alerte-icone" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg></span>
            <p><b>Bonne nouvelle !</b> ${echapper(premiere.alerte.mesure)} à <b>${A.fcfa(premiere.meilleur.prix)}</b> à ${echapper(premiere.meilleur.marche)}, sous votre seuil de ${A.fcfa(premiere.alerte.seuil)}.${declenchees.length > 1 ? ` (+${declenchees.length - 1} autre${declenchees.length > 2 ? 's' : ''})` : ''}</p>
            <a class="bouton bouton-petit bouton-huile" href="annonces.html?mesure=${encodeURIComponent(premiere.alerte.mesure)}">Voir les annonces</a>
            <button type="button" class="icone-bouton" aria-label="Fermer l'alerte"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
        $('button', bandeau).addEventListener('click', () => bandeau.remove());
        document.body.appendChild(bandeau);

        /* Notification du téléphone, au plus une fois par jour et par alerte, si la personne l'a autorisée. */
        if ('Notification' in window && Notification.permission === 'granted') {
            const jour = new Date().toDateString();
            declenchees.forEach(({ alerte, meilleur }) => {
                const cle = `amivovo-alerte-vue-${alerte.id}`;
                try {
                    if (localStorage.getItem(cle) === jour) return;
                    localStorage.setItem(cle, jour);
                } catch (e) { return; }
                const texte = `${alerte.mesure} à ${A.fcfa(meilleur.prix)} à ${meilleur.marche}`;
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.ready.then((r) => r.showNotification('Amì vɔ̀vɔ̀ : le prix a baissé', { body: texte, icon: 'images/icone-192.png', tag: alerte.id }));
                } else {
                    try { new Notification('Amì vɔ̀vɔ̀ : le prix a baissé', { body: texte, icon: 'images/icone-192.png' }); } catch (e) { /* non pris en charge */ }
                }
            });
        }
    }

    /** Petits chiffres clés de l'accueil, qui comptent jusqu'à leur valeur. */
    function compter(el, cible, format = (n) => Math.round(n).toLocaleString('fr-FR')) {
        if (reduit) { el.textContent = format(cible); return; }
        const debut = performance.now();
        const pas = (t) => {
            const p = Math.min(1, (t - debut) / 1200);
            el.textContent = format(cible * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(pas);
        };
        requestAnimationFrame(pas);
    }

    /* Outils partagés avec les autres scripts des pages (carte, outils, fiche vendeuse…). */
    A.ui = { $, $$, echapper, observer2, badgeTendance, carteAnnonce, listeAnnonces, cartesVendeuses, graphique, initiale, remplirSelecteur, ICONES, COULEURS, reduit };

    /* ============================================================
       Démarrage selon la page
       ============================================================ */

    const MESSAGE_SANS_PRIX = 'Pas encore de prix relevé. Vous vendez de l\'huile rouge ? <a href="vendre.html">Envoyez le premier prix du jour</a>.';
    const PAGES_DONNEES =['accueil', 'prix', 'annonces', 'marches', 'outils', 'vendeuse'];
    const parametres = new URLSearchParams(window.location.search);

    async function chargerTout() {
        const resultat = { prix: null, series: [], resumes: [], annonces: null };
        try {
            resultat.prix = await A.chargerPrix();
            resultat.series = A.series(resultat.prix.lignes);
            resultat.resumes = resultat.series.filter((s) => s.points.length).map(A.resume);
        } catch (erreur) {
            $$('[data-erreur-prix]').forEach((el) => { el.hidden = false; });
            console.error('Prix indisponibles', erreur);
        }
        try { resultat.annonces = await A.chargerAnnonces(); }
        catch (erreur) { console.error('Annonces indisponibles', erreur); }

        const { prix, resumes, annonces } = resultat;
        if (prix && prix.exemple) $$('[data-exemple-prix]').forEach((el) => { el.hidden = false; });
        if (annonces && annonces.exemple) $$('[data-exemple-annonces]').forEach((el) => { el.hidden = false; });
        const horsLigne = (prix && prix.horsLigne) || (annonces && annonces.horsLigne);
        if (horsLigne) {
            const note = document.createElement('p');
            note.className = 'bandeau-hors-ligne';
            note.textContent = `Pas d'Internet : voici les derniers prix enregistrés dans votre téléphone (${horsLigne.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${horsLigne.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}).`;
            ($('main') || document.body).prepend(note);
        }
        if (resumes.length) {
            const derniere = new Date(Math.max(...resumes.map((r) => r.date)));
            $$('[data-date-prix]').forEach((el) => { el.textContent = derniere.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); });
            afficherAlertes(resumes);
        }
        return resultat;
    }

    async function demarrer() {
        const page = document.body.dataset.page;
        if (!PAGES_DONNEES.includes(page)) return null;
        const donnees = await chargerTout();
        const { series, resumes, annonces } = donnees;

        const mesures = A.trierMesures([...new Set(resumes.map((r) => r.mesure))]);
        const marches = [...new Set(resumes.map((r) => r.marche))].sort();

        const carteH = $('#carte-prix-heros');
        if (carteH) carteHeros(carteH, resumes);
        const cartes = $('#cartes-prix');
        if (cartes && resumes.length) cartesPrix(cartes, resumes, series);
        else if (cartes) cartes.innerHTML = `<p class="vide" style="grid-column:1/-1">${MESSAGE_SANS_PRIX}</p>`;
        $$('[data-date-prix]').forEach((el) => { if (el.textContent === '…') el.textContent = 'pas encore de relevé'; });

        const chiffres = $('#chiffres-accueil');
        if (chiffres) {
            const liste = annonces ? A.vendeuses(annonces.historique) : [];
            const litre = A.prixReference(resumes, 'Litre');
            compter($('[data-chiffre="marches"]', chiffres), marches.length);
            compter($('[data-chiffre="vendeuses"]', chiffres), liste.length);
            compter($('[data-chiffre="annonces"]', chiffres), annonces ? annonces.annonces.filter((a) => a.disponible).length : 0);
            const libelles = { marches: ['marché suivi', 'marchés suivis'], vendeuses: ['vendeuse', 'vendeuses'], annonces: ['annonce disponible', 'annonces disponibles'] };
            const nombres = { marches: marches.length, vendeuses: liste.length, annonces: annonces ? annonces.annonces.filter((a) => a.disponible).length : 0 };
            Object.entries(libelles).forEach(([cle, [un, plusieurs]]) => {
                $(`[data-chiffre="${cle}"] + span`, chiffres).textContent = nombres[cle] > 1 ? plusieurs : un;
            });
            if (litre) compter($('[data-chiffre="litre"]', chiffres), litre, A.fcfa);
            else $('[data-chiffre="litre"]', chiffres).textContent = '—';
        }

        const zone = $('#graphique');
        const pastilles = $('#choix-mesure');
        if (zone && !mesures.length) zone.innerHTML = `<p class="vide">${MESSAGE_SANS_PRIX}</p>`;
        if (zone && pastilles && mesures.length) {
            const defaut = mesures.includes('Bidon 25 L') ? 'Bidon 25 L' : mesures[0];
            const redessiner = (m) => graphique(zone, series, m);
            choixMesure(pastilles, mesures, redessiner, defaut);
            redessiner(defaut);
        }

        const corps = $('#tableau-prix');
        if (corps) {
            const fMarche = $('#filtre-marche'); const fMesure = $('#filtre-mesure');
            remplirSelecteur(fMarche, marches, 'Tous les marchés');
            remplirSelecteur(fMesure, mesures, 'Toutes les mesures');
            if (marches.includes(parametres.get('marche'))) fMarche.value = parametres.get('marche');
            const maj = () => tableauPrix(corps, resumes, fMarche.value, fMesure.value);
            fMarche.addEventListener('change', maj); fMesure.addEventListener('change', maj);
            maj();
        }

        const zoneAnnonces = $('#annonces');
        if (zoneAnnonces) {
            if (!annonces) { zoneAnnonces.innerHTML = '<p class="vide">Les annonces sont momentanément indisponibles.</p>'; }
            else {
                const limite = Number(zoneAnnonces.dataset.limite || 0);
                if (limite) {
                    listeAnnonces(zoneAnnonces, annonces.annonces.filter((a) => a.disponible).slice(0, limite), resumes);
                } else {
                    const fMarche = $('#filtre-annonce-marche'); const fMesure = $('#filtre-annonce-mesure');
                    const fTri = $('#filtre-annonce-tri'); const fDispo = $('#filtre-annonce-dispo');
                    const marchesAnnonces = [...new Set(annonces.annonces.map((a) => a.marche))].sort();
                    const mesuresAnnonces = A.trierMesures([...new Set(annonces.annonces.map((a) => a.mesure))]);
                    remplirSelecteur(fMarche, marchesAnnonces, 'Tous les marchés');
                    remplirSelecteur(fMesure, mesuresAnnonces, 'Toutes les mesures');
                    if (marchesAnnonces.includes(parametres.get('marche'))) fMarche.value = parametres.get('marche');
                    if (mesuresAnnonces.includes(parametres.get('mesure'))) fMesure.value = parametres.get('mesure');
                    const maj = () => {
                        let liste = annonces.annonces.filter((a) => (!fMarche.value || a.marche === fMarche.value)
                            && (!fMesure.value || a.mesure === fMesure.value) && (!fDispo.checked || a.disponible));
                        const litre = (a) => a.prix / (A.MESURES[a.mesure] || 1);
                        if (fTri.value === 'prix') liste = [...liste].sort((a, b) => litre(a) - litre(b));
                        listeAnnonces(zoneAnnonces, liste, resumes);
                        $('#nombre-annonces').textContent = `${liste.length} annonce${liste.length > 1 ? 's' : ''}`;
                    };
                    [fMarche, fMesure, fTri, fDispo].forEach((f) => f.addEventListener('change', maj));
                    maj();
                }
            }
        }

        const zoneVendeuses = $('#vendeuses');
        if (zoneVendeuses && annonces) {
            const liste = A.vendeuses(annonces.historique)
                .sort((a, b) => b.annonces.filter((x) => x.disponible).length - a.annonces.filter((x) => x.disponible).length || a.nom.localeCompare(b.nom));
            cartesVendeuses(zoneVendeuses, liste.slice(0, Number(zoneVendeuses.dataset.limite || 999)));
        }
        return donnees;
    }

    /** Les scripts propres à une page attendent les données avec « Amivovo.pret.then(...) ». */
    A.pret = demarrer();
})();
