import { defineCapability } from '../define-capability.js';

export const priceCompare = defineCapability({
  id: 'analysis.price.compare',
  version: '1.0.0',
  name: 'Price Comparison',
  description:
    'Compare item prices between two regions — find profitable trade opportunities by checking price differences across markets',
  inputs: {
    item: { type: 'eve.type.reference', description: 'Item to compare' },
    sourceRegion: { type: 'eve.region.reference', description: 'Buy region (source)' },
    targetRegion: { type: 'eve.region.reference', description: 'Sell region (destination)' },
  },
  outputs: {
    priceDifference: {
      type: 'eve.currency.isk',
      description: 'Price difference between regions',
    },
    profitMargin: { type: 'eve.percentage', description: 'Profit margin percentage' },
  },
  source: 'DERIVED',
  dependencies: ['market.orders', 'market.aggregate'],
  auth: { required: false },
  cache: { cacheable: true, defaultTtlSeconds: 300 },
  cost: { estimatedLatencyMs: 1100, esiCallCount: 2 },
});

export const tradeProfit = defineCapability({
  id: 'analysis.trade.profit',
  version: '1.0.0',
  name: 'Trade Profit',
  description:
    'Calculate trade profit — compute revenue minus costs with taxes to determine how much ISK you make on a deal',
  inputs: {
    buyPrice: { type: 'eve.currency.isk', description: 'Price to buy at' },
    sellPrice: { type: 'eve.currency.isk', description: 'Price to sell at' },
    quantity: { type: 'eve.quantity', description: 'Number of items to trade' },
  },
  outputs: {
    profit: { type: 'eve.currency.isk', description: 'Total profit in ISK' },
    margin: { type: 'eve.percentage', description: 'Profit margin percentage' },
  },
  source: 'DERIVED',
  auth: { required: false },
  cache: { cacheable: false },
  cost: { estimatedLatencyMs: 1, esiCallCount: 0 },
});

export const returnOnInvestment = defineCapability({
  id: 'analysis.roi',
  version: '1.0.0',
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
  source: 'DERIVED',
  auth: { required: false },
  cache: { cacheable: false },
  cost: { estimatedLatencyMs: 1, esiCallCount: 0 },
});

export const marketTax = defineCapability({
  id: 'analysis.market.tax',
  version: '1.0.0',
  name: 'Market Tax',
  description:
    'Calculate broker fees and sales tax — deduct market transaction costs from a sale price to find your net revenue',
  inputs: {
    grossAmount: { type: 'eve.currency.isk', description: 'Gross sale amount' },
  },
  outputs: {
    netAmount: {
      type: 'eve.currency.isk',
      description: 'Net amount after tax and broker fees',
    },
    taxPaid: { type: 'eve.currency.isk', description: 'Total taxes and fees deducted' },
  },
  source: 'DERIVED',
  auth: { required: false },
  cache: { cacheable: false },
  cost: { estimatedLatencyMs: 1, esiCallCount: 0 },
});

export const iskPerUnit = defineCapability({
  id: 'analysis.isk.per.unit',
  version: '1.0.0',
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
  source: 'DERIVED',
  auth: { required: false },
  cache: { cacheable: false },
  cost: { estimatedLatencyMs: 1, esiCallCount: 0 },
});
