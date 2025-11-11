# ProPresent - Presentazione Modulare

Questo progetto è una presentazione moderna con scroll orizzontale, costruita con React e Tailwind CSS.

## Struttura del Progetto

```
src/
├── components/
│   ├── Section.js              # Componente per le singole sezioni
│   ├── TitleDisplay.js         # Gestisce la visualizzazione dei titoli con transizioni
│   ├── NavigationDots.js       # Indicatori di navigazione (pallini)
│   └── NavigationArrows.js     # Frecce di navigazione laterali
├── data/
│   └── sectionsData.js         # Dati delle sezioni
├── App.js                      # Componente principale
├── index.js                    # Entry point
└── index.css                   # Stili globali con Tailwind

public/
└── index.html                  # HTML template
```

## Caratteristiche

- ✨ **Architettura Modulare**: Codice ben organizzato in componenti riutilizzabili
- 🎨 **Design Moderno**: Gradienti animati e transizioni fluide
- 📱 **Scroll Orizzontale**: Navigazione intuitiva tra le sezioni
- 🎯 **Transizioni Titoli**: I titoli si animano e cambiano posizione durante lo scroll
- ⚡ **Performance Ottimizzate**: React hooks e gestione efficiente dello stato

## Componenti

### Section.js
Gestisce la visualizzazione di una singola sezione con il suo contenuto.

### TitleDisplay.js
Mostra il titolo corrente (a sinistra, colorato) e il prossimo titolo (a destra, opaco).
Durante lo scroll, il prossimo titolo si sposta a sinistra e si colora.

### NavigationDots.js
Indicatori visivi nella parte bassa dello schermo per mostrare la sezione attiva.

### NavigationArrows.js
Frecce laterali per navigare tra le sezioni.

## Scripts Disponibili

### `npm start`
Avvia l'app in modalità development su [http://localhost:3000](http://localhost:3000)

### `npm run build`
Crea una build di produzione nella cartella `build`

## Personalizzazione

Per modificare le sezioni, edita il file `src/data/sectionsData.js`:

```javascript
export const sectionsData = [
  {
    id: 0,
    title: 'Il tuo titolo',
    subtitle: 'Il tuo sottotitolo',
    gradient: 'from-purple-600 via-pink-600 to-red-600'
  },
  // Aggiungi altre sezioni...
];
```