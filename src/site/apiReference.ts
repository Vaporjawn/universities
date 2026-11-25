import path from 'path';
import ts from 'typescript';
import { escapeHtml } from './siteMetrics';

/** One member of a class, interface or enum. */
export interface ApiMember {
  name: string;
  /** Type text, or the signature for methods. */
  type: string;
  optional: boolean;
  doc: string;
}

/** One public export of the package. */
export interface ApiItem {
  name: string;
  kind: 'class' | 'interface' | 'enum' | 'function' | 'type' | 'constant';
  /** Signature of a function, the aliased type, or the type of a constant. Empty for classes, interfaces and enums. */
  signature: string;
  doc: string;
  members: ApiMember[];
}

/** TSDoc text of a symbol, trimmed. */
const docOf = (symbol: ts.Symbol, checker: ts.TypeChecker): string =>
  ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim();

/** Members of a class, interface or enum symbol. Private and protected class members are left out. */
const membersOf = (symbol: ts.Symbol, checker: ts.TypeChecker): ApiMember[] => {
  const table = symbol.flags & ts.SymbolFlags.Enum ? symbol.exports : symbol.members;
  if (!table) return [];
  const members: ApiMember[] = [];
  table.forEach(member => {
    const [declaration] = member.declarations ?? [];
    if (!declaration) return;
    const flags = ts.getCombinedModifierFlags(declaration as ts.Declaration);
    if (flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected) || member.name === '__constructor') return;
    members.push({
      name: member.name,
      type: checker.typeToString(
        checker.getTypeOfSymbolAtLocation(member, declaration),
        declaration,
        ts.TypeFormatFlags.NoTruncation
      ),
      optional: Boolean(member.flags & ts.SymbolFlags.Optional),
      doc: docOf(member, checker),
    });
  });
  return members;
};

/**
 * Read the public API of a TypeScript entry point with the compiler: every export, its kind, signature and TSDoc.
 *
 * @param entry - Path to the entry file, e.g. `src/index.ts`.
 * @param tsconfigPath - tsconfig that describes the project.
 * @returns Items sorted by kind then name.
 */
export const extractApi = (entry: string, tsconfigPath: string): ApiItem[] => {
  const config = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(tsconfigPath));
  const program = ts.createProgram([entry], parsed.options);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(entry);
  const moduleSymbol = source && checker.getSymbolAtLocation(source);
  if (!moduleSymbol) throw new Error(`${entry} is not a module`);

  const items: ApiItem[] = [];
  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const [declaration] = symbol.declarations ?? [];
    if (!declaration) continue;
    const base = { name: exported.name, doc: docOf(symbol, checker), members: [] as ApiMember[], signature: '' };
    const typeText = (): string =>
      checker.typeToString(
        checker.getTypeOfSymbolAtLocation(symbol, declaration),
        declaration,
        ts.TypeFormatFlags.NoTruncation
      );

    if (symbol.flags & ts.SymbolFlags.Class)
      items.push({ ...base, kind: 'class', members: membersOf(symbol, checker) });
    else if (symbol.flags & ts.SymbolFlags.Enum)
      items.push({ ...base, kind: 'enum', members: membersOf(symbol, checker) });
    else if (symbol.flags & ts.SymbolFlags.Interface)
      items.push({ ...base, kind: 'interface', members: membersOf(symbol, checker) });
    else if (symbol.flags & ts.SymbolFlags.TypeAlias) {
      items.push({
        ...base,
        kind: 'type',
        // The written type, not the checker's rendering, which would just print the alias name.
        signature: (declaration as ts.TypeAliasDeclaration).type.getText(),
      });
    } else if (symbol.flags & ts.SymbolFlags.Function) items.push({ ...base, kind: 'function', signature: typeText() });
    else if (symbol.flags & ts.SymbolFlags.Variable) {
      // `const name = () => {}` is a function as far as a reader of the API is concerned.
      const isCallable = checker.getTypeOfSymbolAtLocation(symbol, declaration).getCallSignatures().length > 0;
      items.push({ ...base, kind: isCallable ? 'function' : 'constant', signature: typeText() });
    }
  }

  const order = ['class', 'function', 'interface', 'type', 'enum', 'constant'];
  return items.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name));
};

/** Shared page chrome used by the API page and the rendered markdown pages. */
export const pageShell = (title: string, body: string): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1c1c1e;--muted:#666;--line:#ddd;--accent:#2b6cb0;--code:#f4f4f6}
@media (prefers-color-scheme:dark){:root{--bg:#161618;--fg:#eee;--muted:#9a9a9f;--line:#333;--accent:#63a4e8;--code:#232326}}
body{font:16px/1.55 system-ui,sans-serif;background:var(--bg);color:var(--fg);max-width:60rem;margin:0 auto;padding:1rem}
nav{margin-bottom:1rem}nav a{margin-right:1rem}a{color:var(--accent)}
pre,code{background:var(--code);border-radius:4px;font:.9em ui-monospace,monospace}code{padding:.1em .3em}pre{padding:.75rem;overflow-x:auto}pre code{padding:0}
table{border-collapse:collapse;width:100%}th,td{padding:.3rem .5rem;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
img{max-width:100%}h2{border-bottom:1px solid var(--line);padding-bottom:.2rem}.kind{color:var(--muted);font-size:.8em;margin-left:.4rem}
</style></head><body>
<nav><a href="index.html">Home</a><a href="api.html">API reference</a><a href="guide.html">Guide</a><a href="metrics.html">Metrics</a><a href="https://github.com/Vaporjawn/universities">GitHub</a></nav>
${body}
</body></html>
`;

/**
 * Render the API items as an HTML page.
 *
 * @param items - Output of {@link extractApi}.
 */
export const renderApiHtml = (items: ApiItem[]): string => {
  const toc = items.map(i => `<a href="#${escapeHtml(i.name)}">${escapeHtml(i.name)}</a>`).join(' · ');
  const sections = items
    .map(item => {
      const members = item.members.length
        ? `<table><thead><tr><th>Member</th><th>Type</th><th>Description</th></tr></thead><tbody>${item.members
            .map(
              m =>
                `<tr><td><code>${escapeHtml(m.name)}${m.optional ? '?' : ''}</code></td><td><code>${escapeHtml(m.type)}</code></td><td>${escapeHtml(m.doc)}</td></tr>`
            )
            .join('')}</tbody></table>`
        : '';
      const signature = item.signature ? `<pre><code>${escapeHtml(item.signature)}</code></pre>` : '';
      const doc = item.doc ? `<p>${escapeHtml(item.doc).replace(/\n\n/g, '</p><p>')}</p>` : '';
      return `<section id="${escapeHtml(item.name)}"><h2>${escapeHtml(item.name)}<span class="kind">${item.kind}</span></h2>${doc}${signature}${members}</section>`;
    })
    .join('\n');
  return pageShell(
    'universities API reference',
    `<h1>API reference</h1><p>${items.length} exports. Generated from the TypeScript sources.</p><p>${toc}</p>${sections}`
  );
};
