# local-rag-ingest

## What it is

A local-first toolkit for a D&D 5e Game Master. It ingests campaign notes into a
Qdrant vector store, prepares D&D 5e action data, keeps game state in SQLite, and
launches a local llama.cpp model server.

The RAG ingestion pipeline, the action-data tooling, and the SQLite game-state store
are implemented and runnable today. The tool-calling Game Master engine that would
consume those layers is **in progress** and is not yet a working feature.

The repository is named `local-rag-ingest`, but the project is the whole Game Master
toolkit described below, not a standalone ingest tool.

## Features

### Implemented

- **RAG ingestion of campaign notes.**
  `packages/rag/rag.ts` reads the markdown files under `campaigns/`, splits them with
  LangChain `MarkdownTextSplitter` (`chunkSize: 768`, `chunkOverlap: 256`), embeds each
  chunk with `@langchain/ollama` `OllamaEmbeddings` (`nomic-embed-text` at
  `http://localhost:11434`), and upserts the results in batches into Qdrant
  (`@qdrant/js-client-rest` at `http://localhost:6333`, collection `dnd_campaign_notes`,
  768-dimensional cosine vectors). Embedding runs concurrently with a `p-limit` pool of 8
  and is flushed in batches of 100. Proof: `packages/rag/rag.ts`.
- **Qdrant development stack.**
  A docker-compose file starts a `qdrant/qdrant` service with a health check and a
  persistent volume. Proof: `packages/rag/docker-compose.yaml`.
- **Campaign note collection.**
  Sample source notes are provided under `campaigns/`, including
  `campaigns/Lost Mine of Phandelver.md`. Proof: the `campaigns/` directory.
- **D&D 5e action data and filtering tooling.**
  `packages/data/actions.json` (full action data), `packages/data/actions-sublist.json`
  (a compact key list) and `packages/data/actions-sublist-detailed.json` (the filtered
  result) are cross-referenced by `packages/GameEngine/actionsubsetcreator.ts`, a small
  Node script whose `getSublistDetailedActions` function matches decoded sublist keys
  against `name_source` keys and writes the detailed subset.
  Proof: `packages/data/actions.json`, `packages/data/actions-sublist.json`,
  `packages/data/actions-sublist-detailed.json`,
  `packages/GameEngine/actionsubsetcreator.ts`.
- **SQLite game-state store.**
  `packages/GameEngine/game.db` is a SQLite database opened with `better-sqlite3` in
  `packages/GameEngine/GameEngine.tsx`, which sets `journal_mode = WAL`. The database file
  and WAL initialization exist; no tables are defined yet.
  Proof: `packages/GameEngine/game.db`, `packages/GameEngine/GameEngine.tsx`.
- **Local model launcher.**
  `start.sh` starts a local `llama-server` (llama.cpp) with a Qwopus 3.5 9B coder GGUF,
  offloading 20 layers (`-ngl 20`) at a 64k context window (`-c 65536`) and enabling the
  chat template with `--jinja`. Proof: `start.sh`.

### In progress

- **Tool-calling Game Master engine.** A turn-by-turn engine that would call tools to
  consume the RAG store, the action data, and the SQLite game state. Only a stub exists:
  `packages/GameEngine/GameEngine.tsx` opens the database and sets WAL, with the engine
  class commented out and empty. There is no tool-calling loop, no agent loop, and no
  turn management in the repository today. This layer is **not working** and is not
  claimed as a feature.

## Tech stack

- **Language and runtime:** TypeScript (ESM) on Node.js. Proof: `package.json`,
  `tsconfig.json`.
- **RAG pipeline:** LangChain (`@langchain/core`, `@langchain/ollama`,
  `@langchain/textsplitters`), `@qdrant/js-client-rest`, `p-limit`. Proof: `package.json`.
- **Embeddings runtime:** Ollama serving `nomic-embed-text`. Proof: `packages/rag/rag.ts`.
- **Vector store:** Qdrant. Proof: `packages/rag/docker-compose.yaml`,
  `packages/rag/rag.ts`.
