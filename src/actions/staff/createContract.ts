import { User, getDeviceById, getUserById, Order, Contract, orders, contracts } from '../../site';
import { nanoid } from 'nanoid';

export function handleCreateContractAction(user: User, body: Record<string, string>): Response {
  const { deviceId, customerId, startDate, endDate } = body;

  if (!deviceId || !customerId || !startDate || !endDate) {
    return new Response('所有字段均为必填项', { status: 400 });
  }

  const device = getDeviceById(deviceId);
  const customer = getUserById(customerId);

  if (!device || device.status !== 'available') {
    return new Response('设备不存在或当前不可用', { status: 400 });
  }

  if (!customer || customer.role !== 'CUSTOMER') {
    return new Response('客户不存在', { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start >= end) {
    return new Response('租赁结束日期必须晚于开始日期', { status: 400 });
  }

  const rentalPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const dailyRate = device.pricePerDay;
  const depositAmount = device.depositAmount;
  const totalAmount = rentalPeriod * dailyRate + depositAmount;

  const orderId = `o-${nanoid(8)}`;
  const contractId = `ct-${nanoid(10)}`;

  const newOrder: Order = {
    id: orderId,
    orderNo: `OR${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}${nanoid(4)}`,
    userId: customerId,
    deviceId: deviceId,
    startDate: startDate,
    endDate: endDate,
    status: 'pending_approval',
    paymentMethod: 'bank_transfer', // 默认为银行转账，后续可让客户选择
    totalAmount: totalAmount,
    depositAmount: depositAmount,
    dailyRate: dailyRate,
    contractId: contractId,
    signedAt: null,
    createdAt: new Date().toISOString(),
  };

  const newContract: Contract = {
    id: contractId,
    rentalId: orderId,
    contractNumber: `CT${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${nanoid(6)}`,
    content: `这是为订单 ${newOrder.orderNo} 自动生成的合同草稿。\n请在签署前仔细核对租赁条款。`,
    status: 'draft',
    signedAt: null,
  };

  // 在实际应用中，这里应该是原子操作
  orders.push(newOrder);
  contracts.push(newContract);
  device.status = 'rented'; // 更新设备状态

  return new Response(null, {
    status: 302,
    headers: {
      'Location': `/staff/contracts/${contractId}`,
    },
  });
}