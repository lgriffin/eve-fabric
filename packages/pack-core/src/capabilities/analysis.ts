import { defineCapability } from '@eve-fabric/kit';
import { num, round2 } from '../support.js';

const PURE = { estimatedLatencyMs: 1 } as const;

/**
 * Sales tax plus broker fee at base skills, as a fraction of the gross.
 * A stated default, not a fact about any character's skills or standings.
 */
const DEFAULT_TAX_RATE = 0.08;

export const tradeProfit = defineCapability({
  id: 'analysis.trade.profit',
  version: '2.0.0',
  name: 'Trade Profit',
  description:
    'Calculate trade profit — compute revenue minus costs to determine how much ISK you make on a deal',
  inputs: {
    buyPrice: { type: 'eve.currency.isk', description: 'Price to buy at' },
    sellPrice: { type: 'eve.currency.isk', description: 'Price to sell at' },
    quantity: { type: 'eve.quantity', description: 'Number of items to trade' },
  },
  outputs: {
    profit: { type: 'eve.currency.isk', description: 'Total profit in ISK' },
    margin: { type: 'eve.percentage', description: 'Profit margin percentage' },
  },
  cost: PURE,
  run({ buyPrice, sellPrice, quantity }) {
    const buy = num(buyPrice);
    const sell = num(sellPrice);
    const profit = (sell - buy) * num(quantity, 1);
    const margin = sell > 0 ? ((sell - buy) / sell) * 100 : 0;
    return { profit, margin: round2(margin) };
  },
});

export const returnOnInvestment = defineCapability({
  id: 'analysis.roi',
  version: '2.0.0',
  name: 'Return on Investment',
  description:
    'Calculate ROI — compare your initial ISK investment against final revenue to measure how well your money worked',
  inputs: {
    investment: { type: 'eve.currency.isk', description: 'Initial investment in ISK' },
    revenue: { type: 'eve.currency.isk', description: 'Total revenue earned' },
  },
  outputs: {
    roi: { type: 'eve.percentage', description: 'Return on investment percentage' },
    netProfit: { type: 'eve.currency.isk', description: 'Net profit (revenue minus investment)' },
  },
  cost: PURE,
  run({ investment, revenue }) {
    const spent = num(investment);
    const netProfit = num(revenue) - spent;
    const roi = spent > 0 ? (netProfit / spent) * 100 : 0;
    return { roi: round2(roi), netProfit };
  },
});

export const marketTax = defineCapability({
  id: 'analysis.market.tax',
  version: '2.0.0',
  name: 'Market Tax',
  description:
    'Calculate broker fees and sales tax — deduct market transaction costs (8% at base skills) from a sale to find your net revenue',
  inputs: {
    grossAmount: { type: 'eve.currency.isk', description: 'Gross sale amount' },
  },
  outputs: {
    netAmount: { type: 'eve.currency.isk', description: 'Net amount after tax and broker fees' },
    taxPaid: { type: 'eve.currency.isk', description: 'Total taxes and fees deducted' },
  },
  cost: PURE,
  run({ grossAmount }) {
    const gross = num(grossAmount);
    const taxPaid = gross * DEFAULT_TAX_RATE;
    return { netAmount: gross - taxPaid, taxPaid };
  },
});

export const iskPerUnit = defineCapability({
  id: 'analysis.isk.per.unit',
  version: '2.0.0',
  name: 'ISK Per Unit',
  description:
    'Calculate how many items you can buy with a budget — convert an ISK amount to a quantity at a given unit price',
  inputs: {
    budget: { type: 'eve.currency.isk', description: 'Available ISK budget' },
    unitPrice: { type: 'eve.currency.isk', description: 'Price per unit' },
  },
  outputs: {
    quantity: { type: 'eve.quantity', description: 'Number of items you can afford' },
    totalCost: { type: 'eve.currency.isk', description: 'Actual total cost' },
  },
  cost: PURE,
  run({ budget, unitPrice }) {
    const price = num(unitPrice, 1);
    const quantity = price > 0 ? Math.floor(num(budget) / price) : 0;
    return { quantity, totalCost: quantity * price };
  },
});
