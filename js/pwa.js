/*
 * Amì vɔ̀vɔ̀ : installation comme une application sur le téléphone.
 * Le « service worker » (sw.js) garde les pages dans le téléphone pour qu'elles s'ouvrent sans Internet.
 */
(function () {
    'use strict';

    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
        window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* pas grave : le site marche sans */ }));
    }

    const estInstallee = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const estIphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
    let invitation = null;

    function etat() {
        document.querySelectorAll('[data-installee]').forEach((el) => { el.hidden = !estInstallee; });
        document.querySelectorAll('[data-pas-installee]').forEach((el) => { el.hidden = estInstallee; });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        invitation = e;
    });
    window.addEventListener('appinstalled', () => {
        invitation = null;
        document.querySelectorAll('[data-pas-installee]').forEach((el) => { el.hidden = true; });
        document.querySelectorAll('[data-installee]').forEach((el) => { el.hidden = false; });
    });

    document.addEventListener('click', async (e) => {
        const bouton = e.target.closest('[data-installer]');
        if (!bouton) return;
        if (invitation) {
            invitation.prompt();
            await invitation.userChoice;
            invitation = null;
            return;
        }
        /* Pas d'installation automatique (iPhone, ou navigateur qui ne la propose pas) : on explique comment faire. */
        const aide = document.querySelector('[data-installer-aide]');
        if (!aide) return;
        aide.querySelector('[data-aide-iphone]').hidden = !estIphone;
        aide.querySelector('[data-aide-android]').hidden = estIphone;
        aide.hidden = false;
        aide.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    etat();
})();
