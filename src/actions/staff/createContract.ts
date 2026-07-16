import { Context } from 'hono';
import { User, getDeviceById, Order, Contract, buildLayout, insertOrder, insertContract, updateDeviceStatus } from '../../site';
import { nanoid } from 'nanoid';

export async function handleCreateContractAction(c: Context, user: User, body: Record<string, string>): Promise<Response> {
  const { deviceId, startDate, endDate, validFrom, validUntil } = body;

  if (!deviceId || !startDate || !endDate) {
    return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('设备、开始日期和结束日期均为必填项')}`);
  }

  const device = await getDeviceById(c, deviceId);

  if (!device || device.status !== 'available') {
    return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('设备不存在或当前不可用')}`);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start >= end) {
    return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('租赁结束日期必须晚于开始日期')}`);
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
    // created_by 在部分旧代码/表结构中存在，这里与 Order 类型对齐使用 createdAt
    createdAtBy: user.id,
  } as any;

  const newContract: Contract = {
    id: contractId,
    rentalId: orderId,
    contractNumber: `CT${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${nanoid(6)}`,
    content: `这是为订单 ${newOrder.orderNo} 自动生成的合同草稿。`,
    status: 'pending_sign',
    signedAt: null,
    signToken: signToken,
    validFrom: validFrom || null, // Add validFrom
    validUntil: validUntil || null, // Add validUntil
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
        <span id="sign-url">${signUrl}</span>
        <button id="copy-button" class="button button-primary" style="margin-left: 16px;">复制链接</button>
      </div>
      <div style="margin-top: 24px;">
        <a href="/staff/contracts" class="button">返回合同列表</a>
      </div>
    </div>
    <script>
      document.getElementById('copy-button').addEventListener('click', function() {
        const url = document.getElementById('sign-url').innerText;
        navigator.clipboard.writeText(window.location.origin + url).then(function() {
          const button = document.getElementById('copy-button');
          button.innerText = '已复制!';
          button.disabled = true;
          setTimeout(function() {
            button.innerText = '复制链接';
            button.disabled = false;
          }, 2000);
        }, function(err) {
          console.error('无法复制链接: ', err);
        });
      });
    </script>
    
  `;

  return new Response(buildLayout('签约链接 - 电脑租赁管理系统', successPage, user), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}