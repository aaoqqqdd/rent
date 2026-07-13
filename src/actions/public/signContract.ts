import { getContractBySignToken, updateOrder, updateUser, users, Order, User, getOrderByOrderNo, getDeviceById, updateContractStatus } from '../../site';
import { nanoid } from 'nanoid';

// 这是一个临时的、内存中的会话存储，用于在签约步骤之间保存用户输入。
// 在生产环境中，应该使用更持久的会话管理机制，例如 Redis 或数据库支持的 session。
const signSessions: Record<string, Record<string, any>> = {};

export function handleSignContractStep(token: string, step: number, body: Record<string, string>): Response {
  const contract = getContractBySignToken(token);
  if (!contract) {
    return new Response('合同链接无效或已过期', { status: 404 });
  }

  // 初始化会话
  if (!signSessions[token]) {
    signSessions[token] = {};
  }

  let redirectUrl = '';
  let errorMessage: string | undefined = undefined;

  try {
    switch (step) {
      case 1:
        // Step 1: 同意协议
        if (!body.agreeTerms) {
          throw new Error('您必须同意租赁协议才能继续。');
        }
        signSessions[token].agreedToTerms = true;
        redirectUrl = `/contract/sign?token=${token}&step=2`;
        break;

      case 2:
        // Step 2: 填写用户信息并创建账户
        if (!signSessions[token].agreedToTerms) {
          throw new Error('请先同意租赁协议。');
        }
        const { name, email, password, passwordConfirm } = body;
        if (!name || !email || !password || !passwordConfirm) {
          throw new Error('姓名、邮箱和密码是必填项。');
        }
        if (password !== passwordConfirm) {
          throw new Error('两次输入的密码不一致。');
        }
        if (users.some(u => u.email === email)) {
          throw new Error('该电子邮箱已被注册。');
        }

        // 保存用户信息到会话
        signSessions[token].userInfo = { ...body };
        redirectUrl = `/contract/sign?token=${token}&step=3`;
        break;

      case 3:
        // Step 3: 选择支付方式并完成签约
        if (!signSessions[token].userInfo) {
          throw new Error('请先填写您的个人信息。');
        }
        const { paymentMethod } = body;
        if (!paymentMethod) {
          throw new Error('请选择一种支付方式。');
        }

        // **核心签约逻辑**
        // 1. 创建用户
        const userInfo = signSessions[token].userInfo;
        const newUserId = `u-${nanoid(8)}`;
        const newUser: User = {
          id: newUserId,
          name: userInfo.name,
          email: userInfo.email,
          password: userInfo.password, // 注意：实际应用中密码需要哈希处理
          role: 'CUSTOMER',
          balance: 0,
          commissionBalance: 0,
          createdAt: new Date().toISOString(),
        };
        users.push(newUser);

        // 2. 更新订单信息
        const order = updateOrder(contract.rentalId, { 
          userId: newUserId,
          paymentMethod: paymentMethod as Order['paymentMethod'],
          status: 'pending_payment' // 等待支付
        });
        
        // 3. 更新合同状态
        updateContractStatus(contract.id, 'signed');
        
        // 4. 清理会话
        delete signSessions[token];

        // 5. 重定向到支付页面或成功页面
        // 这里我们假设支付是下一步，并重定向到一个支付结果页
        redirectUrl = `/payment/result?orderId=${order?.id}&status=success`;
        break;

      default:
        throw new Error('无效的步骤。');
    }
  } catch (e: any) {
    errorMessage = e.message;
    // 如果出错，重定向回当前步骤并显示错误消息
    const stepToRedirect = (step > 1 && step <= 3) ? step : 1;
    redirectUrl = `/contract/sign?token=${token}&step=${stepToRedirect}&error=${encodeURIComponent(errorMessage)}`;
  }

  return new Response(null, {
    status: 302,
    headers: {
      'Location': redirectUrl,
    },
  });
}