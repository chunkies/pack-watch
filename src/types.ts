export type ProductType = 'pack' | 'card' | 'graded';

export interface Product {
  productName: string;
  currentPrice: number | null;
  game: string;
  productType: ProductType;
  subType: string;
  site: string;
  url: string;
}

export interface EbayResult {
  lowest: number;
  average: number;
  count: number;
  currency: string;
  searchUrl: string;
}

export interface PriceData {
  ebay: EbayResult | null;
}

export interface Purchase {
  id: string;
  productName: string;
  game: string;
  productType: ProductType;
  subType: string;
  price: number | null;
  site: string;
  url: string;
  date: string;
}

export type ExtMessage =
  | { type: 'FETCH_PRICES'; query: string; productType: ProductType }
  | { type: 'TRACK_PURCHASE'; purchase: Omit<Purchase, 'id' | 'date'> }
  | { type: 'GET_PURCHASES' }
  | { type: 'CLEAR_PURCHASES' };
