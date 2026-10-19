import { request } from './api';
import type { Order } from '@/types';

interface OrderListResponse {
  items: Order[];
}

export const OrdersService = {
  async listForUser(token: string): Promise<Order[]> {
    const data = await request<OrderListResponse>('/orders', { token });
    return data.items;
  },
};
