/**
 * Chiffre d'affaires (revenue) helpers.
 *
 * `calculateCA` sums all `income` transactions whose `dateOperation` falls
 * within the [start, end] window (inclusive on both ends).
 *
 * The input type is intentionally permissive (`CATransactionLike`) so this
 * helper accepts:
 *   - rows fetched from drizzle (`Transaction[]` from
 *     `@mytools/shared/schemas/accounting`)
 *   - plain objects shaped from the legacy `expenses` / API responses
 *   - JSON deserialised from network payloads (where `dateOperation` may
 *     arrive as a `string` rather than a `Date`)
 */

export type CATransactionLike = {
  type: string;
  amount: string | number;
  dateOperation: Date | string;
};

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Sum of all income transactions in [start, end].
 *
 * @param transactions any iterable of objects matching `CATransactionLike`
 * @param start period start (inclusive)
 * @param end   period end (inclusive)
 * @returns total amount as a `number` (use a money lib in UI if precision matters)
 */
export function calculateCA(
  transactions: readonly CATransactionLike[],
  start: Date,
  end: Date,
): number {
  const startMs = start.getTime();
  const endMs = end.getTime();
  let total = 0;
  for (const t of transactions) {
    if (t.type !== "income") continue;
    const ms = asDate(t.dateOperation).getTime();
    if (ms < startMs || ms > endMs) continue;
    total += typeof t.amount === "number" ? t.amount : Number(t.amount);
  }
  return total;
}
