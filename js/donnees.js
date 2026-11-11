/*
 * Amì vɔ̀vɔ̀ : chargement des prix et des annonces, puis calculs (prix du jour, tendances).
 * Les données viennent des onglets Google Sheets publiés en CSV (voir reglages.js) :
 * soit remplis à la main, soit alimentés par les formulaires Google des vendeuses.
 * Sans lien configuré, on utilise des données d'exemple fictives.
 */
(function () {
    'use strict';

    const REGLAGES = window.AMIVOVO_REGLAGES || {};

    /** Mesures connues et leur volume en litres, pour comparer les prix entre elles. */
    const MESURES = {
        'Litre': 1,
        'Bouteille 1,5 L': 1.5,
        'Bidon 5 L': 5,
        'Bidon 25 L': 25,
    };
    const ORDRE_MESURES = Object.keys(MESURES);

    /**
     * Position des marchés et des villes (latitude, longitude), pour la carte.
     * Le nom du marché est reconnu s'il contient un de ces mots. Positions approximatives :
     * on peut les corriger ou en ajouter dans reglages.js (rubrique « marches »).
     */
    const LIEUX = [
        ['dantokpa', 6.3725, 2.4336], ['akpakpa', 6.3550, 2.4520], ['godomey', 6.3920, 2.3440], ['cadjehoun', 6.3590, 2.3880], ['cotonou', 6.3654, 2.4183], ['ouando', 6.5030, 2.6180],
        ['porto-novo', 6.4969, 2.6289], ['pobe', 6.9800, 2.6650], ['bohicon', 7.1780, 2.0670],
        ['azove', 6.9800, 1.7100], ['ouidah', 6.3630, 2.0850], ['calavi', 6.4485, 2.3557],
        ['lokossa', 6.6390, 1.7170], ['ketou', 7.3580, 2.6050], ['sakete', 6.7360, 2.6580],
        ['allada', 6.6650, 2.1510], ['abomey', 7.1830, 1.9910], ['come', 6.4000, 1.8830],
        ['adjohoun', 6.7100, 2.4800], ['ifangni', 6.6500, 2.7200], ['avrankou', 6.5500, 2.6600],
        ['aplahoue', 6.9330, 1.6830], ['dogbo', 6.8000, 1.7830], ['grand-popo', 6.2800, 1.8230],
        ['zogbodomey', 7.0830, 2.1000], ['covè', 7.2200, 2.3400], ['cove', 7.2200, 2.3400],
        ['dassa', 7.7500, 2.1830], ['savalou', 7.9280, 1.9750], ['parakou', 9.3370, 2.6280],
        ['djougou', 9.7080, 1.6660], ['natitingou', 10.3040, 1.3790], ['kandi', 11.1340, 2.9380],
    ];

    /* ---------- Outils ---------- */

    const normaliser = (texte) => String(texte ?? '').trim();

    /** « Marché du jour » → « marche_du_jour » : sert aux en-têtes du tableau et aux champs des formulaires. */
    const normaliserCle = (texte) => normaliser(texte).toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');

    /** Accepte « 2026-11-09 », « 09/11/2026 », avec ou sans heure (« 09/11/2026 14:32:05 » des formulaires). */
    function lireDate(valeur) {
        const texte = normaliser(valeur);
        let match = texte.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
        if (match) return new Date(+match[1], +match[2] - 1, +match[3], +(match[4] || 0), +(match[5] || 0));
        match = texte.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
        if (match) return new Date(+match[3], +match[2] - 1, +match[1], +(match[4] || 0), +(match[5] || 0));
        return null;
    }

    /** « 18 000 », « 18000 F », « 18.000 » → 18000. */
    const lireNombre = (valeur) => {
        const chiffres = normaliser(valeur).replace(/[^\d,]/g, '').replace(',', '.');
        return chiffres ? Number(chiffres) : NaN;
    };

    /** Ramène les façons d'écrire une mesure (« bidon 25 », « 25L », « litre ») aux mesures connues. */
    function normaliserMesure(valeur) {
        const texte = normaliser(valeur);
        if (MESURES[texte]) return texte;
        const t = texte.toLowerCase().replace(/\s+/g, ' ');
        if (/25/.test(t)) return 'Bidon 25 L';
        if (/1[,.]5/.test(t)) return 'Bouteille 1,5 L';
        if (/(^|\D)5 ?l|bidon 5/.test(t)) return 'Bidon 5 L';
        if (/litre|^1 ?l$/.test(t)) return 'Litre';
        return texte;
    }

    /** Colonne « vedette » : « oui » (sans fin) ou une date de fin (« 18/11/2026 »), comprise. */
    function vedetteActive(valeur) {
        if (/^(oui|yes|o|1|x|vrai)$/i.test(normaliser(valeur))) return true;
        const fin = lireDate(valeur);
        return Boolean(fin) && debutJour(fin) >= debutJour(new Date());
    }

    const estOui = (valeur) => /^(oui|yes|o|1|x|vrai)$/i.test(normaliser(valeur));
    const telephoneNettoye = (valeur) => {
        let chiffres = normaliser(valeur).replace(/\D/g, '');
        if (chiffres.length === 10 && chiffres.startsWith('01')) chiffres = `229${chiffres}`; // numéros béninois à 10 chiffres
        if (chiffres.length === 8) chiffres = `22901${chiffres}`; // anciens numéros à 8 chiffres
        return chiffres;
    };

    const debutJour = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const cleJour = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    function mediane(valeurs) {
        const tri = [...valeurs].sort((a, b) => a - b);
        const milieu = Math.floor(tri.length / 2);
        return tri.length % 2 ? tri[milieu] : Math.round((tri[milieu - 1] + tri[milieu]) / 2);
    }

    /** Petit lecteur CSV qui gère les guillemets (Google Sheets les ajoute si besoin). */
    function lireCsv(texte) {
        const lignes = [];
        let ligne = [];
        let champ = '';
        let entreGuillemets = false;
        for (let i = 0; i < texte.length; i++) {
            const c = texte[i];
            if (entreGuillemets) {
                if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
                else if (c === '"') entreGuillemets = false;
                else champ += c;
            } else if (c === '"') entreGuillemets = true;
            else if (c === ',') { ligne.push(champ); champ = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && texte[i + 1] === '\n') i++;
                ligne.push(champ); lignes.push(ligne); ligne = []; champ = '';
            } else champ += c;
        }
        if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
        const [entetes, ...donnees] = lignes.filter((l) => l.some((v) => v.trim() !== ''));
        if (!entetes) return [];
        const cles = entetes.map(normaliserCle);
        return donnees.map((valeurs) => Object.fromEntries(cles.map((cle, i) => [cle, (valeurs[i] || '').trim()])));
    }

    /* ---------- Données d'exemple (fictives) ---------- */

    function aleatoire(graine) {
        let h = 2166136261;
        for (const c of graine) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
        return () => {
            h = Math.imul(h ^ (h >>> 15), 2246822507);
            h = Math.imul(h ^ (h >>> 13), 3266489909);
            return ((h ^= h >>> 16) >>> 0) / 4294967296;
        };
    }

    function prixExemple() {
        const marches = { 'Dantokpa (Cotonou)': 1150, 'Ouando (Porto-Novo)': 1100, 'Pobè': 980, 'Bohicon': 1050, 'Azovè': 1020, 'Kétou': 1000, 'Ouidah': 1120 };
        const coef = { 'Litre': 1, 'Bouteille 1,5 L': 1.45, 'Bidon 5 L': 4.7, 'Bidon 25 L': 22.5 };
        const lignes = [];
        const aujourdhui = debutJour(new Date());
        Object.entries(marches).forEach(([marche, base]) => {
            const hasard = aleatoire(marche);
            let niveau = base;
            for (let jour = 64; jour >= 0; jour--) {
                const date = new Date(aujourdhui);
                date.setDate(date.getDate() - jour);
                // Hausse progressive sur les 2 dernières semaines (saison sèche), avec du bruit.
                niveau += (hasard() - 0.45) * 18 + (jour < 14 ? 6 : 0);
                if (hasard() < 0.25) continue; // pas de relevé ce jour-là
                Object.entries(coef).forEach(([mesure, k]) => {
                    const prix = Math.round((niveau * k * (0.97 + hasard() * 0.06)) / 25) * 25;
                    lignes.push({ date, marche, mesure, prix });
                });
            }
        });
        return lignes;
    }

    function annoncesExemple() {
        const jour = (n) => { const d = debutJour(new Date()); d.setDate(d.getDate() - n); return d; };
        return [
            { date: jour(0), vendeuse: 'Maman Afi', marche: 'Pobè', quantite: 20, mesure: 'Bidon 25 L', prix: 23500, telephone: '22900000001', note: 'Huile bien rouge, pressée cette semaine.', disponible: true },
            { date: jour(0), vendeuse: 'Da Rosine', marche: 'Dantokpa (Cotonou)', quantite: 60, mesure: 'Litre', prix: 1150, telephone: '22900000002', note: 'Livraison possible à Cotonou.', disponible: true },
            { date: jour(1), vendeuse: 'Coopérative Sèdjè', marche: 'Azovè', quantite: 35, mesure: 'Bidon 25 L', prix: 24000, telephone: '22900000003', note: 'Vente en gros, prix à discuter à partir de 10 bidons.', disponible: true, vedette: true },
            { date: jour(1), vendeuse: 'Tanti Pélagie', marche: 'Bohicon', quantite: 40, mesure: 'Bouteille 1,5 L', prix: 1600, telephone: '22900000004', note: '', disponible: true },
            { date: jour(2), vendeuse: 'Maman Chantal', marche: 'Ouando (Porto-Novo)', quantite: 12, mesure: 'Bidon 5 L', prix: 5200, telephone: '22900000005', note: 'Bidons propres, bien fermés.', disponible: true },
            { date: jour(2), vendeuse: 'Maman Afi', marche: 'Pobè', quantite: 30, mesure: 'Bidon 5 L', prix: 4800, telephone: '22900000001', note: 'Aussi en petits bidons.', disponible: true },
            { date: jour(3), vendeuse: 'Da Bernadette', marche: 'Kétou', quantite: 8, mesure: 'Bidon 25 L', prix: 23000, telephone: '22900000006', note: 'Plus que quelques bidons.', disponible: false },
            { date: jour(4), vendeuse: 'Da Rosine', marche: 'Dantokpa (Cotonou)', quantite: 15, mesure: 'Bidon 25 L', prix: 25500, telephone: '22900000002', note: '', disponible: true },
            { date: jour(9), vendeuse: 'Maman Afi', marche: 'Pobè', quantite: 25, mesure: 'Bidon 25 L', prix: 22500, telephone: '22900000001', note: 'Huile bien rouge.', disponible: true },
            { date: jour(12), vendeuse: 'Tanti Pélagie', marche: 'Bohicon', quantite: 30, mesure: 'Bouteille 1,5 L', prix: 1500, telephone: '22900000004', note: '', disponible: true },
            { date: jour(20), vendeuse: 'Coopérative Sèdjè', marche: 'Azovè', quantite: 50, mesure: 'Bidon 25 L', prix: 22000, telephone: '22900000003', note: '', disponible: true },
        ];
    }

    /* ---------- Chargement (avec copie gardée dans le téléphone pour le mode hors ligne) ---------- */

    function lireCopie(cle) {
        try { return JSON.parse(localStorage.getItem(`amivovo-copie-${cle}`) || 'null'); }
        catch (e) { return null; }
    }

    async function telecharger(url, cle) {
        try {
            const reponse = await fetch(url, { cache: 'no-store' });
            if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
            const texte = await reponse.text();
            try { localStorage.setItem(`amivovo-copie-${cle}`, JSON.stringify({ texte, le: Date.now() })); }
            catch (e) { /* mémoire pleine : pas de copie, ce n'est pas grave */ }
            return { brutes: lireCsv(texte), horsLigne: null };
        } catch (erreur) {
            const copie = lireCopie(cle);
            if (!copie) throw erreur;
            return { brutes: lireCsv(copie.texte), horsLigne: new Date(copie.le) };
        }
    }

    const dateLigne = (l) => lireDate(l.date) || lireDate(l.horodateur) || lireDate(l.timestamp) || lireDate(l.horodatage);

    /** Écarte les prix trop éloignés (moitié ou double) du prix habituel au litre : erreur de frappe ou faux prix. */
    function ecarterAberrants(lignes) {
        const auLitre = (l) => l.prix / (MESURES[l.mesure] || 1);
        const reference = mediane(lignes.filter((l) => MESURES[l.mesure]).map(auLitre));
        if (!reference) return lignes;
        return lignes.filter((l) => !MESURES[l.mesure] || (auLitre(l) > reference * 0.5 && auLitre(l) < reference * 2));
    }

    let promessePrix = null;
    function chargerPrix() {
        if (!promessePrix) promessePrix = (async () => {
            if (!REGLAGES.prixCsv) return { lignes: prixExemple(), exemple: true, horsLigne: null };
            const { brutes, horsLigne } = await telecharger(REGLAGES.prixCsv, 'prix');
            const lignes = brutes.filter((l) => !estOui(l.masquer)).map((l) => ({
                date: dateLigne(l),
                marche: normaliser(l.marche),
                mesure: normaliserMesure(l.mesure),
                prix: lireNombre(l.prix),
            })).filter((l) => l.date && l.marche && l.mesure && l.prix > 0);
            return { lignes: ecarterAberrants(lignes), exemple: false, horsLigne };
        })();
        return promessePrix;
    }

    let promesseAnnonces = null;
    function chargerAnnonces() {
        if (!promesseAnnonces) promesseAnnonces = (async () => {
            let historique;
            let horsLigne = null;
            const exemple = !REGLAGES.annoncesCsv;
            if (exemple) historique = annoncesExemple();
            else {
                const resultat = await telecharger(REGLAGES.annoncesCsv, 'annonces');
                horsLigne = resultat.horsLigne;
                historique = resultat.brutes.filter((l) => !estOui(l.masquer)).map((l) => ({
                    date: dateLigne(l),
                    vendeuse: normaliser(l.vendeuse || l.nom),
                    marche: normaliser(l.marche),
                    quantite: lireNombre(l.quantite),
                    mesure: normaliserMesure(l.mesure),
                    prix: lireNombre(l.prix),
                    telephone: telephoneNettoye(l.telephone),
                    note: normaliser(l.note),
                    disponible: !/^(non|no|0|epuise|épuisé|non, epuise|non, épuisé)/i.test(normaliser(l.disponible)),
                    vedette: vedetteActive(l.vedette),
                })).filter((a) => a.vendeuse && a.marche && a.prix > 0);
            }
            historique.sort((a, b) => (b.date || 0) - (a.date || 0));

            /* Une vendeuse qui renvoie le formulaire remplace son annonce précédente pour la même mesure. */
            /* « En vedette » se règle pour la vendeuse : il suffit de le marquer sur une de ses lignes. */
            const idVendeuse = (a) => a.telephone || normaliserCle(a.vendeuse);
            const enVedette = new Set(historique.filter((a) => a.vedette).map(idVendeuse));
            historique.forEach((a) => { a.vedette = enVedette.has(idVendeuse(a)); });

            const vues = new Set();
            const annonces = historique.filter((a) => {
                const cle = `${a.telephone || normaliserCle(a.vendeuse)}|${a.mesure}`;
                if (vues.has(cle)) return false;
                vues.add(cle);
                return true;
            });
            return { annonces, historique, exemple, horsLigne };
        })();
        return promesseAnnonces;
    }

    /* ---------- Formulaires Google (les vendeuses mettent à jour elles-mêmes) ---------- */

    /**
     * Lit un « lien prérempli » de formulaire Google dont chaque case contient un mot-clé
     * (marche, mesure, prix…). On en déduit l'adresse d'envoi et le numéro de chaque case.
     */
    function lireFormulaire(lien) {
        if (!lien) return null;
        try {
            const url = new URL(lien);
            const champs = {};
            url.searchParams.forEach((valeur, cle) => { if (cle.startsWith('entry.')) champs[normaliserCle(valeur)] = cle; });
            if (!Object.keys(champs).length || !/docs\.google\.com$/.test(url.hostname)) return null;
            return { action: `${url.origin}${url.pathname.replace(/\/(viewform|formResponse)$/, '')}/formResponse`, champs };
        } catch (e) {
            return null;
        }
    }

    /** Envoie les réponses au formulaire Google. La réponse de Google est illisible (no-cors) : on suppose que c'est passé si le réseau répond. */
    async function envoyerFormulaire(lien, valeurs) {
        const formulaire = lireFormulaire(lien);
        if (!formulaire) throw new Error('Formulaire non configuré');
        const corps = new URLSearchParams();
        Object.entries(valeurs).forEach(([cle, valeur]) => {
            const champ = formulaire.champs[cle];
            if (champ && valeur !== undefined && valeur !== null && valeur !== '') corps.append(champ, String(valeur));
        });
        await fetch(formulaire.action, { method: 'POST', mode: 'no-cors', body: corps });
    }

    /* ---------- Calculs ---------- */

    /** Série par (marché, mesure) : une valeur par jour (médiane des relevés du jour). */
    function series(lignes) {
        const groupes = new Map();
        lignes.forEach(({ date, marche, mesure, prix }) => {
            const cle = `${marche}||${mesure}`;
            if (!groupes.has(cle)) groupes.set(cle, { marche, mesure, jours: new Map() });
            const jours = groupes.get(cle).jours;
            const k = cleJour(date);
            if (!jours.has(k)) jours.set(k, { date: debutJour(date), valeurs: [] });
            jours.get(k).valeurs.push(prix);
        });
        return [...groupes.values()].map(({ marche, mesure, jours }) => ({
            marche,
            mesure,
            points: [...jours.values()]
                .map(({ date, valeurs }) => ({ date, prix: mediane(valeurs), releves: valeurs.length }))
                .sort((a, b) => a.date - b.date),
        }));
    }

    /** Dernier prix d'une série et variation par rapport à ~7 jours avant. */
    function resume(serie) {
        const points = serie.points;
        const dernier = points[points.length - 1];
        const limite = new Date(dernier.date);
        limite.setDate(limite.getDate() - 7);
        const avant = [...points].reverse().find((p) => p.date <= limite) || points[0];
        const variation = avant && avant !== dernier ? (dernier.prix - avant.prix) / avant.prix : 0;
        return {
            ...serie,
            prix: dernier.prix,
            date: dernier.date,
            releves: dernier.releves,
            variation,
            prixLitre: MESURES[serie.mesure] ? dernier.prix / MESURES[serie.mesure] : null,
        };
    }

    /** Prix de référence d'une mesure : médiane des derniers prix de tous les marchés. */
    function prixReference(resumes, mesure) {
        const valeurs = resumes.filter((r) => r.mesure === mesure).map((r) => r.prix);
        return valeurs.length ? mediane(valeurs) : null;
    }

    function trierMesures(liste) {
        return [...liste].sort((a, b) => {
            const ia = ORDRE_MESURES.indexOf(a);
            const ib = ORDRE_MESURES.indexOf(b);
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
        });
    }

    /** Position d'un marché sur la carte, ou null si on ne le connaît pas. */
    function coordonnees(marche) {
        const n = normaliserCle(marche).replace(/_/g, '-');
        const perso = Object.entries(REGLAGES.marches || {}).find(([nom]) => normaliserCle(nom).replace(/_/g, '-') === n);
        if (perso) return perso[1];
        const lieu = LIEUX.find(([mot]) => n.includes(normaliserCle(mot)));
        return lieu ? [lieu[1], lieu[2]] : null;
    }

    /** Regroupe les annonces par vendeuse (le numéro de téléphone sert d'identité). */
    function vendeuses(historique) {
        const parNumero = new Map();
        historique.forEach((a) => {
            const id = a.telephone || normaliserCle(a.vendeuse);
            if (!parNumero.has(id)) parNumero.set(id, { id, nom: a.vendeuse, telephone: a.telephone, marches: new Set(), mesures: new Set(), annonces: [], depuis: a.date, vedette: Boolean(a.vedette) });
            const v = parNumero.get(id);
            v.annonces.push(a);
            v.marches.add(a.marche);
            v.mesures.add(a.mesure);
            if (a.date && (!v.depuis || a.date < v.depuis)) v.depuis = a.date;
        });
        return [...parNumero.values()].map((v) => ({ ...v, marches: [...v.marches], mesures: trierMesures([...v.mesures]) }));
    }

    /** Les annonces en vedette passent devant, sans changer l'ordre des autres. */
    const vedettesDabord = (liste) => [...liste].sort((a, b) => Number(Boolean(b.vedette)) - Number(Boolean(a.vedette)));

    /* ---------- Alertes de prix (gardées dans le téléphone) ---------- */

    const CLE_ALERTES = 'amivovo-alertes-v1';
    function lireAlertes() {
        try { const liste = JSON.parse(localStorage.getItem(CLE_ALERTES) || '[]'); return Array.isArray(liste) ? liste : []; }
        catch (e) { return []; }
    }
    function ecrireAlertes(liste) {
        try { localStorage.setItem(CLE_ALERTES, JSON.stringify(liste)); return true; }
        catch (e) { return false; }
    }

    /** Alertes déclenchées : le prix d'une mesure est passé sous le seuil voulu (dans un marché ou dans n'importe lequel). */
    function alertesDeclenchees(resumes) {
        return lireAlertes().map((alerte) => {
            const candidats = resumes.filter((r) => r.mesure === alerte.mesure && (!alerte.marche || r.marche === alerte.marche) && r.prix <= alerte.seuil)
                .sort((a, b) => a.prix - b.prix);
            return candidats.length ? { alerte, meilleur: candidats[0] } : null;
        }).filter(Boolean);
    }

    /* ---------- Formats ---------- */

    const fcfa = (n) => `${Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ')} F`;
    const pourcent = (v) => `${v > 0 ? '+' : ''}${(v * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
    const dateCourte = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    function ilYa(d) {
        const jours = Math.round((debutJour(new Date()) - debutJour(new Date(d))) / 86400000);
        if (jours <= 0) return "aujourd'hui";
        if (jours === 1) return 'hier';
        if (jours < 31) return `il y a ${jours} jours`;
        return `le ${new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
    }

    function lienWhatsapp(numero, message) {
        return `https://wa.me/${String(numero).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    }

    window.Amivovo = {
        REGLAGES,
        MESURES,
        chargerPrix,
        chargerAnnonces,
        lireFormulaire,
        envoyerFormulaire,
        series,
        resume,
        prixReference,
        trierMesures,
        coordonnees,
        vendeuses,
        vedettesDabord,
        lireAlertes,
        ecrireAlertes,
        alertesDeclenchees,
        telephoneNettoye,
        mediane,
        fcfa,
        pourcent,
        dateCourte,
        ilYa,
        lienWhatsapp,
    };
})();
