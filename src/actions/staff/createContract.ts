import { Context } from 'hono';
import { User, getDeviceById, Order, Contract, buildLayout, insertOrder, insertContract, updateDeviceStatus } from '../../site';
import { nanoid } from 'nanoid';

// 自定义nanoid，只使用大写字母和数字，确保合同编号只包含大写字母和数字
const uppercaseAlphanumericNanoid = nanoid.customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);

// 中文拼音首字母映射 - 处理常见中文字符的首字母
const chineseNameInitials: Record<string, string> = {
  // 常见姓氏拼音首字母
  '张':'Z','李':'L','王':'W','刘':'L','陈':'C','杨':'Y','黄':'H','赵':'Z','周':'Z','吴':'W',
  '徐':'X','孙':'S','马':'M','朱':'Z','胡':'H','郭':'G','何':'H','高':'G','林':'L','罗':'L',
  '郑':'Z','谢':'X','梁':'L','宋':'S','唐':'T','许':'X','韩':'H','冯':'F','邓':'D','曹':'C',
  '彭':'P','曾':'Z','肖':'X','田':'T','董':'D','袁':'Y','潘':'P','蔡':'C','蒋':'J','余':'Y',
  '杜':'D','叶':'Y','程':'C','苏':'S','魏':'W','吕':'L','丁':'D','任':'R','沈':'S','姚':'Y',
  '卢':'L','傅':'F','姜':'J','崔':'C','钟':'Z','谭':'T','陆':'L','汪':'W','范':'F','金':'J',
  '艾':'A','古':'G','江':'J','孔':'K','赖':'L','黎':'L','雷':'L','李':'L','梁':'L','廖':'L',
  '凌':'L','刘':'L','柳':'L','龙':'L','卢':'L','鲁':'L','陆':'L','罗':'L','吕':'L','马':'M',
  '孟':'M','莫':'M','倪':'N','宁':'N','潘':'P','裴':'P','彭':'P','蒲':'P','戚':'Q','钱':'Q',
  '乔':'Q','秦':'Q','邱':'Q','裘':'Q','饶':'R','任':'R','沈':'S','施':'S','石':'S','史':'S',
  '水':'S','宋':'S','苏':'S','孙':'S','谭':'T','汤':'T','唐':'T','陶':'T','田':'T','童':'T',
  '万':'W','汪':'W','王':'W','韦':'W','卫':'W','温':'W','文':'W','吴':'W','武':'W','席':'X',
  '夏':'X','肖':'X','谢':'X','辛':'X','邢':'X','徐':'X','许':'X','薛':'X','闫':'Y','严':'Y',
  '颜':'Y','晏':'Y','燕':'Y','杨':'Y','姚':'Y','叶':'Y','易':'Y','尹':'Y','尤':'Y','于':'Y',
  '余':'Y','俞':'Y','虞':'Y','元':'Y','袁':'Y','岳':'Y','云':'Y','臧':'Z','曾':'Z','查':'Z',
  '张':'Z','章':'Z','赵':'Z','郑':'Z','钟':'Z','周':'Z','朱':'Z','庄':'Z','邹':'Z','祖':'Z'
};

// 从中文姓名提取前两个字的拼音首字母
function getNameInitials(name: string): string {
  // 如果姓名长度不足2位，补全默认值
  if (name.length < 2) {
    const char = name[0] || 'X';
    const initial = chineseNameInitials[char] || 'X';
    return (initial + 'X').slice(0, 2);
  }
  
  const firstChar = name[0];
  const secondChar = name[1];
  
  const firstInitial = chineseNameInitials[firstChar] || firstChar.toUpperCase().charAt(0);
  const secondInitial = chineseNameInitials[secondChar] || secondChar.toUpperCase().charAt(0);
  
  return `${firstInitial}${secondInitial}`;
}

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
    orderNo: `OR${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}${uppercaseAlphanumericNanoid().slice(0, 4)}`,
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
  
  // 获取员工姓名首字母
  const userInitials = getNameInitials(user.name);
  // 获取今天的日期
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  // 生成随机3位大写字母数字
  const randomSuffix = uppercaseAlphanumericNanoid().slice(0, 3);
  // 生成符合要求的合同编号：姓名首字母+日期+随机三位
  const contractNumber = `${userInitials}${dateStr}${randomSuffix}`;

  const newContract: Contract = {
    id: contractId,
    rentalId: orderId,
    contractNumber: contractNumber,
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

  const fullSignUrl = `${new URL(c.req.url).origin}/contract/sign?number=${newContract.contractNumber}&step=1`;
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