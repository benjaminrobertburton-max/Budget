import { CollectionError, requireEvidence as check } from "./errors.mjs";

// Serialized into the page. Never read textContent, innerHTML, names, URLs,
// classes/IDs, label text, credentials, form values or browser/session storage.
// Only fixed tag/role vocabulary, topology and bounded counts cross this boundary.
export function readStructureInPage() {
  const tags = new Set("html body main nav header footer section article aside div span p h1 h2 h3 h4 h5 h6 table thead tbody tfoot tr th td ul ol li dl dt dd a button label form input select textarea iframe canvas details summary other".split(" "));
  const roles = new Set("none table row rowgroup cell columnheader rowheader grid gridcell list listitem navigation main region heading button link tab tablist tabpanel dialog status alert other".split(" "));
  const ignored = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD"]);
  const report = { version: 1, kind: "structure_only", coverageVerified: false,
    truncated: false, hasFrames: false, hasShadowRoots: false, redactedSubtrees: 0, nodes: [] };
  const walk = (element, parent, position, depth, shadow = false) => {
    if (report.nodes.length >= 1500 || depth > 64 || position > 50000) { report.truncated = true; return; }
    if (ignored.has(element.tagName)) return;
    const rawTag = element.tagName.toLowerCase();
    const tag = tags.has(rawTag) ? rawTag : "other";
    const rawRole = element.getAttribute("role");
    const role = rawRole === null ? "none" : roles.has(rawRole) ? rawRole : "other";
    const id = report.nodes.length;
    report.nodes.push({ id, parent, position, tag, role, shadow });
    if (tag === "iframe") { report.hasFrames = true; return; }
    if (["form", "input", "select", "textarea"].includes(tag) || element.hasAttribute("contenteditable")) {
      report.redactedSubtrees += 1;
      return;
    }
    let index = 0;
    for (const child of element.children) {
      walk(child, id, ++index, depth + 1);
      if (report.nodes.length >= 1500) { report.truncated = true; break; }
    }
    if (element.shadowRoot) {
      report.hasShadowRoots = true;
      let shadowIndex = 0;
      for (const child of element.shadowRoot.children) {
        walk(child, id, ++shadowIndex, depth + 1, true);
        if (report.nodes.length >= 1500) { report.truncated = true; break; }
      }
    }
  };
  if (document.body) walk(document.body, -1, 1, 0);
  return report;
}

const tags = new Set("html body main nav header footer section article aside div span p h1 h2 h3 h4 h5 h6 table thead tbody tfoot tr th td ul ol li dl dt dd a button label form input select textarea iframe canvas details summary other".split(" "));
const roles = new Set("none table row rowgroup cell columnheader rowheader grid gridcell list listitem navigation main region heading button link tab tablist tabpanel dialog status alert other".split(" "));
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const integer = (value, minimum, maximum) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;
const invalid = () => new CollectionError("STRUCTURE_INSPECTION_BLOCKED", "Page structure could not be inspected safely. No page contents were included in diagnostics.");

export function validatePageStructure(value) {
  check(exact(value, ["version", "kind", "coverageVerified", "truncated", "hasFrames", "hasShadowRoots", "redactedSubtrees", "nodes"])
    && value.version === 1 && value.kind === "structure_only" && value.coverageVerified === false
    && [value.truncated, value.hasFrames, value.hasShadowRoots].every(flag => typeof flag === "boolean")
    && integer(value.redactedSubtrees, 0, 1500) && Array.isArray(value.nodes) && value.nodes.length <= 1500,
  "STRUCTURE_INSPECTION_BLOCKED", "Page structure did not match the private inspection contract.");
  for (const [index, node] of value.nodes.entries()) {
    check(exact(node, ["id", "parent", "position", "tag", "role", "shadow"])
      && node.id === index && integer(node.parent, index === 0 ? -1 : 0, index - 1)
      && integer(node.position, 1, 50000) && tags.has(node.tag) && roles.has(node.role)
      && typeof node.shadow === "boolean",
    "STRUCTURE_INSPECTION_BLOCKED", "Page structure did not match the private inspection contract.");
  }
  return value;
}

export async function inspectPageStructure(page) {
  try { return validatePageStructure(await page.evaluate(readStructureInPage)); }
  catch { throw invalid(); }
}
