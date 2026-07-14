import { Context } from 'hono';
import { User, getDeviceById, Order, Contract, buildLayout, insertOrder, insertContract, updateDeviceStatus } from '../../site';
import { nanoid } from 'nanoid';

export async function handleCreateContractAction(c: Context, user: User, body: Record<string, string>): Promise<Response> {
  const { deviceId, startDate, endDate } = body;

  if (!deviceId || !startDate || !endDate) {
    return new Response('设备、开始日期和结束日期均为必填项', { status: 400 });
  }

  const device = getDeviceById(deviceId);

  if (!device || device.status !== 'available') {
    return new Response('设备不存在或当前不可用', { status: 400 });
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
  const signToken = nanoid(32);

  const newOrder: Order = {
    id: orderId,
    orderNo: `OR${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}${nanoid(4)}`,
    userId: 'temp-user', // 临时用户ID，将在客户签署时更新
    deviceId: deviceId,
    startDate: startDate,
    endDate: endDate,
    status: 'pending_approval',
    paymentMethod: 'bank_transfer',
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
    content: `这是为订单 ${newOrder.orderNo} 自动生成的合同草稿。`,
    status: 'pending_sign',
    signedAt: null,
    signToken: signToken,
  };

  await insertOrder(c, newOrder);
  await insertContract(c, newContract);
  await updateDeviceStatus(c, device.id, 'rented');

  const signUrl = `/contract/sign?token=${signToken}`;
  const successPage = `
    <div class="panel">
      <h2>签约链接已生成</h2>
      <p>请将以下链接发送给客户进行签署：</p>
      <div class="alert" style="background:#e0f2fe;border-color:#bae6fd;">
        <a href="${signUrl}" target="_blank">${signUrl}</a>
      </div>
      <p style="margin-top: 16px;">或者，您可以复制下面的链接：</p>
      <input type="text" class="form-control" value="${signUrl}" readonly onclick="this.select();">
      <div style="margin-top: 24px;">
        <a href="/staff/contracts" class="button">返回合同列表</a>
      </div>
    </div>
  `;

  return new Response(buildLayout('签约链接 - 电脑租赁管理系统', successPage, user), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}