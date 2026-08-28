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

/* Ritorna { ok, stato, messaggio }, non un si/no.

   Il motivo: EmailJS, quando rifiuta, SPIEGA perche — "API calls are
   disabled for non-browser applications", "The Public Key is invalid",
   "The recipients address is empty". Quella frase e la diagnosi gia
   pronta, e ridurla a un booleano vuol dire buttarla e poi indovinare.
   Chi chiama e libero di ignorare il risultato, e gli invii in massa
   lo fanno; ma il bottone di prova la mostra all'amministratore, e li
   una frase precisa vale un'ora di tentativi. */

export async function mandaMail(modello, parametri) {
  const { EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY } = process.env;

  if (!modello) return { ok: false, stato: 0, messaggio: 'manca EMAILJS_TEMPLATE_CONVOCAZIONI' };
  if (!postaConfigurata()) return { ok: false, stato: 0, messaggio: 'chiavi EmailJS non configurate' };

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

    const testo = await r.text().catch(() => '');
    if (!r.ok) console.error('posta: EmailJS ha risposto', r.status, testo);
    return { ok: r.ok, stato: r.status, messaggio: testo.trim().slice(0, 300) };
  } catch (e) {
    const messaggio = (e && e.message) || 'connessione non riuscita';
    console.error('posta: invio non riuscito', messaggio);
    return { ok: false, stato: 0, messaggio };
  }
}
