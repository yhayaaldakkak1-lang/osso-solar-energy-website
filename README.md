# Osso Solar Energy

Die Website von Osso Solar Energy: eine scroll-gesteuerte Startseite, gebaut aus
echten Projektfotos, plus Impressum und Datenschutz.

Reines HTML, CSS und JavaScript. Kein Build-Schritt, keine Abhängigkeiten.

## Vorschau

Die Seite braucht einen einfachen lokalen Server, weil Browser das Nachladen
von Dateien über `file://` blockieren:

```bash
npx http-server .
```

oder

```bash
python -m http.server
```

Dann `index.html` im Browser öffnen.

## Struktur

- `index.html` — die Seite
- `impressum.html`, `datenschutz.html` — Pflichtseiten
- `assets/` — Bilder, Schriften, `site.css`, `site.js`

## Live

Die Seite läuft unter [osso-solar-energy.de](https://osso-solar-energy.de).
