# Plugga 🌍

En liten webbsida för att öva inför läxor och prov. Den första delen är geografi:
länder och huvudstäder, berg samt hav, sjöar och floder i Europa.

Sidan består bara av vanliga filer (HTML, CSS, JavaScript och JSON). Det behövs ingen
databas och inget konto. Kartan ritas från öppen kartdata och fungerar utan internet.

## Starta på iMacen

1. Lägg mappen `plugga` någonstans, t.ex. i Dokument.
2. Dubbelklicka på `starta.command`. Om macOS stoppar den första gången:
   högerklicka på filen → Öppna → Öppna.
3. Terminalfönstret visar en adress, t.ex. `http://192.168.1.23:8000`.
   Skriv den i Safari på iPaden (samma wifi). Lägg gärna till den på hemskärmen.
4. Om macOS frågar om inkommande anslutningar för Python: välj **Tillåt**.

Det fungerar med Python 2.7, som redan finns på datorn. Om Python 3 finns används det i stället.

Du kan också starta servern i Terminal:

```bash
cd ~/Documents/plugga
python3 -m http.server 8000
```

(Med bara Python 2.7: `python -m SimpleHTTPServer 8000`.)

## De tre övningarna

| Övning | Hur |
|---|---|
| 🔢 Sätt ut numren | Tryck på en ring på kartan och sedan på rätt namn i listan. |
| ✏️ Skriv namnen | Kartan har nummer. Skriv namnen. Små stavfel godkänns, men rätt stavning visas. |
| 📍 Hitta på kartan | Ett namn visas. Tryck på kartan. Rätt om man är inom 250, 120 eller 50 km (går att välja). |

Man väljer vilka grupper som ska ingå (t.ex. bara huvudstäder). Man kan också blanda
numren, så att man inte bara lär sig provpapprets nummer utantill.

## Statistik

Resultaten sparas i webbläsaren på varje enhet, en profil per barn. Statistiksidan visar
**"Behöver träna mer på"**: platser man haft fel på nyligen, sämst först, med knappar för att
öva på just dem. Inget skickas någonstans.

## Lägga till nya listor (t.ex. Asien)

1. Öppna `http://<adressen>:8000/edit.html` (länken finns längst ner på startsidan).
2. Tryck **+ Ny lista** och fyll i titel, avsnitt och grupper.
3. Zooma till rätt del av världen och tryck **Använd nuvarande kartvy som start**.
4. För varje plats: **+ Ny plats** → skriv namnet → klicka på kartan.
   För floder och bergskedjor: **Rita linje**. För hav och länder: **Rita yta**.
   (Utan form räknas avståndet till punkten i "Hitta på kartan".)
5. Tryck **Ladda ner** och lägg filen i `data/lists/`. För en ny lista: ladda också ner
   `index.json` och ersätt den i `data/lists/`.

Det går också att redigera JSON-filerna direkt, t.ex. i VS Code. Varje plats ser ut så här:

```json
{ "id": "donau", "label": "t", "name": "Donau", "aliases": ["Danube"],
  "group": "floder", "type": "river", "pos": [24.0, 43.8],
  "shape": { "type": "LineString", "coordinates": [[8.2, 48.0], [9.9, 48.4]] } }
```

`pos` är `[longitud, latitud]`. `aliases` är andra svar som också godkänns.

## Dela med klasskompisar

Det enklaste och säkraste sättet är **GitHub Pages**. Lägg projektet i ett GitHub-repo, gå till
Settings → Pages → Deploy from branch → `main` / root. Sidan får då en adress som
`https://<användarnamn>.github.io/plugga/` och fungerar direkt eftersom allt är vanliga filer.
Varje barn får sin egen statistik på sin egen enhet.

Öppna helst **inte** iMacen mot internet med portvidarebefordran. High Sierra har inte fått
säkerhetsuppdateringar sedan 2020.

## Mappar

```
index.html          själva sidan
edit.html           redigeringssidan
js/                 app.js (övningar, statistik), map.js (kartan), common.js, editor.js
css/style.css
data/lists/         listorna (en JSON-fil per lista) + index.json
data/base/world.json  grundkartan (länder, sjöar, floder, bergsområden)
vendor/d3.min.js    kartbibliotek (d3, ISC-licens)
tools/              Python-skript som byggde kartdatan (behövs inte i vardagen)
```

Kartdata: [Natural Earth](https://www.naturalearthdata.com/) (public domain).
