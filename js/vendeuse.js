/*
 * Amì vɔ̀vɔ̀ : fiche d'une vendeuse (page vendeuse.html?id=numéro).
 * Tout vient des annonces publiées : marchés, mesures, annonces en cours et historique des prix.
 */
(function () {
    'use strict';

    const A = window.Amivovo;
    const { $, echapper, listeAnnonces, initiale, ICONES } = A.ui;
    const id = new URLSearchParams(window.location.search).get('id') || '';

    A.pret.then((donnees) => {
        const zone = $('#fiche');
        if (!donnees || !donnees.annonces) { zone.innerHTML = '<p class="vide">Les annonces sont momentanément indisponibles.</p>'; return; }
        const { annonces, resumes } = donnees;
        const v = A.vendeuses(annonces.historique).find((x) => x.telephone === id || x.nom === id);
        if (!v) {
            zone.innerHTML = '<p class="vide">Cette vendeuse n\'a pas (ou plus) d\'annonce sur Amì vɔ̀vɔ̀. <a href="annonces.html">Voir toutes les annonces</a></p>';
            return;
        }

        document.title = `${v.nom} · Amì vɔ̀vɔ̀`;
        const enCours = annonces.annonces.filter((a) => (a.telephone || a.vendeuse) === (v.telephone || v.nom));
        const disponibles = enCours.filter((a) => a.disponible);
        const ecarts = disponibles.map((a) => { const ref = A.prixReference(resumes, a.mesure); return ref ? (a.prix - ref) / ref : null; }).filter((x) => x !== null);
        const ecart = ecarts.length ? ecarts.reduce((s, x) => s + x, 0) / ecarts.length : null;
        let phraseEcart = 'Pas de comparaison possible pour le moment.';
        if (ecart !== null) {
            if (ecart < -0.01) phraseEcart = `En moyenne <b class="vert">${A.pourcent(ecart)}</b> par rapport au prix du marché : moins cher.`;
            else if (ecart > 0.01) phraseEcart = `En moyenne <b>${A.pourcent(ecart)}</b> par rapport au prix du marché.`;
            else phraseEcart = 'Au prix du marché.';
        }
        const message = `Bonjour ${v.nom}, j'ai vu votre fiche sur Amì vɔ̀vɔ̀. Avez-vous de l'huile rouge disponible ?`;

        $('#fiche-nom').textContent = v.nom;
        $('#fiche-avatar').textContent = initiale(v.nom);
        $('#fiche-lieu').innerHTML = `${ICONES.lieu} ${echapper(v.marches.join(', '))}`;

        zone.innerHTML = `
            <div class="fiche-grille">
                <div class="carte fiche-infos apparait">
                    <dl>
                        <div><dt>Annonces disponibles</dt><dd>${disponibles.length}</dd></div>
                        <div><dt>Annonces publiées</dt><dd>${v.annonces.length}</dd></div>
                        <div><dt>Sur Amì vɔ̀vɔ̀ depuis</dt><dd>${v.depuis ? v.depuis.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '—'}</dd></div>
                    </dl>
                    <p>${phraseEcart}</p>
                    <div class="badges">${v.mesures.map((m) => `<span class="badge">${echapper(m)}</span>`).join('')}</div>
                    <div class="fiche-actions">
                        ${v.telephone ? `<a class="bouton bouton-whatsapp" href="${A.lienWhatsapp(v.telephone, message)}" target="_blank" rel="noopener">${ICONES.whatsapp} Écrire sur WhatsApp</a>` : ''}
                        <button type="button" class="bouton bouton-contour" id="partager-fiche"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg> Partager la fiche</button>
                    </div>
                </div>
                <div>
                    <h2 class="titre-bloc">Ses annonces</h2>
                    <div class="grille-annonces grille-annonces-2" id="fiche-annonces"></div>
                </div>
            </div>
            <div class="carte bloc apparait" style="margin-top:28px">
                <h2 class="titre-bloc">Historique de ses prix</h2>
                <div class="tableau-conteneur"><table class="tableau tableau-compact">
                    <thead><tr><th>Date</th><th>Mesure</th><th>Quantité</th><th>Prix</th><th>Marché</th></tr></thead>
                    <tbody>${v.annonces.slice(0, 20).map((a) => `<tr><td>${a.date ? A.dateCourte(a.date) : '—'}</td><td>${echapper(a.mesure)}</td><td>${a.quantite || '—'}</td><td><b>${A.fcfa(a.prix)}</b></td><td>${echapper(a.marche)}</td></tr>`).join('')}</tbody>
                </table></div>
            </div>`;
        listeAnnonces($('#fiche-annonces'), enCours, resumes);
        A.ui.$$('.apparait', zone).forEach(A.ui.observer2);

        $('#partager-fiche').addEventListener('click', async () => {
            const donneesPartage = { title: `${v.nom} sur Amì vɔ̀vɔ̀`, text: `Huile rouge : ${v.nom} (${v.marches.join(', ')})`, url: window.location.href };
            if (navigator.share) {
                try { await navigator.share(donneesPartage); } catch (e) { /* partage annulé */ }
                return;
            }
            window.open(`https://wa.me/?text=${encodeURIComponent(`${donneesPartage.text} ${donneesPartage.url}`)}`, '_blank', 'noopener');
        });
    });
})();
