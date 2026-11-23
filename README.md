# Tiny stack VM

Node 22, standard library only. `main.ts` implements all 37 ISA opcodes and
all ten traps in reference order. Limits: 256 stack values, 64 calls,
256 zeroed memory words, 1,000,000 steps, 65,536 output bytes.

Run `node /bot/main.ts`; defaults are `/input` and `/output`.
For local practice, set `KIT` to the unpacked kit directory:

```sh
MAKEFUN_INPUT_DIR="$KIT/practice/input" \
MAKEFUN_OUTPUT_DIR=/tmp/tiny-stack-vm-out node main.ts
```

Verified: 40/40 practice stdout and exit matches; 7,358 differential checks
also match traps and steps. House baseline: 20/40 exact matches.
Official checker mean: 1000/1000, versus baseline 670/1000.
Keep generated outputs outside the repository. No competition submission.
