export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'Skincare' | 'Makeup' | 'Fragrance' | 'Body Care' | 'Jewelry' | 'Apparel';
  image: string;
  rating: number;
  reviewsCount: number;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export type PaymentMethodType = 'card' | 'netbanking' | 'wallet' | 'upi';

export interface PaymentReceiptInfo {
  gateway: string;
  method: PaymentMethodType;
  transactionId: string;
  maskedInstrument: string;
  status: 'captured' | 'authorized';
  currency: 'INR';
  signatureHash: string;
  authorizedAt: string;
}

export interface Order {
  id: string;
  userId: string;
  customerInfo: {
    name: string;
    email: string;
    address: string;
    phone: string;
  };
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  total: number;
  status: 'placed' | 'processing' | 'shipped' | 'delivered';
  paymentInfo?: PaymentReceiptInfo;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  wishlist?: string[];
}
