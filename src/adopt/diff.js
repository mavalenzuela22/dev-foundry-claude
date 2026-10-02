// Minimal unified diff producer and applier for reviewable cutover proposals.
const splitLines = (text) => (text === '' ? [] : text.match(/[^\n]*\n|[^\n]+$/g));

function lcsOps(a, b) {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA -= 1; endB -= 1; }
  const x = a.slice(start, endA);
  const y = b.slice(start, endB);
  const ops = [];
  for (let i = 0; i < start; i += 1) ops.push([' ', a[i]]);
  if (x.length * y.length > 16_000_000) {
    x.forEach((line) => ops.push(['-', line]));
    y.forEach((line) => ops.push(['+', line]));
  } else {
    const table = Array.from({ length: x.length + 1 }, () => new Uint32Array(y.length + 1));
    for (let i = x.length - 1; i >= 0; i -= 1) {
      for (let j = y.length - 1; j >= 0; j -= 1) {
        table[i][j] = x[i] === y[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < x.length && j < y.length) {
      if (x[i] === y[j]) { ops.push([' ', x[i]]); i += 1; j += 1; }
      else if (table[i + 1][j] >= table[i][j + 1]) { ops.push(['-', x[i]]); i += 1; }
      else { ops.push(['+', y[j]]); j += 1; }
    }
    while (i < x.length) { ops.push(['-', x[i]]); i += 1; }
    while (j < y.length) { ops.push(['+', y[j]]); j += 1; }
  }
  for (let i = endA; i < a.length; i += 1) ops.push([' ', a[i]]);
  return ops;
}

const emit = (op, line) => (line.endsWith('\n') ? `${op}${line}` : `${op}${line}\n\\ No newline at end of file\n`);

export function makeUnifiedDiff(filePath, before, after, context = 3) {
  const ops = lcsOps(splitLines(before) ?? [], splitLines(after) ?? []);
  const changed = ops.map(([op], index) => (op === ' ' ? -1 : index)).filter((index) => index >= 0);
  if (changed.length === 0) return '';
  const hunks = [];
  let from = Math.max(0, changed[0] - context);
  let to = Math.min(ops.length, changed[0] + context + 1);
  for (const index of changed.slice(1)) {
    if (index - context <= to) to = Math.min(ops.length, index + context + 1);
    else { hunks.push([from, to]); from = Math.max(0, index - context); to = Math.min(ops.length, index + context + 1); }
  }
  hunks.push([from, to]);
  let out = `--- a/${filePath}\n+++ b/${filePath}\n`;
  for (const [h0, h1] of hunks) {
    const slice = ops.slice(h0, h1);
    const oldStart = ops.slice(0, h0).filter(([op]) => op !== '+').length;
    const newStart = ops.slice(0, h0).filter(([op]) => op !== '-').length;
    const oldCount = slice.filter(([op]) => op !== '+').length;
    const newCount = slice.filter(([op]) => op !== '-').length;
    out += `@@ -${oldCount === 0 ? oldStart : oldStart + 1},${oldCount} +${newCount === 0 ? newStart : newStart + 1},${newCount} @@\n`;
    for (const [op, line] of slice) out += emit(op, line);
  }
  return out;
}

export function applyUnifiedDiff(before, diff) {
  const lines = diff.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const source = splitLines(before) ?? [];
  const result = [];
  let cursor = 0;
  let index = 2;
  while (index < lines.length) {
    const header = /^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/.exec(lines[index]);
    if (!header) throw new Error('Malformed diff.');
    const oldStart = Number(header[2]) === 0 ? Number(header[1]) : Number(header[1]) - 1;
    while (cursor < oldStart) { result.push(source[cursor]); cursor += 1; }
    index += 1;
    while (index < lines.length && !lines[index].startsWith('@@ ')) {
      const op = lines[index][0];
      let text = lines[index].slice(1);
      let terminated = true;
      if (lines[index + 1] === '\\ No newline at end of file') { terminated = false; index += 1; }
      text += terminated ? '\n' : '';
      if (op === ' ' || op === '-') {
        if (source[cursor] !== text) throw new Error('Diff does not apply.');
        if (op === ' ') result.push(source[cursor]);
        cursor += 1;
      } else if (op === '+') result.push(text);
      else throw new Error('Malformed diff.');
      index += 1;
    }
  }
  while (cursor < source.length) { result.push(source[cursor]); cursor += 1; }
  return result.join('');
}
