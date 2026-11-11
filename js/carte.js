/*
 * Amì vɔ̀vɔ̀ : carte des marchés (page marches.html).
 * Fond de carte OpenStreetMap avec Leaflet ; chaque marché affiche son prix pour la mesure choisie.
 * Sans Internet, la carte ne s'affiche pas mais la liste des marchés reste disponible.
 */
(function () {
    'use strict';

    const A = window.Amivovo;
    const { $, $$, echapper, badgeTendance, observer2 } = A.ui;

    /** Couleur du moins cher (vert) au plus cher (rouge). */
    const teinte = (rang) => `hsl(${Math.round(140 - rang * 130)} 62% 38%)`;

    A.pret.then((donnees) => {
        if (!donnees) return;
        const { resumes, annonces } = donnees;
        const mesures = A.trierMesures([...new Set(resumes.map((r) => r.mesure))]);
        if (!mesures.length) { $('#liste-marches').innerHTML = '<p class="vide">Aucun prix pour le moment.</p>'; return; }
        let mesure = mesures.includes('Litre') ? 'Litre' : mesures[0];

        const nomsMarches = [...new Set([...resumes.map((r) => r.marche), ...(annonces ? annonces.annonces.map((a) => a.marche) : [])])];
        const marches = nomsMarches.map((nom) => ({
            nom,
            position: A.coordonnees(nom),
            resumes: A.trierMesures(resumes.filter((r) => r.marche === nom).map((r) => r.mesure))
                .map((m) => resumes.find((r) => r.marche === nom && r.mesure === m)),
            annonces: annonces ? annonces.annonces.filter((a) => a.marche === nom && a.disponible).length : 0,
        }));

        /* ---------- Carte ---------- */

        const zoneCarte = $('#carte-marches');
        let carte = null;
        const marqueurs = new Map();
        if (window.L && zoneCarte) {
            carte = L.map(zoneCarte, { scrollWheelZoom: false, zoomControl: true }).setView([7.6, 2.3], 7);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            }).addTo(carte);
        } else if (zoneCarte) {
            zoneCarte.innerHTML = '<p class="vide" style="margin:20px">La carte a besoin d\'Internet. La liste des marchés est juste à côté.</p>';
        }

        function contenuBulle(m) {
            const lignes = m.resumes.map((r) => `<li><span>${echapper(r.mesure)}</span><b>${A.fcfa(r.prix)}</b>${badgeTendance(r.variation)}</li>`).join('');
            return `
                <div class="bulle-marche">
                    <strong>${echapper(m.nom)}</strong>
                    ${lignes ? `<ul>${lignes}</ul>` : '<p>Pas encore de prix relevé.</p>'}
                    <p>${m.annonces} annonce${m.annonces > 1 ? 's' : ''} disponible${m.annonces > 1 ? 's' : ''}</p>
                    <div class="bulle-liens">
                        <a href="annonces.html?marche=${encodeURIComponent(m.nom)}">Annonces</a>
                        <a href="prix.html?marche=${encodeURIComponent(m.nom)}">Tous les prix</a>
                    </div>
                </div>`;
        }

        function dessinerMarqueurs(classement) {
            if (!carte) return;
            marqueurs.forEach((mq) => mq.remove());
            marqueurs.clear();
            const points = [];
            marches.filter((m) => m.position).forEach((m) => {
                const r = m.resumes.find((x) => x.mesure === mesure);
                const rang = classement.get(m.nom);
                const html = r
                    ? `<span class="marqueur-prix" style="--teinte:${teinte(rang)}">${A.fcfa(r.prix)}</span>`
                    : '<span class="marqueur-prix marqueur-vide">?</span>';
                const marqueur = L.marker(m.position, { icon: L.divIcon({ className: 'marqueur', html, iconSize: null, iconAnchor: [0, 0] }), title: m.nom })
                    .bindPopup(contenuBulle(m), { maxWidth: 280 })
                    .addTo(carte);
                marqueurs.set(m.nom, marqueur);
                points.push(m.position);
            });
            if (points.length && !dessinerMarqueurs.dejaCadre) {
                carte.fitBounds(points, { padding: [60, 60], maxZoom: 9 });
                dessinerMarqueurs.dejaCadre = true;
            }
        }

        /* ---------- Liste ---------- */

        function dessinerListe() {
            const avecPrix = marches.map((m) => ({ ...m, r: m.resumes.find((x) => x.mesure === mesure) }))
                .sort((a, b) => (a.r ? a.r.prix : Infinity) - (b.r ? b.r.prix : Infinity));
            const prixConnus = avecPrix.filter((m) => m.r);
            const classement = new Map(prixConnus.map((m, i) => [m.nom, prixConnus.length > 1 ? i / (prixConnus.length - 1) : 0]));
            $('#liste-marches').innerHTML = avecPrix.map((m, i) => `
                <article class="ligne-marche apparait" style="--delai:${i * 50}ms">
                    <span class="rang" style="background:${m.r ? teinte(classement.get(m.nom)) : 'var(--ligne)'}">${m.r ? i + 1 : '–'}</span>
                    <div class="ligne-marche-texte">
                        <strong>${echapper(m.nom)}</strong>
                        <small>${m.r ? `${A.ilYa(m.r.date)} · ${m.annonces} annonce${m.annonces > 1 ? 's' : ''}` : 'Pas de prix pour cette mesure'}${m.position ? '' : ' · pas encore sur la carte'}</small>
                    </div>
                    <div class="ligne-marche-prix">
                        ${m.r ? `<b>${A.fcfa(m.r.prix)}</b>${badgeTendance(m.r.variation)}` : ''}
                    </div>
                    ${m.position && carte ? `<button type="button" class="icone-bouton" data-voir="${echapper(m.nom)}" aria-label="Voir ${echapper(m.nom)} sur la carte">${A.ui.ICONES.lieu}</button>` : ''}
                </article>`).join('');
            $$('.apparait', $('#liste-marches')).forEach(observer2);
            dessinerMarqueurs(classement);
        }

        $('#liste-marches').addEventListener('click', (e) => {
            const bouton = e.target.closest('[data-voir]');
            if (!bouton || !carte) return;
            const m = marches.find((x) => x.nom === bouton.dataset.voir);
            if (window.innerWidth < 900) zoneCarte.scrollIntoView({ behavior: 'smooth', block: 'center' });
            carte.flyTo(m.position, 11, { duration: 0.8 });
            setTimeout(() => marqueurs.get(m.nom).openPopup(), 850);
        });

        const pastilles = $('#choix-mesure-carte');
        pastilles.innerHTML = mesures.map((m) => `<button type="button" class="pastille" aria-pressed="${m === mesure}">${echapper(m)}</button>`).join('');
        pastilles.addEventListener('click', (e) => {
            const bouton = e.target.closest('.pastille');
            if (!bouton) return;
            $$('.pastille', pastilles).forEach((b) => b.setAttribute('aria-pressed', String(b === bouton)));
            mesure = bouton.textContent;
            dessinerListe();
        });

        dessinerListe();
    });
})();
