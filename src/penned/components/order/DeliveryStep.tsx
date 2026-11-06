"use client";

import { Input, Select } from "@/components/ui/Input";
import { RadioCard } from "@/components/ui/RadioCard";
import { deliveryAreas, demoUser, timeSlots, type DeliveryArea, type TimeSlotId } from "@/lib/mock";
import type { DeliveryDetails, OrderDraft } from "./types";

export type DeliveryErrors = Partial<Record<keyof DeliveryDetails, string>>;

export function validateDelivery(d: DeliveryDetails): DeliveryErrors {
  const e: DeliveryErrors = {};
  if (!d.name.trim()) e.name = "Enter the name of the person receiving it.";
  if (!/^[6-9]\d{9}$/.test(d.phone.replace(/\s/g, ""))) e.phone = "Enter a 10-digit Indian mobile number.";
  if (d.addressMode === "new") {
    if (d.line1.trim().length < 5) e.line1 = "Enter a flat or house number and building.";
    if (!d.area) e.area = "Choose your area.";
    if (!/^5\d{5}$/.test(d.pincode)) e.pincode = "Enter a 6-digit Hyderabad pincode, like 500084.";
  }
  if (!d.slot) e.slot = "Choose a delivery time.";
  return e;
}

export function DeliveryStep({
  draft,
  update,
  errors,
}: {
  draft: OrderDraft;
  update: (patch: Partial<OrderDraft>) => void;
  errors: DeliveryErrors;
}) {
  const d = draft.delivery;
  const set = (patch: Partial<DeliveryDetails>) => update({ delivery: { ...d, ...patch } });
  const saved = demoUser.savedAddress;

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="text-sm font-medium text-ink">Deliver to</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <RadioCard
            name="address"
            value="saved"
            checked={d.addressMode === "saved"}
            onChange={() => set({ addressMode: "saved" })}
            title="Saved address"
            description={`${saved.line1}, ${saved.area}, ${saved.city} ${saved.pincode}`}
          />
          <RadioCard
            name="address"
            value="new"
            checked={d.addressMode === "new"}
            onChange={() => set({ addressMode: "new" })}
            title="A different address"
            description="Anywhere in our delivery areas."
          />
        </div>
      </fieldset>

      {d.addressMode === "new" && (
        <div className="grid animate-fade-in gap-4 sm:grid-cols-2">
          <Input
            label="Flat, house no., building"
            autoComplete="address-line1"
            className="sm:col-span-2"
            value={d.line1}
            onChange={(e) => set({ line1: e.target.value })}
            error={errors.line1}
          />
          <Select label="Area" value={d.area} onChange={(e) => set({ area: e.target.value as DeliveryArea })} error={errors.area}>
            <option value="">Choose an area</option>
            {deliveryAreas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
          <Input
            label="Pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            value={d.pincode}
            onChange={(e) => set({ pincode: e.target.value.replace(/\D/g, "") })}
            error={errors.pincode}
          />
          <Input
            label="Landmark"
            optional
            className="sm:col-span-2"
            placeholder="e.g. Opposite Sarath City Mall"
            value={d.landmark}
            onChange={(e) => set({ landmark: e.target.value })}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Receiver's name" autoComplete="name" value={d.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} />
        <Input
          label="Mobile number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          prefix="+91"
          maxLength={11}
          value={d.phone}
          onChange={(e) => set({ phone: e.target.value.replace(/[^\d\s]/g, "") })}
          error={errors.phone}
          hint="The rider calls this number on arrival."
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Delivery time</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {timeSlots.map((s) => (
            <RadioCard
              key={s.id}
              name="slot"
              value={s.id}
              checked={d.slot === s.id}
              onChange={() => set({ slot: s.id as TimeSlotId })}
              title={s.label}
              description={s.hint}
            />
          ))}
        </div>
        {errors.slot && (
          <p className="mt-2 text-sm text-danger" role="alert">
            {errors.slot}
          </p>
        )}
      </fieldset>
    </div>
  );
}
