/*
 * Amì vɔ̀vɔ̀ : le cahier de la vendeuse.
 * Achats, ventes, crédits clients et paiements, enregistrés dans le téléphone (localStorage).
 * Rien n'est envoyé sur Internet. Une sauvegarde en fichier permet de changer de téléphone.
 */
(function () {
    'use strict';

    const A = window.Amivovo;
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const CLE = 'amivovo-cahier-v1';
    const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const aujourdhui = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const versDate = (texte) => { const [a, m, j] = texte.split('-').map(Number); return new Date(a, m - 1, j); };
    const LIBELLES = { achat: "J'ai acheté", vente: "J'ai vendu", paiement: 'On m\'a payé' };

    /* ---------- Stockage ---------- */

    let operations = [];
    function charger() {
        try { operations = JSON.parse(localStorage.getItem(CLE) || '[]'); }
        catch (e) { operations = []; }
        if (!Array.isArray(operations)) operations = [];
    }
    function enregistrer() {
        try { localStorage.setItem(CLE, JSON.stringify(operations)); }
        catch (e) { notifier("Impossible d'enregistrer : la mémoire du navigateur est pleine ou bloquée.", 'erreur'); }
    }

    /* ---------- Calculs ---------- */

    const litres = (op) => (A.MESURES[op.mesure] || 0) * (op.quantite || 0);
    const duMois = (op, ref = new Date()) => { const d = versDate(op.date); return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear(); };

    function credits() {
        const parClient = new Map();
        operations.forEach((op) => {
            const nom = (op.client || '').trim();
            if (!nom) return;
            const cle = nom.toLowerCase();
            if (!parClient.has(cle)) parClient.set(cle, { nom, du: 0, derniere: op.date });
            const c = parClient.get(cle);
            if (op.type === 'vente') c.du += op.total - (op.paye ?? op.total);
            if (op.type === 'paiement') c.du -= op.total;
            if (op.date > c.derniere) c.derniere = op.date;
        });
        return [...parClient.values()].filter((c) => c.du > 0).sort((a, b) => b.du - a.du);
    }

    /** Prix d'achat moyen d'un litre, sur tous les achats notés (0 si aucun achat). */
    function coutMoyenLitre() {
        const achats = operations.filter((op) => op.type === 'achat');
        const totalLitres = achats.reduce((s, op) => s + litres(op), 0);
        return totalLitres ? achats.reduce((s, op) => s + op.total, 0) / totalLitres : 0;
    }

    /**
     * Bénéfice estimé = ventes − prix d'achat de l'huile vendue (au coût moyen du litre).
     * L'huile achetée mais pas encore vendue reste en stock : ce n'est pas une perte.
     */
    function bilan(ref = new Date()) {
        const mois = operations.filter((op) => duMois(op, ref));
        const ventesDuMois = mois.filter((op) => op.type === 'vente');
        const ventes = ventesDuMois.reduce((s, op) => s + op.total, 0);
        const achats = mois.filter((op) => op.type === 'achat').reduce((s, op) => s + op.total, 0);
        const coutVendu = ventesDuMois.reduce((s, op) => s + litres(op), 0) * coutMoyenLitre();
        const stock = operations.reduce((s, op) => s + (op.type === 'achat' ? litres(op) : op.type === 'vente' ? -litres(op) : 0), 0);
        const aRecevoir = credits().reduce((s, c) => s + c.du, 0);
        return { ventes, achats, benefice: Math.round(ventes - coutVendu), stock, aRecevoir };
    }

    /* ---------- Affichage ---------- */

    function afficherChiffres() {
        const b = bilan();
        const mois = new Date().toLocaleDateString('fr-FR', { month: 'long' });
        $$('[data-mois]').forEach((el) => { el.textContent = mois; });
        $('#chiffre-benefice').textContent = A.fcfa(b.benefice);
        $('#chiffre-benefice').closest('.chiffre').classList.toggle('negatif', b.benefice < 0);
        $('#chiffre-ventes').textContent = A.fcfa(b.ventes);
        $('#chiffre-achats').textContent = A.fcfa(b.achats);
        $('#chiffre-stock').textContent = `${Math.max(0, Math.round(b.stock)).toLocaleString('fr-FR')} L`;
        $('#chiffre-credits').textContent = A.fcfa(b.aRecevoir);
        const precedent = new Date(); precedent.setMonth(precedent.getMonth() - 1);
        const avant = bilan(precedent).benefice;
        const comparaison = $('#comparaison-benefice');
        if (!operations.length) comparaison.textContent = 'Ajoutez votre première opération ci-dessous.';
        else if (avant === 0) comparaison.textContent = 'Pas de comparaison avec le mois dernier.';
        else {
            const ecart = b.benefice - avant;
            comparaison.textContent = `${ecart >= 0 ? 'En hausse de' : 'En baisse de'} ${A.fcfa(Math.abs(ecart))} par rapport au mois dernier`;
        }
    }

    function afficherGraphique() {
        const zone = $('#graphique-mois');
        const mois = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return d; });
        const donnees = mois.map((d) => ({ d, ...bilan(d) }));
        const max = Math.max(1, ...donnees.flatMap((x) => [x.ventes, x.achats]));
        const W = 620; const H = 240; const B = 30; const largeur = (W - 20) / 6;
        let svg = `<svg class="graphique" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ventes et achats des 6 derniers mois">`;
        donnees.forEach((x, i) => {
            const cx = 10 + i * largeur;
            const hv = ((H - B - 10) * x.ventes) / max;
            const ha = ((H - B - 10) * x.achats) / max;
            svg += `<rect x="${cx + largeur * 0.18}" y="${H - B - hv}" width="${largeur * 0.3}" height="${hv}" rx="6" fill="var(--huile)" class="barre" style="animation-delay:${i * 80}ms"><title>Ventes : ${A.fcfa(x.ventes)}</title></rect>`;
            svg += `<rect x="${cx + largeur * 0.52}" y="${H - B - ha}" width="${largeur * 0.3}" height="${ha}" rx="6" fill="var(--palme)" opacity=".75" class="barre" style="animation-delay:${i * 80 + 40}ms"><title>Achats : ${A.fcfa(x.achats)}</title></rect>`;
            svg += `<text class="axe" x="${cx + largeur / 2}" y="${H - 8}" text-anchor="middle">${x.d.toLocaleDateString('fr-FR', { month: 'short' })}</text>`;
        });
        zone.innerHTML = `${svg}</svg><div class="legende"><span><i style="background:var(--huile)"></i>Ventes</span><span><i style="background:var(--palme)"></i>Achats</span></div>`;
    }

    function afficherCredits() {
        const liste = credits();
        const zone = $('#liste-credits');
        zone.innerHTML = liste.length ? liste.map((c) => `
            <li class="ligne-credit">
                <span class="avatar petit" aria-hidden="true">${echapper(c.nom.charAt(0).toUpperCase())}</span>
                <span class="ligne-texte"><b>${echapper(c.nom)}</b><small>depuis le ${versDate(c.derniere).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</small></span>
                <b class="montant-du">${A.fcfa(c.du)}</b>
                <button type="button" class="bouton bouton-contour bouton-petit" data-encaisser="${echapper(c.nom)}" data-montant="${c.du}">Encaisser</button>
            </li>`).join('') : '<li class="vide" style="padding:28px">Personne ne vous doit d\'argent.</li>';
    }

    function afficherHistorique() {
        const zone = $('#historique');
        const filtre = $('#filtre-historique').value;
        const liste = operations.filter((op) => !filtre || op.type === filtre)
            .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 60);
        if (!liste.length) {
            zone.innerHTML = '<li class="vide">Rien pour le moment. Utilisez les gros boutons ci-dessus pour noter vos achats et vos ventes.</li>';
            return;
        }
        let dernierJour = '';
        zone.innerHTML = liste.map((op) => {
            const jour = versDate(op.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            const titreJour = jour !== dernierJour ? `<li class="jour">${jour}</li>` : '';
            dernierJour = jour;
            const detail = op.type === 'paiement'
                ? `${echapper(op.client)} a payé`
                : `${op.quantite} × ${echapper(op.mesure)} à ${A.fcfa(op.prixUnitaire)}${op.client ? ` · ${echapper(op.client)}` : ''}`;
            const resteDu = op.type === 'vente' && op.paye < op.total ? `<span class="badge orange">${A.fcfa(op.total - op.paye)} à crédit</span>` : '';
            const signe = op.type === 'achat' ? '−' : '+';
            return `${titreJour}
                <li class="operation ${op.type}">
                    <span class="pastille-type" aria-hidden="true">${op.type === 'achat' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>' : op.type === 'vente' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V9M7 14l5-5 5 5M5 4h14"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/></svg>'}</span>
                    <span class="ligne-texte"><b>${LIBELLES[op.type]}</b><small>${detail}</small>${op.note ? `<small>${echapper(op.note)}</small>` : ''}${resteDu}</span>
                    <b class="montant ${op.type}">${signe} ${A.fcfa(op.total)}</b>
                    <button type="button" class="icone-bouton" data-supprimer="${op.id}" aria-label="Supprimer cette ligne">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
                    </button>
                </li>`;
        }).join('');
    }

    function toutAfficher() {
        afficherChiffres();
        afficherGraphique();
        afficherCredits();
        afficherHistorique();
        const noms = [...new Set(operations.map((op) => op.client).filter(Boolean))].sort();
        $('#liste-clients').innerHTML = noms.map((n) => `<option value="${echapper(n)}">`).join('');
    }

    /* ---------- Notifications (pas de pop-up du navigateur) ---------- */

    function notifier(message, type = 'ok') {
        const zone = $('#notifications');
        const el = document.createElement('div');
        el.className = `notification ${type}`;
        el.textContent = message;
        zone.appendChild(el);
        setTimeout(() => el.classList.add('sort'), 2800);
        setTimeout(() => el.remove(), 3300);
    }

    /** Fenêtre de confirmation du site, à la place de confirm(). */
    function confirmer(titre, texte, libelle = 'Supprimer') {
        const fenetre = $('#fenetre-confirmation');
        $('#confirmation-titre').textContent = titre;
        $('#confirmation-texte').textContent = texte;
        $('#confirmation-ok').textContent = libelle;
        fenetre.showModal();
        return new Promise((resoudre) => {
            fenetre.addEventListener('close', () => resoudre(fenetre.returnValue === 'ok'), { once: true });
        });
    }

    /* ---------- Formulaire d'opération ---------- */

    const fenetre = $('#fenetre-operation');
    const formulaire = $('#formulaire-operation');

    function ouvrir(type, prerempli = {}) {
        formulaire.reset();
        formulaire.dataset.type = type;
        $('#operation-titre').textContent = LIBELLES[type];
        $('#operation-date').value = aujourdhui();
        $$('[data-pour]', formulaire).forEach((el) => {
            const visible = el.dataset.pour.split(' ').includes(type);
            el.hidden = !visible;
            $$('input, select', el).forEach((champ) => { champ.disabled = !visible; });
        });
        $('#operation-client').required = type === 'paiement';
        if (prerempli.client) $('#operation-client').value = prerempli.client;
        if (prerempli.montant) $('#operation-montant').value = prerempli.montant;
        majTotal();
        fenetre.showModal();
        setTimeout(() => $('input:not([type=date]):not([disabled]), select:not([disabled])', formulaire)?.focus(), 50);
    }

    function majTotal() {
        const type = formulaire.dataset.type;
        if (type === 'paiement') return;
        const total = (Number($('#operation-quantite').value) || 0) * (Number($('#operation-prix').value) || 0);
        $('#operation-total').textContent = A.fcfa(total);
        const credit = type === 'vente' && $('#operation-credit').checked;
        $('#bloc-paye').hidden = !credit;
        $('#operation-paye').disabled = !credit;
        $('#operation-client').required = credit || type === 'paiement';
    }

    formulaire.addEventListener('input', majTotal);
    formulaire.addEventListener('change', majTotal);

    formulaire.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!formulaire.reportValidity()) return;
        const type = formulaire.dataset.type;
        const op = { id: Date.now(), type, date: $('#operation-date').value, note: $('#operation-note').value.trim(), client: $('#operation-client').value.trim() };
        if (type === 'paiement') {
            op.total = Number($('#operation-montant').value);
        } else {
            op.quantite = Number($('#operation-quantite').value);
            op.mesure = $('#operation-mesure').value;
            op.prixUnitaire = Number($('#operation-prix').value);
            op.total = op.quantite * op.prixUnitaire;
            if (type === 'vente') {
                op.paye = $('#operation-credit').checked ? Math.min(op.total, Number($('#operation-paye').value) || 0) : op.total;
            }
        }
        if (!(op.total > 0)) { notifier('Le montant doit être supérieur à zéro.', 'erreur'); return; }
        operations.push(op);
        enregistrer();
        fenetre.close();
        toutAfficher();
        notifier(type === 'achat' ? 'Achat noté.' : type === 'vente' ? 'Vente notée.' : 'Paiement noté.');
    });

    $$('[data-fermer]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close('annuler')));
    $$('[data-ouvrir]').forEach((b) => b.addEventListener('click', () => ouvrir(b.dataset.ouvrir)));

    document.addEventListener('click', async (e) => {
        const encaisser = e.target.closest('[data-encaisser]');
        if (encaisser) ouvrir('paiement', { client: encaisser.dataset.encaisser, montant: encaisser.dataset.montant });

        const supprimer = e.target.closest('[data-supprimer]');
        if (supprimer) {
            const ok = await confirmer('Supprimer cette ligne ?', 'Elle sera retirée de votre cahier et vos totaux seront recalculés.');
            if (!ok) return;
            operations = operations.filter((op) => String(op.id) !== supprimer.dataset.supprimer);
            enregistrer();
            toutAfficher();
            notifier('Ligne supprimée.');
        }
    });

    $('#filtre-historique').addEventListener('change', afficherHistorique);

    /* ---------- Sauvegarde, restauration, partage ---------- */

    $('#bouton-sauvegarder').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify({ application: 'amivovo', version: 1, date: new Date().toISOString(), operations }, null, 2)], { type: 'application/json' });
        const lien = document.createElement('a');
        lien.href = URL.createObjectURL(blob);
        lien.download = `cahier-amivovo-${aujourdhui()}.json`;
        lien.click();
        URL.revokeObjectURL(lien.href);
        notifier('Fichier de sauvegarde téléchargé.');
    });

    $('#fichier-restaurer').addEventListener('change', async (e) => {
        const fichier = e.target.files[0];
        e.target.value = '';
        if (!fichier) return;
        try {
            const contenu = JSON.parse(await fichier.text());
            if (!Array.isArray(contenu.operations)) throw new Error('format');
            const ok = await confirmer('Restaurer ce fichier ?', `Il contient ${contenu.operations.length} ligne(s). Elles remplaceront le contenu actuel de votre cahier.`, 'Restaurer');
            if (!ok) return;
            operations = contenu.operations;
            enregistrer();
            toutAfficher();
            notifier('Cahier restauré.');
        } catch (erreur) {
            notifier("Ce fichier n'est pas une sauvegarde du cahier.", 'erreur');
        }
    });

    $('#bouton-partager').addEventListener('click', () => {
        const b = bilan();
        const mois = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const texte = `Mon bilan Amì vɔ̀vɔ̀ (${mois}) :\n- Ventes : ${A.fcfa(b.ventes)}\n- Achats : ${A.fcfa(b.achats)}\n- Bénéfice : ${A.fcfa(b.benefice)}\n- Stock : ${Math.max(0, Math.round(b.stock))} L\n- On me doit : ${A.fcfa(b.aRecevoir)}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, '_blank', 'noopener');
    });

    /* ---------- Prix du jour en rappel ---------- */

    A.chargerPrix().then(({ lignes, exemple }) => {
        const resumes = A.series(lignes).filter((s) => s.points.length).map(A.resume);
        const ref = A.prixReference(resumes, 'Litre');
        const ref25 = A.prixReference(resumes, 'Bidon 25 L');
        if (!ref) return;
        $('#rappel-prix').innerHTML = `Prix moyen aujourd'hui : <b>${A.fcfa(ref)}</b> le litre${ref25 ? `, <b>${A.fcfa(ref25)}</b> le bidon de 25 L` : ''}${exemple ? ' <span class="texte-doux">(exemple)</span>' : ''}. <a href="prix.html">Voir tous les marchés</a>`;
        $('#rappel-prix').hidden = false;
    }).catch(() => {});

    charger();
    toutAfficher();
})();
