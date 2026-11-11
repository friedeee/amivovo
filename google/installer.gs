/**
 * Amì vɔ̀vɔ̀ : crée automatiquement dans votre compte Google
 *   - le formulaire « Prix du jour »,
 *   - le formulaire « Annonce »,
 *   - le tableau (Google Sheet) qui reçoit les réponses,
 * puis affiche les 4 liens à mettre dans js/reglages.js.
 *
 * À coller dans script.google.com, puis bouton « Exécuter ». À faire une seule fois.
 */
function installerAmivovo() {
  const tableau = SpreadsheetApp.create('Amì vɔ̀vɔ̀ - données');
  tableau.setSpreadsheetLocale('fr_FR');
  tableau.setSpreadsheetTimeZone('Africa/Porto-Novo');

  const formPrix = creerFormulaire(
    'Amì vɔ̀vɔ̀ - Prix du jour',
    "Le prix de l'huile rouge dans votre marché aujourd'hui.",
    [['Marché', 'marche'], ['Mesure', 'mesure'], ['Prix', 'prix'], ['Téléphone', 'telephone']]
  );
  const formAnnonce = creerFormulaire(
    'Amì vɔ̀vɔ̀ - Annonce',
    "Votre stock d'huile rouge, visible sur le site avec votre numéro WhatsApp.",
    [['Vendeuse', 'vendeuse'], ['Téléphone', 'telephone'], ['Marché', 'marche'], ['Quantité', 'quantite'],
     ['Mesure', 'mesure'], ['Prix', 'prix'], ['Note', 'note'], ['Disponible', 'disponible']]
  );

  formPrix.formulaire.setDestination(FormApp.DestinationType.SPREADSHEET, tableau.getId());
  formAnnonce.formulaire.setDestination(FormApp.DestinationType.SPREADSHEET, tableau.getId());
  SpreadsheetApp.flush();
  Utilities.sleep(3000);

  /* Les onglets de réponses : on les renomme « prix » et « annonces » et on ajoute la colonne « masquer ». */
  const ongletPrix = ongletDe(tableau, formPrix.formulaire);
  const ongletAnnonces = ongletDe(tableau, formAnnonce.formulaire);
  ongletPrix.setName('prix');
  ongletAnnonces.setName('annonces');
  [ongletPrix, ongletAnnonces].forEach(function (onglet) {
    if (onglet.getLastColumn() > 1) onglet.getRange(1, onglet.getLastColumn() + 1).setValue('masquer');
    onglet.setFrozenRows(1);
  });
  tableau.getSheets().forEach(function (onglet) {
    if (onglet.getName() !== 'prix' && onglet.getName() !== 'annonces' && tableau.getSheets().length > 2) {
      tableau.deleteSheet(onglet);
    }
  });

  const csv = function (onglet) {
    return 'https://docs.google.com/spreadsheets/d/' + tableau.getId() + '/pub?gid=' + onglet.getSheetId() + '&single=true&output=csv';
  };

  const liens = [
    ['formulairePrix', formPrix.lienPrerempli],
    ['formulaireAnnonce', formAnnonce.lienPrerempli],
    ['prixCsv', csv(ongletPrix)],
    ['annoncesCsv', csv(ongletAnnonces)],
  ];

  /* Les liens sont aussi écrits dans un onglet « liens » du tableau, pour les retrouver plus tard. */
  const ongletLiens = tableau.insertSheet('liens');
  ongletLiens.getRange(1, 1, liens.length + 1, 2).setValues([['réglage', 'lien']].concat(liens));
  ongletLiens.autoResizeColumn(1);

  Logger.log('C\'EST FAIT. Copiez tout ce qui suit et envoyez-le à Claude :');
  Logger.log('-----');
  liens.forEach(function (l) { Logger.log(l[0] + ": '" + l[1] + "',"); });
  Logger.log('-----');
  Logger.log('Tableau : ' + tableau.getUrl());
  Logger.log('Formulaire prix (à modifier) : ' + formPrix.formulaire.getEditUrl());
  Logger.log('Formulaire annonce (à modifier) : ' + formAnnonce.formulaire.getEditUrl());
  Logger.log('DERNIÈRE ÉTAPE : ouvrez le tableau, menu Fichier > Partager > Publier sur le Web, puis cliquez sur Publier.');
}

/** Crée un formulaire avec des questions « réponse courte » et renvoie aussi son lien prérempli avec les mots-clés. */
function creerFormulaire(titre, description, questions) {
  const formulaire = FormApp.create(titre);
  formulaire.setDescription(description);
  formulaire.setCollectEmail(false);
  formulaire.setLimitOneResponsePerUser(false);
  formulaire.setAllowResponseEdits(false);
  formulaire.setShowLinkToRespondAgain(true);
  formulaire.setConfirmationMessage('Merci ! Votre réponse apparaîtra sur Amì vɔ̀vɔ̀ dans quelques minutes.');
  try { formulaire.setRequireLogin(false); } catch (e) { /* réglage réservé à certains comptes */ }
  try { formulaire.setPublished(true); } catch (e) { /* ancienne version de Google Forms : déjà publié */ }
  formulaire.setAcceptingResponses(true);

  const reponse = formulaire.createResponse();
  questions.forEach(function (q) {
    const element = formulaire.addTextItem().setTitle(q[0]);
    reponse.withItemResponse(element.createResponse(q[1]));
  });
  return { formulaire: formulaire, lienPrerempli: reponse.toPrefilledUrl() };
}

function ongletDe(tableau, formulaire) {
  const onglet = tableau.getSheets().filter(function (o) {
    const lie = o.getFormUrl();
    return lie && lie.indexOf(formulaire.getId()) !== -1;
  })[0];
  if (!onglet) throw new Error('Onglet de réponses introuvable pour ' + formulaire.getTitle());
  return onglet;
}
