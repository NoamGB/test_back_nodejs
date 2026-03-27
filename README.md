# Document Batch API - Node.js

API de generation asynchrone de documents PDF en batch (jusqu'a 1000 IDs), avec queue Redis/Bull, worker dedie, stockage GridFS, observabilite et benchmark.

## Fonctionnalites implementees

- Batch async via `POST /api/documents/batch` avec validation Joi
- Worker separe avec concurrence configurable (`QUEUE_CONCURRENCY`)
- Generation PDF avec `worker_threads`
- Cache de template PDF en memoire (compile une fois, reutilise)
- Upload PDF en streaming vers MongoDB GridFS
- Retry queue (`attempts: 3`, backoff exponentiel)
- Timeout generation PDF (max 5s, configurable)
- Circuit breaker pour appel externe simule (DocuSign)
- Fallback en memoire si Redis est indisponible
- Graceful shutdown (`SIGTERM`, `SIGINT`) API + worker
- Endpoints `/health`, `/metrics`, `/dashboard`
- Swagger UI (`/docs`) + spec OpenAPI
- Benchmark 1000 documents + rapport JSON + CSV + graphe PNG

## Stack

- Node.js + Express
- MongoDB + Mongoose + GridFS
- Redis + Bull
- PDFKit
- Opossum (circuit breaker)
- Prom-client (Prometheus metrics)
- Winston (logs JSON)
- Swagger UI + OpenAPI YAML

## Architecture (process)

1. Le client appelle `POST /api/documents/batch` avec une liste de `userIds`.
2. L'API valide le payload (Joi), cree le batch et les documents en base.
3. Les jobs sont pousses dans Bull (Redis). Si Redis down: fallback en memoire.
4. Le worker consomme les jobs en parallele.
5. Le worker appelle le service externe simule (DocuSign) via circuit breaker.
6. Les donnees PDF sont preparees via worker thread.
7. Le PDF est genere puis stream vers GridFS (sans charger le fichier complet en RAM app).
8. Les statuts documents/batch sont mis a jour (`pending` -> `processing` -> `completed`/`failed`).
9. Le client suit la progression via endpoints batch/document.

## Arborescence utile

- `server.js`: bootstrap API + graceful shutdown
- `app.js`: app Express + Swagger
- `src/routes.js`: routes API
- `src/config/database.js`: connexion Mongo + etat DB
- `src/config/redis.js`: client Redis + etat Redis
- `src/config/metrics.js`: metriques Prometheus
- `src/config/logger.js`: logs JSON
- `src/modules/services/document.service.js`: creation batch + queue/fallback
- `src/modules/services/document.processor.js`: pipeline de traitement document
- `src/modules/services/docusign.service.js`: circuit breaker DocuSign simule
- `src/modules/worker/document.worker.js`: worker Bull
- `src/modules/generator-pdf/pdf.generator.js`: template cache + stream PDF
- `src/modules/generator-pdf/pdf.thread.js`: worker thread PDF
- `src/modules/storage/pdf.storage.js`: upload/download GridFS
- `src/modules/validation/document.validation.js`: Joi middleware
- `src/docs/openapi.yaml`: spec OpenAPI
- `benchmark.js`: benchmark + rapport
- `scripts/generate-benchmark-graph.js`: CSV -> PNG

## Variables d'environnement

Exemple:

```env
PORT=3000
URL_DB_MONGO=mongodb://127.0.0.1:27017/test_api_back_nodejs
REDIS_URL=redis://127.0.0.1:6379
REDIS_HOST=127.0.0.1

QUEUE_CONCURRENCY=10
PDF_TIMEOUT_MS=5000

BENCHMARK_API_URL=http://localhost:3000
BENCHMARK_POLL_MS=1000
BENCHMARK_MAX_WAIT_MS=600000
BENCHMARK_REPORT_FILE=benchmark-report.json
BENCHMARK_CURVE_FILE=benchmark-curve.csv
BENCHMARK_CURVE_PNG=benchmark-curve.png
```

Notes:
- Local (api hors docker): Redis en `127.0.0.1`
- Docker compose inter-conteneurs: Redis en `redis`

## Installation

```bash
npm install
```

## Lancement (ordre recommande)

### 1) Dependances (Mongo + Redis)

```bash
docker compose up -d
```

### 2) API (terminal 1)

```bash
npm run dev
```

### 3) Worker (terminal 2)

```bash
npm run worker
```

### 4) Tests / benchmark (terminal 3)

Voir sections ci-dessous.

## Endpoints

- `GET /` : message de bienvenue
- `POST /api/documents/batch` : creer un batch
- `GET /api/documents/batch/:batchId` : statut batch + `statusCounts`
- `GET /api/documents/:documentId` : stream PDF genere (ou 409 si pas pret)
- `GET /health` : etat DB, Redis, queue
- `GET /metrics` : metriques Prometheus
- `GET /dashboard` : dashboard texte
- `GET /docs` : Swagger UI

## Exemples curl

### Creer un batch

```bash
curl -X POST http://localhost:3000/api/documents/batch \
  -H "Content-Type: application/json" \
  -d '{"userIds":["user_0001","user_0002","user_0003"]}'
```

### Lire statut batch

```bash
curl http://localhost:3000/api/documents/batch/<BATCH_ID>
```

### Telecharger un PDF

```bash
curl -L "http://localhost:3000/api/documents/<DOCUMENT_ID>" --output document.pdf
```

### Health / Metrics / Dashboard

```bash
curl http://localhost:3000/health
curl http://localhost:3000/metrics
curl http://localhost:3000/dashboard
```

## Swagger / OpenAPI

- UI: [http://localhost:3000/docs](http://localhost:3000/docs)
- Spec: `src/docs/openapi.yaml`

## Benchmark

Le benchmark:
- envoie 1000 `userIds`
- suit la progression batch
- mesure temps total + documents/seconde + echantillons CPU/memoire
- ecrit un rapport JSON + CSV de courbe

Commande:

```bash
npm run benchmark
```

Sorties:
- `benchmark-report.json`
- `benchmark-curve.csv`

## Graphe PNG (courbes)

Generation automatique du PNG a partir du CSV:

```bash
npm run benchmark:graph
```

Sortie par defaut:
- `benchmark-curve.png`

Personnalisation:

```bash
BENCHMARK_CURVE_FILE=benchmark-curve.csv BENCHMARK_CURVE_PNG=reports/curve.png npm run benchmark:graph
```

## Scripts npm

- `npm run dev`: API (nodemon)
- `npm run start`: API (prod)
- `npm run worker`: worker Bull
- `npm run benchmark`: benchmark 1000 docs + rapport
- `npm run benchmark:graph`: CSV benchmark -> PNG

## Metriques exposees

- `documents_generated_total`
- `batch_processing_duration_seconds`
- `queue_size`

## Troubleshooting

### `MaxRetriesPerRequestError` (Redis)

- Verifier que Redis est demarre
- Verifier `.env` (`REDIS_URL`)
- Redemarrer API + worker apres changement de config

### `GridFSBucket is not a constructor`

- Le projet utilise `mongoose.mongo.GridFSBucket` dans `pdf.storage.js`
- Redemarrer le worker apres update

### Document retourne `409 Document is not generated yet`

- Le worker n'a pas fini le job
- Verifier les logs worker et `GET /api/documents/batch/:batchId`

## Captures attendues (pour livrable)

Objectif: fournir des preuves que les endpoints et scripts fonctionnent.

1. Swagger UI

- `GET /docs`
- Capture recommandee: page Swagger affichant au minimum `POST /api/documents/batch`, `GET /api/documents/batch/{batchId}`, `GET /api/documents/{documentId}`, `GET /health`

2. Dashboard texte

- `GET /dashboard`
- Capture recommandee: aperçu d'une sortie texte avec `db`, `redis`, `queue` et résumé du dernier `benchmark-report.json`

3. Metrics Prometheus

- `GET /metrics`
- Capture recommandee: présence des métriques `documents_generated_total`, `batch_processing_duration_seconds`, `queue_size`

4. Graphe PNG benchmark

- `benchmark-curve.png` (généré automatiquement)
- Capture recommandee: l'image du graphe (conversion CSV -> PNG)

## Roadmap possible

- Collection Postman complete
- Dashboard Grafana
- Tests automatises unitaires/integration

## Checklist finale de conformite au PDF

1. API Core

- `POST /api/documents/batch` (batchId retourne) : OUI
- `GET /api/documents/batch/:batchId` (statut + documents) : OUI (via `statusCounts`)
- `GET /api/documents/:documentId` (PDF) : OUI (stream PDF via GridFS)
- Queue Bull + worker separe : OUI
- Retry 3 tentatives + backoff exponentiel : OUI (`attempts: 3`, `backoff: exponential`)
- MongoDB batches + documents : OUI (collections `batchs` et `documents`)

2. Performances

- Worker threads pour paralleliser la generation PDF : OUI (`worker_threads`)
- Cache templates PDF : OUI (cache en memoire dans le worker PDF)
- Streaming PDF vers la base (GridFS) : OUI (`uploadPdfStream`)
- Benchmark batch 1000 + mesure temps + docs/s + rapport : OUI
- Rapport detaille avec courbes : OUI (`benchmark-curve.csv`) + PNG auto (`benchmark-curve.png`)

3. Resilience

- Circuit breaker appels externes (DocuSign simule) : OUI (`opossum`)
- Health checks : OUI (`GET /health`)
- Graceful shutdown SIGTERM : OUI (API + worker)
- Redis down fallback memoire : OUI (traitement local si `queue.add` echoue)
- Timeout generation PDF 5s max : OUI (`PDF_TIMEOUT_MS=5000` + timeout d'execution)

4. Observabilite

- Logs JSON avec correlation batchId/documentId : OUI (Winston + correlation dans `document.processor.js`)
- Prometheus metrics exposees : OUI (`GET /metrics`)
- Queue size : OUI (gauge `queue_size`)