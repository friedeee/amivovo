/*
 * Amì vɔ̀vɔ̀ : la vendeuse met à jour son prix du jour et ses annonces (page vendre.html).
 * Les réponses partent dans les formulaires Google configurés dans reglages.js,
 * et apparaissent sur le site quelques minutes plus tard, sans que personne n'ait à les recopier.
 * Sans formulaire configuré, on prépare un message WhatsApp pour l'équipe à la place.
 */
(function () {
    'use strict';

    const A = window.Amivovo;
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const CLE_PROFIL = 'amivovo-vendeuse-v1';
    const CLE_ANNONCES = 'amivovo-mes-annonces-v1';
    const formulairePrix = A.lireFormulaire(A.REGLAGES.formulairePrix);
    const formulaireAnnonce = A.lireFormulaire(A.REGLAGES.formulaireAnnonce);

    const lire = (cle, defaut) => { try { return JSON.parse(localStorage.getItem(cle) || 'null') ?? defaut; } catch (e) { return defaut; } };
    const ecrire = (cle, valeur) => { try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) { /* stockage indisponible */ } };

    /* ---------- Listes : mesures et marchés connus ---------- */

    const mesures = A.trierMesures(Object.keys(A.MESURES));
    $$('select[data-mesures]').forEach((select) => {
        select.innerHTML = mesures.map((m) => `<option${m === select.dataset.mesures ? ' selected' : ''}>${echapper(m)}</option>`).join('');
    });
    A.chargerPrix().then(({ lignes }) => {
        const marches = [...new Set(lignes.map((l) => l.marche))].sort();
        $('#liste-marches-connus').innerHTML = marches.map((m) => `<option value="${echapper(m)}">`).join('');
    }).catch(() => { /* liste vide : on tape le marché à la main */ });

    /* ---------- Profil de la vendeuse, retenu pour ne pas tout retaper ---------- */

    const profil = lire(CLE_PROFIL, {});
    $$('[data-profil]').forEach((champ) => { if (profil[champ.dataset.profil]) champ.value = profil[champ.dataset.profil]; });
    function retenirProfil(form) {
        $$('[data-profil]', form).forEach((champ) => { if (champ.value.trim()) profil[champ.dataset.profil] = champ.value.trim(); });
        ecrire(CLE_PROFIL, profil);
        $$('[data-profil]').forEach((champ) => { if (!champ.value && profil[champ.dataset.profil]) champ.value = profil[champ.dataset.profil]; });
    }

    /* ---------- Envoi ---------- */

    const valeursDe = (form) => Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : '']));

    function messageWhatsapp(titre, valeurs, libelles) {
        return `Bonjour Amì vɔ̀vɔ̀ ! ${titre}\n${Object.entries(libelles).filter(([cle]) => valeurs[cle]).map(([cle, libelle]) => `${libelle} : ${valeurs[cle]}`).join('\n')}`;
    }

    /** Envoie au formulaire Google, ou ouvre WhatsApp si le formulaire n'est pas configuré. Renvoie « formulaire » ou « whatsapp ». */
    async function envoyer(formulaire, lien, valeurs, titre, libelles) {
        if (formulaire) {
            await A.envoyerFormulaire(lien, valeurs);
            return 'formulaire';
        }
        window.open(A.lienWhatsapp(A.REGLAGES.whatsapp, messageWhatsapp(titre, valeurs, libelles)), '_blank', 'noopener');
        return 'whatsapp';
    }

    function occupe(bouton, actif) {
        bouton.disabled = actif;
        bouton.classList.toggle('est-occupe', actif);
    }

    const LIBELLES_PRIX = { marche: 'Marché', mesure: 'Mesure', prix: 'Prix', telephone: 'Mon numéro' };
    $('#form-prix').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (!form.reportValidity()) return;
        const valeurs = valeursDe(form);
        valeurs.prix = valeurs.prix.replace(/\D/g, '');
        const bouton = $('button[type="submit"]', form);
        occupe(bouton, true);
        try {
            const voie = await envoyer(formulairePrix, A.REGLAGES.formulairePrix, valeurs, 'Prix du jour :', LIBELLES_PRIX);
            retenirProfil(form);
            $('#form-prix [name="prix"]').value = '';
            merci(voie, 'Merci pour votre prix !', `${valeurs.mesure} à ${A.fcfa(Number(valeurs.prix))} à ${valeurs.marche}.`);
        } catch (erreur) {
            notifier("L'envoi n'a pas marché. Vérifiez votre connexion Internet, puis réessayez.", 'erreur');
        } finally {
            occupe(bouton, false);
        }
    });

    const LIBELLES_ANNONCE = { vendeuse: 'Nom', telephone: 'WhatsApp', marche: 'Marché', quantite: 'Quantité', mesure: 'Mesure', prix: 'Prix', note: 'Note', disponible: 'Disponible' };
    async function envoyerAnnonce(valeurs, bouton) {
        if (bouton) occupe(bouton, true);
        try {
            const voie = await envoyer(formulaireAnnonce, A.REGLAGES.formulaireAnnonce, valeurs, 'Mon annonce :', LIBELLES_ANNONCE);
            /* On garde la dernière version de chaque annonce (une par mesure) pour pouvoir la modifier plus tard. */
            const mes = lire(CLE_ANNONCES, []).filter((a) => a.mesure !== valeurs.mesure);
            mes.unshift({ ...valeurs, le: Date.now() });
            ecrire(CLE_ANNONCES, mes.slice(0, 12));
            dessinerMesAnnonces();
            return voie;
        } finally {
            if (bouton) occupe(bouton, false);
        }
    }

    $('#form-annonce').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (!form.reportValidity()) return;
        const valeurs = valeursDe(form);
        valeurs.prix = valeurs.prix.replace(/\D/g, '');
        valeurs.quantite = valeurs.quantite.replace(/\D/g, '');
        valeurs.telephone = A.telephoneNettoye(valeurs.telephone);
        valeurs.disponible = 'Oui';
        delete valeurs.accord;
        try {
            const voie = await envoyerAnnonce(valeurs, $('button[type="submit"]', form));
            retenirProfil(form);
            ['quantite', 'prix', 'note'].forEach((n) => { form.elements[n].value = ''; });
            merci(voie, 'Votre annonce est envoyée !', `${valeurs.quantite} × ${valeurs.mesure} à ${A.fcfa(Number(valeurs.prix))}.`);
        } catch (erreur) {
            notifier("L'envoi n'a pas marché. Vérifiez votre connexion Internet, puis réessayez.", 'erreur');
        }
    });

    /* ---------- Mes annonces (gardées dans ce téléphone) ---------- */

    function dessinerMesAnnonces() {
        const mes = lire(CLE_ANNONCES, []);
        $('#bloc-mes-annonces').hidden = !mes.length;
        $('#mes-annonces').innerHTML = mes.map((a, i) => `
            <li class="mon-annonce ${a.disponible === 'Oui' ? '' : 'epuisee'}">
                <div class="ligne-texte">
                    <b>${echapper(a.quantite)} × ${echapper(a.mesure)} à ${A.fcfa(Number(a.prix))}</b>
                    <small>${echapper(a.marche)} · envoyée ${A.ilYa(new Date(a.le))}${a.disponible === 'Oui' ? '' : ' · <span class="badge">Épuisée</span>'}</small>
                </div>
                <div class="mon-annonce-actions">
                    <button type="button" class="bouton bouton-petit bouton-contour" data-modifier="${i}">Changer le prix</button>
                    <button type="button" class="bouton bouton-petit ${a.disponible === 'Oui' ? 'bouton-contour' : 'bouton-huile'}" data-basculer="${i}">${a.disponible === 'Oui' ? "C'est épuisé" : 'De nouveau disponible'}</button>
                </div>
            </li>`).join('');
    }

    $('#mes-annonces').addEventListener('click', async (e) => {
        const mes = lire(CLE_ANNONCES, []);
        const modifier = e.target.closest('[data-modifier]');
        const basculer = e.target.closest('[data-basculer]');
        if (modifier) {
            const a = mes[Number(modifier.dataset.modifier)];
            const form = $('#form-annonce');
            ['vendeuse', 'telephone', 'marche', 'quantite', 'mesure', 'prix', 'note'].forEach((n) => { if (form.elements[n]) form.elements[n].value = a[n] || ''; });
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => form.elements.prix.focus(), 500);
            notifier('Changez le prix ou la quantité, puis appuyez sur « Publier mon annonce ».');
        }
        if (basculer) {
            const a = mes[Number(basculer.dataset.basculer)];
            const valeurs = { ...a, disponible: a.disponible === 'Oui' ? 'Non' : 'Oui' };
            delete valeurs.le;
            try {
                const voie = await envoyerAnnonce(valeurs, basculer);
                merci(voie, valeurs.disponible === 'Oui' ? 'Annonce remise en ligne' : 'Annonce marquée épuisée', `${valeurs.mesure} à ${valeurs.marche}.`);
            } catch (erreur) {
                notifier("L'envoi n'a pas marché. Vérifiez votre connexion Internet.", 'erreur');
            }
        }
    });
    dessinerMesAnnonces();

    /* ---------- Messages ---------- */

    const fenetre = $('#fenetre-merci');
    function merci(voie, titre, detail) {
        $('#merci-titre').textContent = titre;
        $('#merci-detail').textContent = detail;
        $('#merci-explication').textContent = voie === 'formulaire'
            ? 'Elle apparaîtra sur le site dans quelques minutes, le temps que le tableau se mette à jour.'
            : 'WhatsApp s\'est ouvert avec votre message déjà écrit : appuyez sur « Envoyer ». L\'équipe le mettra en ligne.';
        if (typeof fenetre.showModal === 'function') fenetre.showModal();
        else notifier(titre);
    }

    function notifier(message, type = 'ok') {
        let zone = $('.notifications');
        if (!zone) { zone = document.createElement('div'); zone.className = 'notifications'; zone.setAttribute('role', 'status'); document.body.appendChild(zone); }
        const el = document.createElement('div');
        el.className = `notification ${type === 'erreur' ? 'erreur' : ''}`;
        el.textContent = message;
        zone.appendChild(el);
        setTimeout(() => { el.classList.add('sort'); setTimeout(() => el.remove(), 400); }, 3600);
    }

    /* Indique à la vendeuse comment ses réponses partiront. */
    $$('[data-voie]').forEach((el) => {
        const configure = el.dataset.voie === 'prix' ? formulairePrix : formulaireAnnonce;
        el.textContent = configure ? 'Mis en ligne automatiquement en quelques minutes.' : "Votre message part sur WhatsApp, l'équipe le met en ligne.";
    });
})();
