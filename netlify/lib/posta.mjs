/* =============================================================
   MONACI SHAOLIN — invio delle mail
   -------------------------------------------------------------
   Le mail partono dal server, non dal browser: cosi arrivano anche
   se chi si registra chiude la scheda un istante dopo aver premuto
   invio, e cosi la chiave privata di EmailJS non finisce dentro una
   pagina che chiunque puo leggere.

   Variabili su Netlify:
     EMAILJS_SERVICE_ID   EMAILJS_PUBLIC_KEY   EMAILJS_PRIVATE_KEY
     EMAILJS_TEMPLATE_ID              nuove richieste di accesso
     EMAILJS_TEMPLATE_CONVOCAZIONI    riepilogo delle 20:00

   Serve anche spuntare, in EmailJS > Account > Security, l'opzione
   che consente le chiamate API fuori dal browser.

   Se le variabili non ci sono si tace e si prosegue: una mail non
   spedita non deve far fallire una registrazione gia riuscita ne
   cancellare le presenze gia raccolte.
   ============================================================= */

export function postaConfigurata() {
  const { EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY } = process.env;
  return !!(EMAILJS_SERVICE_ID && EMAILJS_PUBLIC_KEY && EMAILJS_PRIVATE_KEY);
}

export async function mandaMail(modello, parametri) {
  const { EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY } = process.env;
  if (!modello || !postaConfigurata()) return false;

  try {
    const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        service_id:  EMAILJS_SERVICE_ID,
        template_id: modello,
        user_id:     EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: parametri
      })
    });
    if (!r.ok) console.error('posta: EmailJS ha risposto', r.status, await r.text().catch(() => ''));
    return r.ok;
  } catch (e) {
    console.error('posta: invio non riuscito', e && e.message);
    return false;
  }
}
