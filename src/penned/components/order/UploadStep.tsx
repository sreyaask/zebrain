"use client";

import { Input, Textarea } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Uploader } from "@/components/ui/Uploader";
import type { OrderDraft } from "./types";

interface Props {
  draft: OrderDraft;
  update: (patch: Partial<OrderDraft>) => void;
  error?: string;
}

export function UploadStep({ draft, update, error }: Props) {
  return (
    <div className="space-y-6">
      <Input
        label="Order name"
        optional
        placeholder={draft.product === "journals-gifts" ? "e.g. Amma's Recipes" : "e.g. Chemistry Ch. 2 Notes"}
        value={draft.title}
        onChange={(e) => update({ title: e.target.value })}
        hint="Helps you find it later in My orders."
      />
      <Segmented
        label="What should we write?"
        value={draft.mode}
        onChange={(mode) => update({ mode })}
        options={[
          { value: "files", label: "Upload pages" },
          { value: "text", label: "Type or paste" },
        ]}
      />
      {draft.mode === "files" ? (
        <div className="animate-fade-in">
          <Uploader
            label="Drop photos or a PDF of the pages to copy"
            hint="JPG, PNG, HEIC or PDF · up to 40 files, 20 MB each"
            files={draft.files}
            onAdd={(f) => update({ files: [...draft.files, ...f] })}
            onRemove={(id) => update({ files: draft.files.filter((f) => f.id !== id) })}
            camera
          />
        </div>
      ) : (
        <div className="animate-fade-in">
          <Textarea
            label="Text to write"
            placeholder={"# Heading lines start with a hash\nThen write or paste everything else as normal."}
            value={draft.text}
            onChange={(e) => update({ text: e.target.value })}
            hint={`${draft.text.trim() ? draft.text.trim().split(/\s+/).length : 0} words · start a line with # to make it a heading`}
            rows={10}
          />
        </div>
      )}
      {draft.product === "notes" && (
        <Segmented
          label="Notebook size"
          value={draft.layout.pageSize === "a4" || draft.layout.pageSize === "a5" ? draft.layout.pageSize : "b5"}
          onChange={(pageSize) => update({ layout: { ...draft.layout, pageSize } })}
          options={[
            { value: "b5", label: "Regular (B5)" },
            { value: "a5", label: "Small (A5)" },
            { value: "a4", label: "Large (A4)" },
          ]}
        />
      )}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
