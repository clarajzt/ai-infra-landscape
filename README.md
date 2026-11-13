# AI Infrastructure Landscape

An interactive map of the AI infrastructure stack: 638 companies and products across 8 layers and 24 segments, with 720 sourced observations of funding, revenue, valuation and M&A. Data as of 2026-11-01.

## View the map

Open `index.html` in a browser. It is a single self-contained page: no server, no install, works offline.

The page has three views:

- **Market overview:** the landscape by layer, headline figures, and a yearly trend. Every number opens the events behind it.
- **Company map:** searchable company list with country, segment, product and the latest public figures.
- **Evolution and opportunities:** how each generation of model capability moved the scarce resource, and where the investable seams are.

## Layers

| # | Layer | Segments |
|---|---|---|
| 01 | Compute and model serving | Chips and physical infrastructure; GPU clouds and compute scheduling; training and post-training platforms; inference engines and services |
| 02 | Data and knowledge infrastructure | Databases and real-time state; search, retrieval and knowledge processing; memory and context |
| 03 | Training data and feedback | Expert, labeling and synthetic data; agent trajectories and RL environments; simulation and physical AI data |
| 04 | Execution and runtime | Sandboxes and isolated execution; browser and computer use; durable execution and scheduling |
| 05 | Development and integration | Tool connectivity and integration; agent development frameworks; workflow and app building |
| 06 | Quality, security and control | Model routing and gateways; evals, observability and regression; security, identity and governance |
| 07 | Interaction and transaction infrastructure | Real-time voice and communications; agent payments and commerce |
| 08 | Adjacent platforms and extended products | Foundation models and open-source ecosystem; applications and developer entry points; other discovery records |

## Data files

| File | Contents |
|---|---|
| `data/companies.csv` | One row per company or product: layer, segment, country, product, website, sources |
| `data/events.csv` | One row per observation: type, date, amount in USD millions, basis, status, source link |
| `data/landscape.json` | Everything the page uses, including the taxonomy and research framework |

## How to read the numbers

- **This is a research sample, not a census.** A company or deal that is missing has not been recorded; it is not a zero.
- **Every observation carries its source type:** regulatory filing, company disclosure, investor disclosure, media report, third-party estimate, or funding talks. Estimates and reports are included and labelled.
- **Funding** counts announced equity rounds by announcement date. Total-raised snapshots, debt facilities, IPO proceeds and secondary sales are shown but not counted as new funding.
- **Revenue** keeps the original basis: ARR, annualized run-rate, and recognized revenue are different things and are labelled as such.
- **Valuations** are shown as medians, never summed.
- **Layer 08** (foundation-model labs and unclassified records) is excluded from headline totals, because single rounds there would swamp the infrastructure sample.
- **Currency:** amounts are in USD. RMB is converted at a fixed 7 CNY/USD and EUR at 1.17 USD/EUR for analysis; these are not historical exchange rates.
- Many directory-sourced entries are unverified, and third-party "total raised" figures in particular can be wrong. Check the linked source before relying on any single figure.

## Corrections

Corrections and additions are welcome through an issue, with a link to a public source.

This is independent research for information only and is not investment advice.
