"use client";

import { Textarea } from "@/components/ui/Input";
import { PagePreview } from "@/components/ui/PagePreview";
import { personalise, recipientNames, type OrderDraft } from "./types";

/** Message (with {name}) and a recipient list, one per line, with a preview of the first card. */
export function MessageStep({
  draft,
  update,
  errors,
}: {
  draft: OrderDraft;
  update: (patch: Partial<OrderDraft>) => void;
  errors: { message?: string; recipients?: string };
}) {
  const invites = draft.product === "invitations";
  const names = recipientNames(draft);
  const first = names[0];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <div className="space-y-6">
        <Textarea
          label={invites ? "Invitation text" : "Your message"}
          rows={7}
          value={draft.message}
          onChange={(e) => update({ message: e.target.value })}
          placeholder={
            invites
              ? "Dear {name},\nPlease join us for our housewarming on Sunday, 15 November, at 7 PM.\nThe Reddys"
              : "Dear {name},\nThank you for everything this year.\nWith love, Arjun"
          }
          hint="{name} is replaced with each person's name. Start a line with # for a heading."
          error={errors.message}
        />
        <Textarea
          label={invites ? "Guest list" : "Who is it for?"}
          rows={6}
          value={draft.recipients}
          onChange={(e) => update({ recipients: e.target.value })}
          placeholder={"Amma — Flat 302, Sai Residency, Kondapur\nRavi Uncle\nPriya and Karthik"}
          hint={`One per line. Add an address after a dash to have the envelope addressed. ${names.length} ${names.length === 1 ? (invites ? "invite" : "card") : invites ? "invites" : "cards"}.`}
          error={errors.recipients}
        />
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="mx-auto max-w-[260px] rounded-xl border border-line bg-paper p-5">
          <PagePreview
            text={draft.message.trim() ? personalise(draft.message, { name: first }) : "Your message appears here, in your handwriting."}
            paper={draft.paper}
            layout={{ ...draft.layout, lineSpacing: draft.layout.pageSize === "a6" ? 1.05 : draft.layout.lineSpacing }}
            caption={first ? `Card for ${first}` : "Preview"}
          />
        </div>
      </div>
    </div>
  );
}
