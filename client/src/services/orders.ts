import { request } from './api';
import type { Order } from '@/types';

interface OrderListResponse {
  orders: Order[];
}

export const OrdersService = {
  async listForUser(token: string): Promise<Order[]> {
    const data = await request<OrderListResponse>('/orders/buyer', { token });
    return data.orders;
  },
};
