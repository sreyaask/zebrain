"use client";

import { useId, useState } from "react";
import { Textarea } from "@/components/ui/Input";
import { PagePreview } from "@/components/ui/PagePreview";
import { parseCsv } from "./csv";
import { personalise, type OrderDraft } from "./types";

/** Business mail: CSV recipient list plus a message template with {name} and {company}. */
export function BulkStep({
  draft,
  update,
  errors,
}: {
  draft: OrderDraft;
  update: (patch: Partial<OrderDraft>) => void;
  errors: { message?: string; recipients?: string };
}) {
  const inputId = useId();
  const [fileError, setFileError] = useState<string | null>(null);
  const csv = draft.csv;
  const col = (name: string) => csv?.columns.find((c) => c.toLowerCase() === name);
  const firstRow = csv?.rows[0];
  const first = firstRow ? { name: firstRow[col("name") ?? csv!.columns[0]], company: col("company") ? firstRow[col("company")!] : "" } : {};

  const onFile = async (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") return setFileError("Upload a .csv file. In Excel or Google Sheets: File → Download → CSV.");
    if (file.size > 2 * 1024 * 1024) return setFileError("That file is larger than 2 MB. Split it into smaller lists.");
    const { columns, rows } = parseCsv(await file.text());
    if (!columns.length || !rows.length) return setFileError("We couldn't find any rows. The first row should be column names, such as name, company, address.");
    if (!columns.some((c) => c.toLowerCase() === "name")) return setFileError('Add a column called "name" so we know who each note is for.');
    if (rows.length > 2000) return setFileError("Up to 2,000 recipients per order. Split larger lists into several orders.");
    update({ csv: { fileName: file.name, columns, rows } });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-ink">Recipient list (CSV)</p>
          <div className="mt-2 rounded-xl border border-dashed border-ink/20 bg-surface p-5">
            {csv ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">
                  <span className="font-medium text-ink">{csv.fileName}</span>
                  <span className="text-muted"> · {csv.rows.length} recipients · columns: {csv.columns.join(", ")}</span>
                </p>
                <button type="button" onClick={() => update({ csv: null })} className="rounded text-sm text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  Remove
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-muted">Columns: name (required), company, address. One row per note.</p>
                <label
                  htmlFor={inputId}
                  className="mt-3 inline-flex h-10 cursor-pointer items-center rounded-xl border border-line bg-paper px-4 text-sm font-medium text-ink hover:border-ink/30 focus-within:ring-2 focus-within:ring-accent"
                >
                  Choose CSV file
                  <input id={inputId} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </div>
            )}
          </div>
          {(fileError || errors.recipients) && (
            <p className="mt-2 text-sm text-danger" role="alert">{fileError ?? errors.recipients}</p>
          )}
          {csv && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[420px] text-left text-sm">
                <caption className="sr-only">First rows of your list</caption>
                <thead className="border-b border-line text-xs text-muted">
                  <tr>{csv.columns.map((c) => <th key={c} scope="col" className="px-3 py-2 font-medium">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {csv.rows.slice(0, 4).map((r, i) => (
                    <tr key={i}>{csv.columns.map((c) => <td key={c} className="px-3 py-2 text-ink">{r[c]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              {csv.rows.length > 4 && <p className="border-t border-line px-3 py-2 text-xs text-muted">and {csv.rows.length - 4} more</p>}
            </div>
          )}
        </div>
        <Textarea
          label="Message template"
          rows={7}
          value={draft.message}
          onChange={(e) => update({ message: e.target.value })}
          placeholder={"Hi {name},\nThank you for choosing us at {company}. It's been a pleasure working with you.\nRahul, Founder"}
          hint="{name} and {company} are filled in from your list for each note. We'll send you a photo of the first note to approve."
          error={errors.message}
        />
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="mx-auto max-w-[260px] rounded-xl border border-line bg-paper p-5">
          <PagePreview
            text={draft.message.trim() ? personalise(draft.message, first) : "Your message appears here, in your handwriting."}
            paper={draft.paper}
            layout={{ ...draft.layout, lineSpacing: draft.layout.pageSize === "a6" ? 1.05 : draft.layout.lineSpacing }}
            caption={first.name ? `Note for ${first.name}` : "Preview"}
          />
        </div>
      </div>
    </div>
  );
}
