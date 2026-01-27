import Stripe from "stripe";
import { env } from "./env";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

export interface CreditPack {
  id: string;
  credits: number;
  /** Price in SEK öre (cents) */
  price: number;
  currency: "sek";
  label: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "pack_10",
    credits: 10,
    price: 2900,
    currency: "sek",
    label: "10 genereringar – 29 kr",
  },
  {
    id: "pack_25",
    credits: 25,
    price: 5900,
    currency: "sek",
    label: "25 genereringar – 59 kr",
  },
];

export function getCreditPack(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === packId);
}
