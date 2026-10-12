// Minimal in-place JSON string patcher: replaces only string-literal values at given
// dotted key paths (same convention as scripts/text-export.mjs), leaving every other
// byte of the file exactly as it was.
export function locateStrings(raw) {
  let i = 0;
  const out = new Map();
  const ws = () => { while (i < raw.length && /\s/.test(raw[i])) i++; };
  const str = () => {
    const s = i;
    i++;
    while (raw[i] !== '"') { if (raw[i] === '\\') i++; i++; }
    i++;
    return [s, i];
  };
  const val = (p) => {
    ws();
    const c = raw[i];
    if (c === '"') {
      const [s, e] = str();
      out.set(p, { s, e });
    } else if (c === '{') {
      i++; ws();
      if (raw[i] === '}') { i++; return; }
      for (;;) {
        ws();
        const [ks, ke] = str();
        const key = JSON.parse(raw.slice(ks, ke));
        ws(); i++; // ':'
        val(p ? p + '.' + key : key);
        ws();
        if (raw[i] === ',') { i++; continue; }
        if (raw[i] === '}') { i++; break; }
        throw new Error('bad object at ' + i);
      }
    } else if (c === '[') {
      i++; ws();
      if (raw[i] === ']') { i++; return; }
      let n = 0;
      for (;;) {
        val((p ? p + '.' : '') + n);
        n++;
        ws();
        if (raw[i] === ',') { i++; continue; }
        if (raw[i] === ']') { i++; break; }
        throw new Error('bad array at ' + i);
      }
    } else {
      while (i < raw.length && !/[,}\]\s]/.test(raw[i])) i++;
    }
  };
  val('');
  return out;
}

// edits: Map<keyPath, newString>; inserts: array of {after: keyPath, key, value} — adds a
// sibling `"key": value` line after the string at `after`, copying that line's indentation.
export function patchJson(raw, edits, inserts = []) {
  const loc = locateStrings(raw);
  const ops = [];
  for (const [k, v] of edits) {
    const l = loc.get(k);
    if (!l) throw new Error('no string at ' + k);
    ops.push({ s: l.s, e: l.e, text: JSON.stringify(v) });
  }
  for (const ins of inserts) {
    const l = loc.get(ins.after);
    if (!l) throw new Error('no string at ' + ins.after);
    const lineStart = raw.lastIndexOf('\n', l.s) + 1;
    const indent = raw.slice(lineStart).match(/^\s*/)[0];
    ops.push({ s: l.e, e: l.e, text: `,\n${indent}${JSON.stringify(ins.key)}: ${JSON.stringify(ins.value)}` });
  }
  ops.sort((a, b) => b.s - a.s);
  let outRaw = raw;
  for (const o of ops) outRaw = outRaw.slice(0, o.s) + o.text + outRaw.slice(o.e);
  return outRaw;
}
