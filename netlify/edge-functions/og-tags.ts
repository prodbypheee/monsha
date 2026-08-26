// Inietta i tag Open Graph corretti in base al percorso richiesto.
//
// Il sito e una single page application: tutte le tab vivono dentro
// index.html e vengono mostrate da JavaScript. I crawler dei social non
// eseguono JavaScript, quindi senza questa funzione ogni URL condiviso
// mostrerebbe la stessa anteprima. Qui il percorso viene letto lato server
// e i metadati vengono riscritti prima che la pagina parta.
//
// La sorgente resta una sola: index.html. Nessuna pagina duplicata.

const SITO = "https://monacishaolin.it";

type Meta = {
  tab: string;
  titolo: string;
  descrizione: string;
  immagine: string;
};

const PAGINE: Record<string, Meta> = {
  "/": {
    tab: "home",
    titolo: "Monaci Shaolin — eSports Club",
    descrizione:
      "Il tempio del calcio virtuale. Disciplina, tecnica e fame di vittoria: scopri il club, la rosa e l'albo d'oro dei Monaci Shaolin.",
    immagine: "/immagini/sfondo.jpeg",
  },
  "/noi": {
    tab: "noi",
    titolo: "La nostra squadra — Monaci Shaolin",
    descrizione:
      "Uniti verso la vittoria. Portieri, difensori, centrocampisti e attaccanti: tutti i guerrieri che compongono la rosa dei Monaci Shaolin.",
    immagine: "/immagini/og-noi.jpeg",
  },
  "/unisciti-a-noi": {
    tab: "unisciti",
    titolo: "Unisciti a noi — Monaci Shaolin",
    descrizione:
      "Il tempio cerca nuovi guerrieri. Candidati per entrare nei Monaci Shaolin e scendere in campo con noi.",
    immagine: "/immagini/og-unisciti-a-noi.jpeg",
  },
  "/albo-doro": {
    tab: "trofei",
    titolo: "Albo d'Oro — Monaci Shaolin",
    descrizione:
      "Trofei, titoli e leggende. Tutto quello che i Monaci Shaolin hanno conquistato sul campo.",
    immagine: "/immagini/og-albo-doro.jpeg",
  },
};

// alias senza trattini, stesso contenuto
PAGINE["/uniscitianoi"] = PAGINE["/unisciti-a-noi"];
PAGINE["/albodoro"] = PAGINE["/albo-doro"];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tags(meta: Meta, url: string): string {
  const t = escapeHtml(meta.titolo);
  const d = escapeHtml(meta.descrizione);
  const img = SITO + meta.immagine;

  return `
  <meta name="description" content="${d}" />
  <link rel="canonical" href="${url}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Monaci Shaolin" />
  <meta property="og:locale" content="it_IT" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />

  <script>window.__TAB_INIZIALE__ = ${JSON.stringify(meta.tab)};</script>
`;
}

export default async function handler(request: Request, context: any) {
  const url = new URL(request.url);
  // normalizza: niente slash finale, tutto minuscolo
  let percorso = url.pathname.toLowerCase().replace(/\/+$/, "");
  if (percorso === "") percorso = "/";

  const meta = PAGINE[percorso];
  if (!meta) return context.next();

  const risposta = await context.next();
  const tipo = risposta.headers.get("content-type") || "";
  if (!tipo.includes("text/html")) return risposta;

  const html = await risposta.text();

  // il titolo esistente viene sostituito, i meta nuovi inseriti nel head
  const conTitolo = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(meta.titolo)}</title>`,
  );
  const finale = conTitolo.replace(
    /<\/head>/i,
    `${tags(meta, SITO + (percorso === "/" ? "/" : percorso))}\n</head>`,
  );

  return new Response(finale, {
    status: risposta.status,
    headers: risposta.headers,
  });
}