- **Game state:** SQLite via `better-sqlite3`. Proof: `packages/GameEngine/GameEngine.tsx`.
- **Local model server:** llama.cpp (`llama-server`). Proof: `start.sh`.

The root package is named `llm-tool` and declares TypeScript, `tsx`, and
`better-sqlite3` types. Proof: `package.json`.

## Architecture

```text
campaigns/*.md
      |
      v
packages/rag/rag.ts
  MarkdownTextSplitter  ->  OllamaEmbeddings (nomic-embed-text)
                                    |
                                    v
                          Qdrant (dnd_campaign_notes)
                                    ^
                                    |
                                    |  (intended consumer, in progress)
                                    |
packages/data/actions*.json  -->  Game Engine  -->  SQLite game.db
  actionsubsetcreator.ts          (in progress)      (better-sqlite3, WAL)
                                    ^
                                    |
                            start.sh -> llama-server (Qwopus 3.5 9B coder GGUF)
```

The implemented layers are independent and runnable on their own. `rag.ts` reads the
markdown in `campaigns/`, chunks it, embeds the chunks through a locally running Ollama,
and stores the vectors in Qdrant. Separately, `actionsubsetcreator.ts` filters the D&D 5e
action dataset into a detailed subset, and `GameEngine.tsx` opens the SQLite game-state
database. `start.sh` runs the local llama.cpp server. The unfinished Game Master engine
is drawn as the intended consumer of all four layers; it is a stub today.

## Getting started

### Prerequisites

- Node.js and npm (the project is an ESM TypeScript package; `tsx` is the runner in dev
  dependencies). Proof: `package.json`, `tsconfig.json`.
- Ollama running locally with the `nomic-embed-text` model pulled, listening on
  `http://localhost:11434`. Proof: `packages/rag/rag.ts`.
- Qdrant running on `http://localhost:6333`. A compose file is provided by
  `packages/rag/docker-compose.yaml`.
- For the local model, a GGUF file that is **not** part of the repository. `start.sh`
  expects it at `$SCRIPT_DIR/models/Qwopus3.5-9B-coder-Exp-Q4_K_M.gguf` (that is,
  `models/` next to `start.sh`). The `models` directory is git-ignored, so the file must
  be downloaded separately and placed there before running `start.sh`.
  Proof: `start.sh`, `.gitignore`.

### Install

```bash
npm install
```

### Start Qdrant

The compose file also defines `grafana_service` and a `vector` service. The `vector`
service mounts a `./vector` config directory that is not part of the repository, so start
only the Qdrant service:

```bash
docker compose -f packages/rag/docker-compose.yaml up -d qdrant_service
```

### Pull the embedding model

```bash
ollama pull nomic-embed-text
```

## Usage example

Ingest the campaign notes into Qdrant. Run from the repository root:

```bash
npx tsx packages/rag/rag.ts
```

The script finds the markdown files under `campaigns/`, creates the collection if it does
not exist, prints embedding progress, and reports the number of chunks upserted into
`dnd_campaign_notes`.

Regenerate the detailed D&D 5e action subset. The script reads `../data/...` relative to
its working directory, so run it from its own folder:

```bash
cd packages/GameEngine
npx tsx actionsubsetcreator.ts
```

This writes `packages/data/actions-sublist-detailed.json`.

Open the SQLite game-state store (currently empty, WAL enabled):

```bash
npx tsx packages/GameEngine/GameEngine.tsx
```

Start the local llama.cpp model server (requires the GGUF described above):

```bash
./start.sh
```

There is also a helper script that lists the discovered campaigns:
`npx tsx packages/rag/rag.unit.test.ts`. It prints output only and contains no test
assertions; the repository has no configured test runner.

## Status and license

**Status:** Partially implemented. RAG ingestion, the D&D 5e action-data tooling, the
SQLite game-state store, and the local model launcher are implemented. The tool-calling
Game Master engine is **in progress** and does not work yet; no agent loop or turn-by-turn
play is available in this repository. Package version: `1.0.0`. Proof: `package.json`.

**License:** No license file is present. The `package.json` declares `"license": "ISC"`,
but there is no `LICENSE` file in the repository. Proof: absence of a `LICENSE` file,
`package.json`.
