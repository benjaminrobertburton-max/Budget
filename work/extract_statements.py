from pathlib import Path
from pypdf import PdfReader

paths = [
    r"C:\Users\Home\Documents\budgeting\080726 WellsFargo.pdf",
    r"C:\Users\Home\Documents\budgeting\captital one.pdf",
    r"C:\Users\Home\Documents\budgeting\Discover-Statement-20260809-8085.pdf",
    r"C:\Users\Home\Downloads\statement-2026-08-18.pdf",
    r"C:\Users\Home\Downloads\August 07.pdf",
    r"C:\Users\Home\Downloads\document.pdf",
    r"C:\Users\Home\Downloads\Aug- 2026-invoice.pdf",
    r"C:\Users\Home\Downloads\list.pdf",
    r"C:\Users\Home\Documents\budgeting\list2.pdf",
    r"C:\Users\Home\Documents\budgeting\list3.pdf",
    r"C:\Users\Home\Downloads\20260826-statements-1417-.pdf",
]

output = []
for item in paths:
    path = Path(item)
    output.append(f"\n===== {path.name} =====")
    if not path.exists():
        output.append("MISSING")
        continue
    try:
        reader = PdfReader(path)
        output.append(f"Pages: {len(reader.pages)}")
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            output.append(f"--- PAGE {i+1} ---")
            output.append(text[:14000])
    except Exception as exc:
        output.append(f"ERROR: {type(exc).__name__}: {exc}")

Path(r"C:\Users\Home\Documents\Codex\2026-08-29\help\work\statement_extract.txt").write_text("\n".join(output), encoding="utf-8")
