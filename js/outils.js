/*
 * Amì vɔ̀vɔ̀ : outils (page outils.html).
 * Calculateur d'achat, prix de vente conseillé et alertes de prix gardées dans le téléphone.
 */
(function () {
    'use strict';

    const A = window.Amivovo;
    const { $, $$, echapper, remplirSelecteur } = A.ui;
    const nombre = (el) => Math.max(0, Number(String(el.value).replace(/\s/g, '').replace(',', '.')) || 0);
    const arrondir25 = (n) => Math.ceil(n / 25) * 25;

    A.pret.then((donnees) => {
        if (!donnees) return;
        const { resumes } = donnees;
        const mesures = A.trierMesures(Object.keys(A.MESURES));
        const marches = [...new Set(resumes.map((r) => r.marche))].sort();
        const prixDe = (mesure, marche) => {
            if (!marche) return A.prixReference(resumes, mesure);
            const r = resumes.find((x) => x.mesure === mesure && x.marche === marche);
            return r ? r.prix : null;
        };

        /* ---------- Calculateur d'achat ---------- */

        const cMesure = $('#calc-mesure'); const cQuantite = $('#calc-quantite'); const cMarche = $('#calc-marche');
        const cPrix = $('#calc-prix'); const cTransport = $('#calc-transport'); const cResultat = $('#calc-resultat');
        cMesure.innerHTML = mesures.map((m) => `<option${m === 'Bidon 25 L' ? ' selected' : ''}>${echapper(m)}</option>`).join('');
        remplirSelecteur(cMarche, marches, 'Prix moyen de tous les marchés');
        let prixModifie = false;
        cPrix.addEventListener('input', () => { prixModifie = true; });
        const proposerPrix = () => {
            prixModifie = false;
            const p = prixDe(cMesure.value, cMarche.value);
            cPrix.value = p ? Math.round(p) : '';
            $('#calc-prix-aide').textContent = p ? `Prix du jour ${cMarche.value ? `à ${cMarche.value}` : 'moyen'}. Vous pouvez le changer.` : 'Pas de prix connu : tapez le prix proposé.';
        };

        function calculerAchat() {
            const mesure = cMesure.value;
            const q = nombre(cQuantite); const prix = nombre(cPrix); const transport = nombre(cTransport);
            const litres = q * (A.MESURES[mesure] || 0);
            if (!q || !prix) { cResultat.innerHTML = '<p class="texte-doux">Indiquez la quantité et le prix pour voir le calcul.</p>'; return; }
            const total = q * prix + transport;
            const moinsCher = resumes.filter((r) => r.mesure === mesure).sort((a, b) => a.prix - b.prix)[0];
            let conseil = '';
            if (moinsCher && moinsCher.prix < prix) {
                const economie = (prix - moinsCher.prix) * q;
                conseil = `<p class="conseil-calcul">À <b>${echapper(moinsCher.marche)}</b>, la même quantité coûte <b>${A.fcfa(moinsCher.prix * q)}</b> : <b>${A.fcfa(economie)}</b> de moins, sans compter le transport. <a href="annonces.html?marche=${encodeURIComponent(moinsCher.marche)}&mesure=${encodeURIComponent(mesure)}">Voir les annonces</a></p>`;
            } else if (moinsCher) {
                conseil = '<p class="conseil-calcul vert">C\'est le meilleur prix du jour pour cette mesure.</p>';
            }
            cResultat.innerHTML = `
                <div class="resultat-grand"><span>Total à payer</span><b>${A.fcfa(total)}</b></div>
                <dl class="resultat-details">
                    <div><dt>Huile</dt><dd>${A.fcfa(q * prix)}</dd></div>
                    <div><dt>Transport</dt><dd>${A.fcfa(transport)}</dd></div>
                    <div><dt>Quantité</dt><dd>${litres.toLocaleString('fr-FR')} litres</dd></div>
                    <div><dt>Revient au litre</dt><dd>${litres ? A.fcfa(total / litres) : '—'}</dd></div>
                    <div><dt>En bouteilles 1,5 L</dt><dd>${Math.floor(litres / 1.5).toLocaleString('fr-FR')}</dd></div>
                    <div><dt>En bidons 25 L</dt><dd>${(litres / 25).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</dd></div>
                </dl>
                ${conseil}`;
        }
        [cMesure, cMarche].forEach((el) => el.addEventListener('change', () => { proposerPrix(); calculerAchat(); }));
        [cQuantite, cPrix, cTransport].forEach((el) => el.addEventListener('input', calculerAchat));
        proposerPrix();
        calculerAchat();

        /* ---------- Prix de vente conseillé ---------- */

        const vMesure = $('#vente-mesure'); const vCout = $('#vente-cout'); const vFrais = $('#vente-frais');
        const vMarge = $('#vente-marge'); const vResultat = $('#vente-resultat');
        vMesure.innerHTML = mesures.map((m) => `<option${m === 'Bidon 25 L' ? ' selected' : ''}>${echapper(m)}</option>`).join('');
        const ref25 = A.prixReference(resumes, 'Bidon 25 L');
        if (ref25) vCout.value = Math.round(ref25 * 0.92 / 25) * 25;

        function calculerVente() {
            const litresAchat = A.MESURES[vMesure.value];
            const coutLitre = (nombre(vCout) + nombre(vFrais)) / litresAchat;
            const marge = nombre(vMarge) / 100;
            $('#vente-marge-valeur').textContent = `${Math.round(marge * 100)} %`;
            if (!nombre(vCout)) { vResultat.innerHTML = '<p class="texte-doux">Indiquez votre prix d\'achat.</p>'; return; }
            vResultat.innerHTML = `
                <p class="texte-doux">Votre huile vous revient à <b>${A.fcfa(coutLitre)}</b> le litre.</p>
                <div class="tableau-conteneur"><table class="tableau tableau-compact">
                    <thead><tr><th>Mesure</th><th>Conseillé</th><th>Bénéfice</th><th>Marché</th></tr></thead>
                    <tbody>${mesures.map((m) => {
                        const conseille = arrondir25(coutLitre * A.MESURES[m] * (1 + marge));
                        const benefice = conseille - coutLitre * A.MESURES[m];
                        const marche = A.prixReference(resumes, m);
                        let badge = '';
                        if (marche && conseille > marche * 1.05) badge = '<span class="badge orange">plus cher</span>';
                        else if (marche && conseille < marche * 0.95) badge = '<span class="badge vert">moins cher</span>';
                        return `<tr><td><b>${echapper(m)}</b></td><td><b>${A.fcfa(conseille)}</b></td><td>${A.fcfa(benefice)}</td><td>${marche ? A.fcfa(marche) : '—'}${badge ? `<br>${badge}` : ''}</td></tr>`;
                    }).join('')}</tbody>
                </table></div>`;
        }
        [vMesure, vCout, vFrais, vMarge].forEach((el) => el.addEventListener('input', calculerVente));
        calculerVente();

        /* ---------- Alertes ---------- */

        const aMesure = $('#alerte-mesure'); const aMarche = $('#alerte-marche'); const aSeuil = $('#alerte-seuil');
        aMesure.innerHTML = mesures.map((m) => `<option${m === 'Bidon 25 L' ? ' selected' : ''}>${echapper(m)}</option>`).join('');
        remplirSelecteur(aMarche, marches, "N'importe quel marché");
        const proposerSeuil = () => {
            const p = prixDe(aMesure.value, aMarche.value);
            aSeuil.value = p ? Math.round((p * 0.95) / 25) * 25 : '';
        };
        [aMesure, aMarche].forEach((el) => el.addEventListener('change', proposerSeuil));
        proposerSeuil();

        function dessinerAlertes() {
            const liste = A.lireAlertes();
            const declenchees = new Map(A.alertesDeclenchees(resumes).map((d) => [d.alerte.id, d.meilleur]));
            $('#liste-alertes').innerHTML = liste.length ? liste.map((alerte) => {
                const actuel = prixDe(alerte.mesure, alerte.marche);
                const atteinte = declenchees.get(alerte.id);
                return `
                    <li class="ligne-alerte ${atteinte ? 'atteinte' : ''}">
                        <span class="pastille-alerte" aria-hidden="true">${atteinte ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>'}</span>
                        <div>
                            <strong>${echapper(alerte.mesure)} sous ${A.fcfa(alerte.seuil)}</strong>
                            <small>${alerte.marche ? echapper(alerte.marche) : 'Tous les marchés'} · ${atteinte
                                ? `<b>Atteint : ${A.fcfa(atteinte.prix)} à ${echapper(atteinte.marche)}</b>`
                                : `prix actuel ${actuel ? A.fcfa(actuel) : 'inconnu'}`}</small>
                        </div>
                        <button type="button" class="icone-bouton" data-supprimer="${alerte.id}" aria-label="Supprimer cette alerte"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/></svg></button>
                    </li>`;
            }).join('') : '<li class="texte-doux">Aucune alerte pour le moment.</li>';
        }

        $('#form-alerte').addEventListener('submit', (e) => {
            e.preventDefault();
            const seuil = nombre(aSeuil);
            if (!seuil) { aSeuil.focus(); return; }
            const liste = A.lireAlertes();
            liste.push({ id: `a${Date.now()}`, mesure: aMesure.value, marche: aMarche.value, seuil });
            if (!A.ecrireAlertes(liste)) { notifier("Impossible d'enregistrer l'alerte sur ce téléphone.", 'erreur'); return; }
            dessinerAlertes();
            notifier('Alerte enregistrée. Elle s\'affichera quand vous ouvrirez Amì vɔ̀vɔ̀.');
        });
        $('#liste-alertes').addEventListener('click', (e) => {
            const bouton = e.target.closest('[data-supprimer]');
            if (!bouton) return;
            A.ecrireAlertes(A.lireAlertes().filter((a) => a.id !== bouton.dataset.supprimer));
            dessinerAlertes();
            notifier('Alerte supprimée.');
        });
        dessinerAlertes();

        const boutonNotif = $('#autoriser-notifications');
        const etatNotif = () => {
            if (!('Notification' in window)) { boutonNotif.hidden = true; return; }
            const accordee = Notification.permission === 'granted';
            boutonNotif.hidden = accordee || Notification.permission === 'denied';
            $('#notifications-ok').hidden = !accordee;
        };
        boutonNotif.addEventListener('click', async () => {
            await Notification.requestPermission();
            etatNotif();
        });
        etatNotif();
    });

    function notifier(message, type = 'ok') {
        let zone = $('.notifications');
        if (!zone) { zone = document.createElement('div'); zone.className = 'notifications'; zone.setAttribute('role', 'status'); document.body.appendChild(zone); }
        const el = document.createElement('div');
        el.className = `notification ${type === 'erreur' ? 'erreur' : ''}`;
        el.textContent = message;
        zone.appendChild(el);
        setTimeout(() => { el.classList.add('sort'); setTimeout(() => el.remove(), 400); }, 3200);
    }
    A.notifier = notifier;
})();
