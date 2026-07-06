#!/bin/bash

export LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

llama-server \
  --model "$SCRIPT_DIR/models/Qwopus3.5-9B-coder-Exp-Q4_K_M.gguf" \
  -ngl 20 \
  -c 65536 \
  -fa on\
  -ctk turbo4 \
  -ctv turbo3 \
  -np 2 \
  -t 8 \
  --temp 0.6 \
  --top-k 40 \
  --top-p 0.9 \
  --repeat-penalty 1.05 \
  --min-p 0.05 \
  --n-cpu-moe 16 \
  --jinja