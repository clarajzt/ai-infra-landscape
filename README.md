# AI Infrastructure Landscape

**Live:** https://clarajzt.github.io/ai-infra-landscape/

An interactive map of the AI infrastructure stack: 638 companies and products across 8 layers and 24 segments, with 720 sourced observations of funding, revenue, valuation and M&A. Data as of 2026-11-01.

It is built to show where capital, revenue and consolidation are moving in each part of the stack, with every figure traceable to a public source.

## What's inside

| | |
|---|---|
| **Market overview** | The stack layer by layer: headline funding, revenue, valuation and M&A, a landscape of leading companies, and a yearly trend. Every number opens the observations behind it. |
| **Company map** | Every company and product with country, segment, product and its latest public figures. Each company opens its full funding, revenue and deal history. |
| **Evolution and opportunities** | How each generation of model capability moved the scarce resource, and where the investable seams are. |
| **About** | The taxonomy, where the data comes from, how to read the numbers, and the downloads. |

Filters for year, country, layer and segment are kept in the address bar, so any view can be bookmarked or shared.

## The stack

| # | Layer | Segments |
|---|---|---|
| 01 | Compute and model serving | Chips and physical infrastructure; GPU clouds and compute scheduling; Training and post-training platforms; Inference engines and services |
| 02 | Data and knowledge infrastructure | Databases and real-time state; Search, retrieval and knowledge processing; Memory and context |
| 03 | Training data and feedback | Expert, labeling and synthetic data; Agent trajectories and RL environments; Simulation and physical AI data |
| 04 | Execution and runtime | Sandboxes and isolated execution; Browser and computer use; Durable execution and scheduling |
| 05 | Development and integration | Tool connectivity and integration; Agent development frameworks; Workflow and app building |
| 06 | Quality, security and control | Model routing and gateways; Evals, observability and regression; Security, identity and governance |
| 07 | Interaction and transaction infrastructure | Real-time voice and communications; Agent payments and commerce |
| 08 | Adjacent platforms and extended products | Foundation models and open-source ecosystem; Applications and developer entry points; Other discovery records |

## How to read the numbers

- **This is a research sample, not a census.** A missing company or deal has not been recorded; it is not a zero.
- **Every observation carries its source type,** from regulatory filings to third-party estimates. Estimates and reports are included and labelled.
- **Funding** counts announced equity rounds by announcement date. Total-raised snapshots, debt facilities, IPO proceeds and secondary sales are not counted as new funding.
- **Revenue** keeps the original basis: ARR, annualized run-rate and recognized revenue are labelled separately.
- **Valuations** are medians, never sums. **Layer 08** (foundation-model labs, unclassified records) is kept out of headline totals.
- Amounts are in USD; RMB is converted at a fixed 7 CNY/USD and EUR at 1.17 USD/EUR for analysis.

## Data

| File | Contents |
|---|---|
| [`data/companies.csv`](data/companies.csv) | One row per company or product: layer, segment, country, product, website, sources |
| [`data/events.csv`](data/events.csv) | One row per observation: type, date, amount in USD millions, basis, status, source link |
| [`data/landscape.json`](data/landscape.json) | Everything the map uses, including the taxonomy and research framework |

## Run locally

Static files, no build step. The map loads its data with `fetch`, so serve the folder rather than opening the file:

```bash
python3 -m http.server
```

Then open the address it prints.

## Corrections

Corrections and additions are welcome as an [issue](https://github.com/clarajzt/ai-infra-landscape/issues), with a link to a public source.

Independent research for information only; not investment advice.
