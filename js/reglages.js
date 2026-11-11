/*
 * ============================================================
 *  RÉGLAGES D'AMÌ VƆ̀VƆ̀ : le seul fichier à modifier
 * ============================================================
 *
 *  whatsapp
 *      Le numéro de l'équipe (format international, chiffres seulement).
 *
 *  prixCsv / annoncesCsv
 *      Les liens « Publier sur le Web » (format CSV) des feuilles Google Sheets
 *      qui reçoivent les réponses des formulaires. Tant qu'ils sont vides,
 *      le site affiche des données d'exemple (indiquées comme fictives).
 *
 *  formulairePrix / formulaireAnnonce
 *      Les « liens préremplis » des deux formulaires Google. Pour les obtenir :
 *      dans le formulaire, menu (les trois petits points) > « Obtenir le lien prérempli »,
 *      écrivez dans chaque case son mot-clé, puis « Obtenir le lien » et copiez-le ici.
 *        - Formulaire prix     : marche, mesure, prix, telephone
 *        - Formulaire annonce  : vendeuse, telephone, marche, quantite, mesure, prix, note, disponible
 *      Tant qu'ils sont vides, les vendeuses envoient leurs infos par WhatsApp.
 *
 *  marches (facultatif)
 *      Position d'un marché sur la carte, s'il n'y est pas ou s'il est mal placé :
 *      'Nom exact du marché': [latitude, longitude]  (clic droit sur Google Maps pour les copier)
 */
window.AMIVOVO_REGLAGES = {
    whatsapp: '2290197939315',
    prixCsv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSOnGWuS2OcDACfd82-bx0WffHQkeNnH1wqzosE-NiPN0qBJWKG7NqSBlHIu5Is661C3dG8c4cx8A26/pub?gid=546132382&single=true&output=csv',
    annoncesCsv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSOnGWuS2OcDACfd82-bx0WffHQkeNnH1wqzosE-NiPN0qBJWKG7NqSBlHIu5Is661C3dG8c4cx8A26/pub?gid=143141572&single=true&output=csv',
    formulairePrix: 'https://docs.google.com/forms/d/e/1FAIpQLSc1rKc13Wyng8_aCNM4unMNinSHBAZKgk1FDj_YAD-TwqYaQQ/viewform?usp=pp_url&entry.1022883378=marche&entry.1155854840=mesure&entry.997899880=prix&entry.2051738218=telephone',
    formulaireAnnonce: 'https://docs.google.com/forms/d/e/1FAIpQLSfsi_38PjYu-K6wETIiIdGY_b95YYI8HKlXooHpp07mdGAKZg/viewform?usp=pp_url&entry.1364448617=vendeuse&entry.1048815195=telephone&entry.1285873877=marche&entry.1806049930=quantite&entry.927500323=mesure&entry.128034732=prix&entry.893486937=note&entry.2099666923=disponible',
    marches: {
        // 'Marché de Houndjro (Abomey)': [7.1840, 1.9890],
    },
};
