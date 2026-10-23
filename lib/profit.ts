export type ProfitInputs = {
  grossSales:number;
  discounts:number;
  refunds:number;
  shippingRevenue:number;
  taxes:number;
  cogs:number;
  fulfillment:number;
  paymentFees:number;
  adSpend:number;
  variableExpenses:number;
};

export function calculateProfit(x:ProfitInputs) {
  const netRevenue = x.grossSales - x.discounts - x.refunds + x.shippingRevenue;
  const contributionProfit = netRevenue - x.cogs - x.fulfillment - x.paymentFees - x.adSpend - x.variableExpenses;
  const contributionMargin = netRevenue > 0 ? contributionProfit / netRevenue : 0;
  const preAdContribution = netRevenue - x.cogs - x.fulfillment - x.paymentFees - x.variableExpenses;
  const breakEvenRoas = preAdContribution > 0 ? netRevenue / preAdContribution : null;
  const maxProfitableAdSpend = Math.max(0, preAdContribution);
  return {netRevenue, contributionProfit, contributionMargin, preAdContribution, breakEvenRoas, maxProfitableAdSpend};
}

export function money(value:number,currency="USD") {
  return new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:2}).format(value||0);
}

export function pct(value:number) {
  return new Intl.NumberFormat("en-US",{style:"percent",maximumFractionDigits:1}).format(value||0);
}
