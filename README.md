# Gestore Provvigioni (Vendita Pesce)

Questo progetto personale è un'applicazione gestionale sviluppata per automatizzare e semplificare il calcolo delle provvigioni aziendali basate sul fatturato della vendita di prodotti ittici.

L'applicativo nasce dall'esigenza di gestire con precisione le differenze tra il venduto nostrano e il totale, applicando automaticamente le percentuali di provvigione e gli scorpori necessari, sostituendo così i calcoli manuali con uno strumento affidabile e immediato.

## Funzionalità Principali

- **Gestione dei Documenti di Trasporto (DDT):** Inserimento e catalogazione mensile dei dati di vendita, con calcolo automatico dell'imponibile italiano rispetto al totale.
- **Analisi e Reportistica:** Una dashboard integrata che offre grafici interattivi per confrontare in modo intuitivo l'andamento del fatturato e delle provvigioni nel corso degli anni.
- **Esportazione Multi-Formato:** Generazione rapida di report in formato PDF e file Excel (XLSX), pronti per l'archiviazione o per la condivisione amministrativa.
- **Supporto Cross-Platform:** Sviluppata nativamente come web app e convertita in applicazione mobile per Android tramite Capacitor, garantendo l'accessibilità anche da smartphone.

## Sviluppo Assistito dall'IA

La realizzazione di questo software è stata attivamente supportata ed accelerata dall'impiego dell'Intelligenza Artificiale. L'utilizzo di agenti AI ha contribuito ad ottimizzare la scrittura del codice, la strutturazione del design, la logica di esportazione dei documenti e l'integrazione del porting mobile.

## Requisiti

Per eseguire il progetto localmente, è necessario disporre di:
- Node.js (versione 18 o superiore)
- npm (o yarn)

## Installazione e Avvio

1. Installa le dipendenze necessarie:
   ```bash
   npm install
   ```
2. Avvia l'ambiente di sviluppo:
   ```bash
   npm run dev
   ```
3. Per generare la build di produzione e sincronizzare il progetto Android:
   ```bash
   npm run build:android
   ```
