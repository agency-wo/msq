/**
 * Gift codes: typed into Settings, each pays its gift once per save (the save
 * remembers which were redeemed). There is no server: a code is just a key
 * into this table, so a gift reaches whichever device the code is typed on,
 * home-screen app or browser alike.
 */

export interface GiftDef {
  gold: number;
  /** Shown when it is redeemed. */
  note: string;
}

export const GIFT_CODES: Readonly<Record<string, GiftDef>> = {
  KAISER900K: { gold: 900_000, note: 'The Wandenreich’s treasury opens to its Emperor' },
};

/** A typed code as the table keys it: capitals and digits only, so "kaiser 900k" works too. */
export function normalizeGiftCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
