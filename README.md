# Fanflock Tijd — Trello Power-Up voor tijdregistratie

Start/stop-timer en handmatige uren per kaart, budget per kaart en een urenoverzicht per board met export naar Google Sheets.
Geen server, geen database: alle data staat in Trello zelf (pluginData op de kaart).

## Wat het doet

| Waar | Wat |
|---|---|
| **Knop "Tijd"** op de kaart | Timer starten/stoppen (per persoon, dus meerdere mensen tegelijk op één kaart kan), uren handmatig toevoegen (`1:30`, `1,5`, `1u30`, `45m`), notitie, budget in uren, eigen regels verwijderen |
| **Badge** voorkant kaart | `▶ 1:12 / 16:00`, groen = timer loopt, geel = 80% van budget, rood = over budget |
| **Sectie** achterkant kaart | Totaal, budgetbalk, uren per persoon, wie er nu aan werkt |
| **Knop "Urenoverzicht"** op het board | Filter op periode / medewerker / lijst. Per kaart, per medewerker, lopende timers, alle regels. Kopiëren voor Google Sheets of CSV downloaden |
| **Instellingen** (Power-Up-menu) | Uurtarief, dan toont het overzicht ook bedragen |

## Installeren (± 15 minuten)

### 1. Hosten op GitHub Pages (gratis, HTTPS)
1. Maak een repo, bijv. `fanflock-tijd`, en zet alle bestanden in de root.
2. Ga naar **Settings → Pages**, kies Source: `main` / `root`.
3. Na een minuut staat het op `https://<github-naam>.github.io/fanflock-tijd/`.
   Controleer dat `…/index.html` en `…/icon.svg` openen.

(Netlify of Vercel werkt ook, de bestanden zijn puur statisch.)

### 2. Power-Up aanmaken in Trello
1. Ga naar **https://trello.com/power-ups/admin** en klik op **New**.
2. Workspace: de Fanflock-workspace. Naam: *Fanflock Tijd*.
3. **Iframe connector URL**: `https://<github-naam>.github.io/fanflock-tijd/index.html`
4. Tab **Capabilities**, zet deze aan:
   `board-buttons`, `card-badges`, `card-buttons`, `card-detail-badges`, `card-back-section`, `show-settings`
5. Opslaan.

### 3. Aanzetten op het board
Board **fanflock-projecten** → **Power-Ups** → **Custom** → *Fanflock Tijd* → **Add**.
Daarna via het Power-Up-menu → Instellingen het uurtarief invullen.

## Goed om te weten

- **Opslaglimiet:** Trello geeft een Power-Up max. 4096 tekens per kaart. Dat is ruim 90 regels per kaart (met korte notities).
  Vanaf 80% zie je een waarschuwing in de popup. Voor lange doorlopende kaarten maak je dan een vervolgkaart.
  Als jullie dit gaan ontgroeien, is de volgende stap een koppeling met Google Sheets als opslag.
- **Gearchiveerde kaarten** tellen niet mee in het urenoverzicht. Exporteer de uren dus vóór het archiveren naar de Worksheet.
- **Zichtbaarheid:** iedereen die het board kan zien, kan de uren zien. Je kunt alleen je eigen regels verwijderen.
- **Gelijktijdig bewerken:** de app leest en schrijft direct na elkaar. Als twee mensen op exact hetzelfde moment iets opslaan op dezelfde kaart, kan er één wijziging verloren gaan. Bij een team van 5 gebeurt dat zelden.
- **Vergeten timer?** Stop hem, verwijder de regel en voeg de echte tijd handmatig toe. Lopende timers zie je bovenaan in het urenoverzicht.
- **Export:** "Kopieer voor Google Sheets" zet tab-gescheiden regels op je klembord (plakken in de Worksheet). De CSV gebruikt `;` en decimale komma's, dus die opent direct goed in Nederlandse Excel.

## Bestanden

```
index.html      connector die Trello laadt
client.js       knoppen, badges, sectie, instellingen
shared.js       datamodel + helpers (duur parsen, totalen, periodes)
card.html/.js   popup op de kaart
section.html    sectie op de achterkant van de kaart
report.html/.js urenoverzicht (modal)
settings.html   uurtarief
style.css, icon.svg, icon-white.svg
```

## Ideeën voor versie 2
- Uren automatisch naar de project-Worksheet in Google Drive schrijven
- Rolgebaseerde tarieven (per medewerker) naast het bureautarief
- Weekoverzicht per medewerker tegenover beschikbare uren (capaciteit)
- Reminder bij een timer die al langer dan 8 uur loopt
