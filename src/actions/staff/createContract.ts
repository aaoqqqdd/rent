import { Context } from 'hono';
import { User, getDeviceById, Order, Contract, buildLayout, insertOrder, insertContract, updateDeviceStatus } from '../../site';
import { nanoid } from 'nanoid';

export async function handleCreateContractAction(c: Context, user: User, body: Record<string, string>): Promise<Response> {
  const { deviceId, startDate, endDate, validFrom, validUntil, expiryDuration } = body;

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
    userId: user.id, // 临时用户ID，将在客户签署时更新
    deviceId: deviceId,
    startDate: startDate,
    endDate: endDate,
    rentalPeriod: rentalPeriod, // 添加 rentalPeriod
    status: 'draft',
    paymentMethod: 'bank_transfer',
    totalAmount: totalAmount,
    depositAmount: depositAmount,
    dailyRate: dailyRate,
    contractId: contractId,
    signedAt: null,
    createdAt: new Date().toISOString()
    // created_by 在部分旧代码/表结构中存在，这里与 Order 类型对齐使用 createdAt
    // createdAtBy: user.id,
  } as any;

  // 设置签约链接过期时间，使用用户选择的天数
  const signExpiresDate = new Date();
  const expiryDays = parseInt(expiryDuration) || 7;
  signExpiresDate.setDate(signExpiresDate.getDate() + expiryDays);
  
  const newContract: Contract = {
    id: contractId,
    rentalId: orderId,
    contractNumber: `CT${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${nanoid(6)}`,
    content: `这是为订单 ${newOrder.orderNo} 自动生成的合同草稿。`,
    status: 'pending_sign',
    signedAt: null,
    signToken: signToken,
    createdAt: new Date().toISOString(),
    signExpiresAt: signExpiresDate.toISOString(), // 设置过期时间
    validFrom: validFrom || null, // Add validFrom
    validUntil: validUntil || null, // Add validUntil
    createdBy: user.id, // 记录合同创建人，用于权限控制
  };

  await insertOrder(c, newOrder);
  await insertContract(c, newContract);
  await updateDeviceStatus(c, device.id, 'rented');

  const fullSignUrl = `${new URL(c.req.url).origin}/contract/sign?token=${signToken}`;
  const successPage = `
    <div class="panel">
      <h2>签约链接已生成</h2>
      <p>请将以下链接发送给客户进行签署：</p>
      <div class="alert" style="background:#e0f2fe;border-color:#bae6fd; padding: 16px; border-radius: 8px;">
        <div style="word-break: break-all; margin-bottom: 16px; font-size: 14px; line-height: 1.5;">${fullSignUrl}</div>
        <button id="copy-button" class="button button-primary">复制链接</button>
      </div>
      <div style="margin-top: 24px;">
        <a href="/staff/contracts" class="button">返回合同列表</a>
      </div>
    </div>
    <script>
      document.getElementById('copy-button').addEventListener('click', function() {
        navigator.clipboard.writeText("${fullSignUrl}").then(function() {
          const button = document.getElementById('copy-button');
          button.innerText = '已复制!';
          button.disabled = true;
          setTimeout(function() {
            button.innerText = '复制链接';
            button.disabled = false;
          }, 2000);
        }, function(err) {
          console.error('无法复制链接: ', err);
          alert('复制失败，请手动复制链接');
        });
      });
    </script>`;

  return new Response(buildLayout('签约链接 - 电脑租赁管理系统', successPage, user), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}