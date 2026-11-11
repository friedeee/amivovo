/*
 * Amì vɔ̀vɔ̀ : garde le site dans le téléphone pour qu'il s'ouvre même sans Internet.
 * Pages et scripts : on essaie Internet d'abord (pour avoir la dernière version), sinon la copie gardée.
 * Photos, polices et carte : la copie gardée d'abord (elles ne changent pas).
 * Changer VERSION après une grosse mise à jour pour repartir de zéro.
 */
const VERSION = 'amivovo-v3';
const COQUILLE = [
    './', 'index.html', 'prix.html', 'annonces.html', 'marches.html', 'conseils.html', 'outils.html',
    'cahier.html', 'vendre.html', 'vendeuse.html', 'credits.html', 'bulletin.html', 'partenaires.html',
    'css/style.css', 'js/reglages.js', 'js/photos.js', 'js/donnees.js', 'js/main.js', 'js/pwa.js',
    'js/cahier.js', 'js/carte.js', 'js/outils.js', 'js/vendre.js', 'js/vendeuse.js', 'js/bulletin.js',
    'images/logo.svg', 'images/favicon.svg', 'images/icone-192.png', 'manifest.webmanifest',
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys()
        .then((cles) => Promise.all(cles.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
        .then(() => self.clients.claim()));
});

/** Internet d'abord, avec un délai : sur un réseau très lent, on sert la copie au bout de 4 secondes. */
async function internetDabord(requete) {
    const cache = await caches.open(VERSION);
    const reseau = fetch(requete).then((reponse) => {
        if (reponse.ok) cache.put(requete, reponse.clone());
        return reponse;
    });
    const copie = await cache.match(requete, { ignoreSearch: requete.mode === 'navigate' });
    if (!copie) {
        try { return await reseau; }
        catch (e) { return (await cache.match('index.html')) || Response.error(); }
    }
    const delai = new Promise((resoudre) => setTimeout(() => resoudre(copie), 4000));
    return Promise.race([reseau.catch(() => copie), delai]);
}

async function copieDabord(requete) {
    const cache = await caches.open(VERSION);
    const copie = await cache.match(requete);
    if (copie) return copie;
    const reponse = await fetch(requete);
    if (reponse.ok || reponse.type === 'opaque') cache.put(requete, reponse.clone());
    return reponse;
}

self.addEventListener('fetch', (e) => {
    const requete = e.request;
    if (requete.method !== 'GET') return;
    const url = new URL(requete.url);
    /* Les prix de Google Sheets sont gérés par le site lui-même (copie dans le téléphone). */
    if (url.hostname.endsWith('google.com') || url.hostname.endsWith('googleusercontent.com')) return;
    if (url.origin === self.location.origin) {
        e.respondWith(url.pathname.includes('/images/photos/') ? copieDabord(requete) : internetDabord(requete));
        return;
    }
    if (/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|tile\.openstreetmap\.org/.test(url.hostname)) {
        e.respondWith(copieDabord(requete).catch(() => Response.error()));
    }
});

self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    e.waitUntil(self.clients.matchAll({ type: 'window' }).then((fenetres) => {
        const ouverte = fenetres.find((f) => 'focus' in f);
        return ouverte ? ouverte.focus() : self.clients.openWindow('annonces.html');
    }));
});
