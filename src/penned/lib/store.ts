"use client";
import type { Order } from "./mock";

/**
 * Orders placed during this demo are kept in localStorage so the
 * tracking and "My orders" screens can show them. Purely client-side.
 */
const KEY = "penned:placed-orders";

export function loadPlacedOrders(): Order[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

export function savePlacedOrder(order: Order): void {
  try {
    const next = [order, ...loadPlacedOrders().filter((o) => o.id !== order.id)];
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the success screen still works */
  }
}

const SESSION = "penned:signed-in";
export function isSignedIn(): boolean {
  try {
    return window.localStorage.getItem(SESSION) === "1";
  } catch {
    return false;
  }
}
export function setSignedIn(v: boolean): void {
  try {
    if (v) window.localStorage.setItem(SESSION, "1");
    else window.localStorage.removeItem(SESSION);
    window.dispatchEvent(new Event("penned:auth"));
  } catch {
    /* ignore */
  }
}
