/*
 * Amì vɔ̀vɔ̀ : bulletin des prix (page bulletin.html).
 * Le bulletin est fabriqué à partir des prix du site, prêt à coller dans WhatsApp.
 * Visiteurs : un aperçu de la version gratuite. Équipe (bulletin.html?equipe) : la version complète, avec bouton « Copier ».
 * Les inscriptions partent en message WhatsApp vers l'équipe.
 */
(function () {
    'use strict';

    const A = window.Amivovo;
    const { $, echapper } = A.ui;
    const equipe = new URLSearchParams(window.location.search).has('equipe');
    const SITE = window.location.protocol === 'https:' ? window.location.origin : 'https://amivovo.vercel.app';

    const tendance = (v) => (v > 0.01 ? `en hausse de ${A.pourcent(v).replace('+', '')}` : v < -0.01 ? `en baisse de ${A.pourcent(v).replace('-', '')}` : 'stable');

    /** Version gratuite : prix moyen du litre et du bidon de 25 L, et le marché le moins cher. */
    function bulletinGratuit(resumes) {
        const lignes = [`*Amì vɔ̀vɔ̀ · Prix de l'huile rouge*`, `Semaine du ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`, ''];
        ['Litre', 'Bidon 25 L'].forEach((mesure) => {
            const liste = resumes.filter((r) => r.mesure === mesure);
            if (!liste.length) return;
            const ref = A.prixReference(resumes, mesure);
            const variation = A.mediane(liste.map((r) => r.variation * 1000)) / 1000;
            const moinsCher = [...liste].sort((a, b) => a.prix - b.prix)[0];
            lignes.push(`*${mesure}* : ${A.fcfa(ref)} en moyenne, ${tendance(variation)} sur 7 jours.`);
            lignes.push(`Le moins cher : ${moinsCher.marche}, ${A.fcfa(moinsCher.prix)}.`, '');
        });
        if (lignes.length === 3) lignes.push('Pas encore assez de prix relevés cette semaine.', '');
        lignes.push(`Tous les prix : ${SITE}/prix.html`);
        return lignes.join('\n');
    }

    /** Version complète (abonnés) : chaque mesure, chaque marché, et les annonces les moins chères. */
    function bulletinComplet(resumes, annonces) {
        const lignes = [`*Amì vɔ̀vɔ̀ · Bulletin des prix (abonnés)*`, `Semaine du ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`, ''];
        A.trierMesures([...new Set(resumes.map((r) => r.mesure))]).forEach((mesure) => {
            const liste = resumes.filter((r) => r.mesure === mesure).sort((a, b) => a.prix - b.prix);
            lignes.push(`*${mesure}* (moyenne ${A.fcfa(A.prixReference(resumes, mesure))})`);
            liste.forEach((r) => lignes.push(`- ${r.marche} : ${A.fcfa(r.prix)}, ${tendance(r.variation)}`));
            lignes.push('');
        });
        const hausses = resumes.filter((r) => r.variation > 0.08);
        if (hausses.length) {
            lignes.push('*Attention, forte hausse*');
            hausses.forEach((r) => lignes.push(`- ${r.marche}, ${r.mesure} : ${A.pourcent(r.variation)} en 7 jours`));
            lignes.push('');
        }
        const meilleures = annonces.filter((a) => a.disponible)
            .sort((a, b) => a.prix / (A.MESURES[a.mesure] || 1) - b.prix / (A.MESURES[b.mesure] || 1)).slice(0, 3);
        if (meilleures.length) {
            lignes.push('*Les annonces les moins chères*');
            meilleures.forEach((a) => lignes.push(`- ${a.vendeuse} (${a.marche}) : ${a.quantite} × ${a.mesure} à ${A.fcfa(a.prix)}`));
            lignes.push(`Toutes les annonces : ${SITE}/annonces.html`, '');
        }
        lignes.push('Prix en francs CFA, donnés à titre indicatif.');
        return lignes.join('\n');
    }

    /** Affiche le texte WhatsApp comme dans une bulle de discussion (gras entre astérisques). */
    const enBulle = (texte) => echapper(texte).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

    A.pret.then((donnees) => {
        if (!donnees) return;
        const { resumes, annonces } = donnees;
        const texte = equipe ? bulletinComplet(resumes, annonces ? annonces.annonces : []) : bulletinGratuit(resumes);
        $('#apercu-bulletin').innerHTML = enBulle(texte);
        $('#apercu-heure').textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        if (equipe) {
            $('#outils-equipe').hidden = false;
            $('#titre-apercu').textContent = 'Bulletin complet de la semaine (équipe)';
            $('#copier-bulletin').addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(texte);
                    $('#copier-bulletin').textContent = 'Copié ! Collez-le dans WhatsApp';
                } catch (e) {
                    $('#copier-bulletin').textContent = 'Copie impossible : sélectionnez le texte à la main';
                }
            });
            $('#partager-bulletin').href = `https://wa.me/?text=${encodeURIComponent(texte)}`;
        }
    });

    /* Inscription : message WhatsApp déjà rédigé pour l'équipe. */
    $('#form-bulletin').addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (!form.reportValidity()) return;
        const v = Object.fromEntries(new FormData(form).entries());
        const message = [
            "Bonjour Amì vɔ̀vɔ̀ ! Je veux m'abonner au bulletin des prix.",
            `Formule : ${v.formule}`,
            `Nom : ${v.nom}`,
            `Activité : ${v.activite}`,
            v.marches ? `Marchés qui m'intéressent : ${v.marches}` : '',
        ].filter(Boolean).join('\n');
        window.open(A.lienWhatsapp(A.REGLAGES.whatsapp, message), '_blank', 'noopener');
        $('#merci-bulletin').hidden = false;
    });
    document.querySelectorAll('[data-choisir-formule]').forEach((bouton) => bouton.addEventListener('click', () => {
        $('#form-bulletin [name="formule"]').value = bouton.dataset.choisirFormule;
        $('#inscription').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
})();
