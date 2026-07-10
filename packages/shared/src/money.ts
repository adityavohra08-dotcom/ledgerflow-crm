/** Indian locale money helpers */
export const round2 = (n: number) => Math.round(n * 100) / 100;

export function formatINR(n: number): string {
  return '₹' + round2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function calcGstSplit(taxable: number, rate: number, sellerState: string, placeOfSupply: string) {
  const tax = round2((taxable * rate) / 100);
  const inter = sellerState !== placeOfSupply;
  return inter
    ? { cgst: 0, sgst: 0, igst: tax, total: round2(taxable + tax) }
    : { cgst: round2(tax / 2), sgst: round2(tax / 2), igst: 0, total: round2(taxable + tax) };
}

export const GST_RATES_2026 = [0, 5, 18, 40] as const;