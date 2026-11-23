import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const specs: number[][] = [];
for (const [opcode, ...spec] of [
  [0x00,0,0,0], [0x01,1,0,1], [0x02,4,0,1], [0x03,0,1,0],
  [0x04,0,1,2], [0x05,0,2,2], [0x06,0,2,3], [0x07,0,3,3],
  [0x10,0,2,1], [0x11,0,2,1], [0x12,0,2,1], [0x13,0,2,1],
  [0x14,0,2,1], [0x15,0,2,1], [0x16,0,2,1], [0x17,0,1,1],
  [0x18,0,2,1], [0x19,0,2,1], [0x1a,0,2,1], [0x1b,0,1,1],
  [0x1c,0,2,1], [0x1d,0,2,1], [0x1e,0,2,1],
  [0x20,0,2,1], [0x21,0,2,1], [0x22,0,2,1],
  [0x30,2,0,0], [0x31,2,1,0], [0x32,2,1,0], [0x33,2,0,0],
  [0x34,0,0,0], [0x40,0,1,1], [0x41,0,2,0],
  [0x50,0,1,0], [0x51,0,1,0], [0x52,0,0,1], [0x53,0,1,0],
]) specs[opcode] = spec;

export function run(program: Uint8Array, input: Uint8Array) {
  const stack = new Int32Array(256), calls = new Int32Array(64);
  const memory = new Int32Array(256), out = new Uint8Array(65536);
  let sp = 0, csp = 0, pc = 0, ip = 0, olen = 0, steps = 0;
  const done = (exit: number, trap: number | null = exit) =>
    ({ stdout: out.slice(0, olen), exit, trap, steps });

  for (;;) {
    if (steps === 1000000) return done(10);
    if (pc < 0 || pc >= program.length) return done(9);
    const op = program[pc], spec = specs[op];
    if (spec === undefined) return done(5);
    const [imm, pops, pushes] = spec;
    if (pc + imm >= program.length) return done(9);
    steps++;
    const next = pc + 1 + imm;
    if (sp < pops) return done(2);
    if (sp - pops + pushes > 256) return done(3);
    pc = next;

    if (op >= 0x10 && op <= 0x22 && op !== 0x17 && op !== 0x1b) {
      const right = stack[sp - 1], left = stack[sp - 2];
      let result = 0;
      switch (op) {
        case 0x10: result = (left + right) | 0; break;
        case 0x11: result = (left - right) | 0; break;
        case 0x12: result = Math.imul(left, right); break;
        case 0x13:
          if (right === 0) return done(4);
          result = left === -2147483648 && right === -1 ? left : (left / right) | 0;
          break;
        case 0x14:
          if (right === 0) return done(4);
          result = right === -1 ? 0 : (left % right) | 0;
          break;
        case 0x15:
          if (right === 0) return done(4);
          result = Math.floor((left >>> 0) / (right >>> 0)) | 0;
          break;
        case 0x16:
          if (right === 0) return done(4);
          result = ((left >>> 0) % (right >>> 0)) | 0;
          break;
        case 0x18: result = left & right; break;
        case 0x19: result = left | right; break;
        case 0x1a: result = left ^ right; break;
        case 0x1c: result = left << (right & 31); break;
        case 0x1d: result = left >> (right & 31); break;
        case 0x1e: result = (left >>> (right & 31)) | 0; break;
        case 0x20: result = left === right ? 1 : 0; break;
        case 0x21: result = left < right ? 1 : 0; break;
        case 0x22: result = (left >>> 0) < (right >>> 0) ? 1 : 0; break;
      }
      stack[--sp - 1] = result;
      continue;
    }

    switch (op) {
      case 0x00: return done(0, null);
      case 0x01:
        stack[sp++] = (program[next - 1] << 24) >> 24;
        break;
      case 0x02:
        stack[sp++] = program[next - 4] | (program[next - 3] << 8) |
          (program[next - 2] << 16) | (program[next - 1] << 24);
        break;
      case 0x03: sp--; break;
      case 0x04: stack[sp] = stack[sp - 1]; sp++; break;
      case 0x05: {
        const value = stack[sp - 1];
        stack[sp - 1] = stack[sp - 2];
        stack[sp - 2] = value;
        break;
      }
      case 0x06: stack[sp] = stack[sp - 2]; sp++; break;
      case 0x07: {
        const value = stack[sp - 3];
        stack[sp - 3] = stack[sp - 2];
        stack[sp - 2] = stack[sp - 1];
        stack[sp - 1] = value;
        break;
      }
      case 0x17: stack[sp - 1] = -stack[sp - 1] | 0; break;
      case 0x1b: stack[sp - 1] = ~stack[sp - 1]; break;
      case 0x30:
      case 0x31:
      case 0x32: {
        const rel = ((program[next - 2] | (program[next - 1] << 8)) << 16) >> 16;
        const take = op === 0x30 || (op === 0x31) === (stack[--sp] === 0);
        if (take) pc = next + rel;
        break;
      }
      case 0x33:
        if (csp === 64) return done(7);
        calls[csp++] = next;
        pc = program[next - 2] | (program[next - 1] << 8);
        break;
      case 0x34:
        if (csp === 0) return done(8);
        pc = calls[--csp];
        break;
      case 0x40: {
        const addr = stack[sp - 1];
        if (addr < 0 || addr >= 256) return done(6);
        stack[sp - 1] = memory[addr];
        break;
      }
      case 0x41: {
        const addr = stack[sp - 1];
        if (addr < 0 || addr >= 256) return done(6);
        memory[addr] = stack[sp - 2];
        sp -= 2;
        break;
      }
      case 0x50: {
        const bytes = Buffer.from(String(stack[sp - 1]));
        if (olen + bytes.length > 65536) return done(11);
        sp--;
        out.set(bytes, olen);
        olen += bytes.length;
        break;
      }
      case 0x51:
        if (olen === 65536) return done(11);
        out[olen++] = stack[--sp] & 255;
        break;
      case 0x52: stack[sp++] = ip < input.length ? input[ip++] : -1; break;
      case 0x53: return done(stack[--sp] & 255, null);
    }
  }
}

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(inputDir).sort()) {
  const result = run(readFileSync(join(inputDir, id, 'program.bin')),
    readFileSync(join(inputDir, id, 'input.bin')));
  mkdirSync(join(outputDir, id), { recursive: true });
  writeFileSync(join(outputDir, id, 'stdout.bin'), result.stdout);
  writeFileSync(join(outputDir, id, 'exit.txt'), `${result.exit}\n`);
}
