/** Row types for the Penned database (see supabase/migrations). */
import type { DeliveryArea, InkColour, OrderStatus, PageSizeId, PaperId, TimeSlotId } from "./mock";
import type { GlyphSet } from "./engine/types.ts";

export type DbOrderStatus = OrderStatus | "cancelled";
export type HandwritingStatus = "uploaded" | "processing" | "ready" | "needs_rescan";

export interface DbProfile {
  id: string;
  full_name: string;
  phone: string | null;
  role: "customer" | "admin";
}

export interface DbHandwriting {
  id: string;
  user_id: string;
  name: string;
  ink: InkColour;
  status: HandwritingStatus;
  scan_path: string;
  glyph_set: GlyphSet | null;
  missing_chars: string;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOrder {
  id: string;
  code: string;
  user_id: string;
  handwriting_profile_id: string | null;
  title: string;
  status: DbOrderStatus;
  payment_status: "unpaid" | "paid" | "failed" | "refunded";
  source_mode: "files" | "text";
  source_text: string;
  paper: PaperId;
  ink: InkColour;
  page_size: PageSizeId;
  margin_mm: number;
  line_spacing: number;
  heading_style: "underline" | "larger" | "plain";
  copies: number;
  page_count: number;
  billable_units: number;
  unit_price: number;
  writing_amount: number;
  delivery_amount: number;
  total: number;
  receiver_name: string;
  receiver_phone: string;
  address_line1: string;
  area: DeliveryArea;
  pincode: string;
  landmark: string | null;
  time_slot: TimeSlotId;
  pages_written: number;
  rider_name: string | null;
  eta: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  /** 'new' = Penned supplies the notebook (₹120); 'own' = we write in the customer's notebook. */
  notebook_source?: "new" | "own";
  notebook_barcode?: string | null;
  notebook_spec?: { width_mm?: number; height_mm?: number; line_pitch_mm?: number; margin_mm?: number; ruled?: boolean; name?: string } | null;
  notebook_amount?: number;
}

export interface DbOrderFile {
  id: string;
  order_id: string;
  path: string;
  kind: "image" | "pdf";
  pages: number;
}

export interface DbOrderEvent {
  id: number;
  order_id: string;
  status: DbOrderStatus;
  note: string | null;
  created_at: string;
}

export interface DbPlotterJob {
  id: string;
  order_id: string;
  page_count: number;
  svg_path: string;
  gcode_path: string;
  settings: Record<string, unknown>;
  created_at: string;
}

export const statusFlow: OrderStatus[] = ["received", "writing", "quality_check", "out_for_delivery", "delivered"];

export const statusLabel: Record<DbOrderStatus, string> = {
  received: "Received",
  writing: "Writing",
  quality_check: "Quality check",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
