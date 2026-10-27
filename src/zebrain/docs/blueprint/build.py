# Builds "Zebrain — The Complete Company Blueprint & Operating Manual" as one PDF.
# Joins parts/*.html, generates the table of contents, renders once with a Chromium browser to find the page of
# every heading, fills those page numbers into the contents, and renders the final PDF.
# Run: python build.py   (needs pypdf, and Brave or Chrome installed)
import glob
import html
import os
import re
import subprocess
import sys

from pypdf import PdfReader

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "Zebrain-Company-Blueprint.pdf")
BROWSERS = ["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]


def strip_tags(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def collect(doc):
    """Contents entries in order: chapters (from dividers) and sections (h2 with an id)."""
    entries = []
    for m in re.finditer(r'<section class="divider" data-ch="([^"]+)">.*?<h1>(.*?)</h1>|<h2 id="([^"]+)"><span class="n">([^<]*)</span>(.*?)</h2>', doc, re.S):
        if m.group(1):
            entries.append({"kind": "ch", "id": f"ch-{m.group(1)}", "no": m.group(1).zfill(2) if m.group(1).isdigit() else m.group(1),
                            "title": strip_tags(m.group(2))})
        else:
            entries.append({"kind": "sub", "id": m.group(3), "no": m.group(4), "title": strip_tags(m.group(5))})
    return entries


def add_markers(doc):
    doc = re.sub(r'(<section class="divider" data-ch="([^"]+)">)', lambda m: f'{m.group(1)}<span class="marker">@@ch-{m.group(2)}@@</span>', doc)
    return re.sub(r'(<h2 id="([^"]+)">)', lambda m: f'{m.group(1)}<span class="marker">@@{m.group(2)}@@</span>', doc)


def toc_html(entries, pages):
    rows = []
    for e in entries:
        pg = pages.get(e["id"], "")
        if e["kind"] == "ch":
            rows.append(f'<li class="ch"><span class="no">{e["no"]}</span><span>{html.escape(e["title"])}</span><span class="dots"></span><span class="pg">{pg}</span></li>')
        elif not e["no"].startswith("A"):  # templates are listed by chapter only, to keep the contents short
            rows.append(f'<li class="sub"><span class="no">{e["no"]}</span><span>{html.escape(e["title"])}</span><span class="dots"></span><span class="pg">{pg}</span></li>')
    return '<section class="page toc"><h2>Contents</h2><ol>' + "".join(rows) + "</ol></section>"


def render(src_html, pdf):
    path = os.path.join(HERE, "_build.html")
    with open(path, "w") as f:
        f.write(src_html)
    browser = next(b for b in BROWSERS if os.path.exists(b))
    subprocess.run([browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw",
                    "--virtual-time-budget=20000", f"--print-to-pdf={pdf}", "file://" + path],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)


def main():
    doc = "".join(open(p).read() for p in sorted(glob.glob(os.path.join(HERE, "parts", "*.html"))))
    entries = collect(doc)
    marked = add_markers(doc)
    # Pass 1: placeholder page numbers of the final width, so the contents take the same space.
    render(marked.replace("<!--TOC-->", toc_html(entries, {e["id"]: "00" for e in entries})), OUT)
    pages, texts = {}, []
    for i, page in enumerate(PdfReader(OUT).pages, start=1):
        text = page.extract_text() or ""
        texts.append(" ".join(text.split()))
        for mid in re.findall(r"@@([\w-]+)@@", text):
            pages.setdefault(mid, i)
    # Fallback when a marker isn't extracted: the heading's number followed by its title, outside the contents pages.
    for e in entries:
        if e["id"] not in pages and e["kind"] == "sub":
            needle = f'{e["no"]} {e["title"][:30]}'
            first = pages.get("ch-1", 1)  # body pages start at chapter 1; earlier pages hold the contents
            hit = next((i for i, t in enumerate(texts, start=1) if i > first and needle in t), None)
            if hit:
                pages[e["id"]] = hit
    missing = [e["id"] for e in entries if e["id"] not in pages]
    # Pass 2: real numbers, markers removed.
    final = doc.replace("<!--TOC-->", toc_html(entries, pages))
    render(final, OUT)
    n = len(PdfReader(OUT).pages)
    print(f"{OUT}\n{n} pages · {len(entries)} contents entries · page numbers missing for: {missing or 'none'}")
    sys.exit(1 if missing else 0)


if __name__ == "__main__":
    main()
