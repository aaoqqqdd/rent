import { Context } from 'hono';
import { getContractBySignToken, insertUser, updateOrderInDB, Order, User, getDeviceById, updateContractStatusInDB, hashPassword } from '../../site';
import { nanoid } from 'nanoid';

// 这是一个临时的、内存中的会话存储，用于在签约步骤之间保存用户输入。
// 在生产环境中，应该使用更持久的会话管理机制，例如 Redis 或数据库支持的 session。
const signSessions: Record<string, Record<string, any>> = {};

export async function handleSignContractStep(c: Context, token: string, step: number, body: Record<string, string>): Promise<Response> {
  const contract = await getContractBySignToken(c, token);
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
        const { name, email, password, passwordConfirm, phoneCode, phone, createAccount, referrer } = body;
        
        // 验证必填字段
        if (!name || !email || !phoneCode || !phone) {
          throw new Error('姓名、邮箱和联系电话是必填项。');
        }
        
        // 如果选择创建账户，密码是必填的
        if (createAccount && (!password || !passwordConfirm)) {
          throw new Error('创建账户时密码和确认密码是必填项。');
        }
        
        if (createAccount && password !== passwordConfirm) {
          throw new Error('两次输入的密码不一致。');
        }
        
        // 验证电话号码格式
        const phonePatterns: Record<string, RegExp> = {
          '+86': /^1[3-9]\d{9}$/,
          '+61': /^4\d{8}$/,
          '+1': /^\d{10}$/,
          '+44': /^7\d{9}$/,
          '+852': /^[569]\d{7}$/,
          '+886': /^9\d{8}$/,
          '+65': /^[89]\d{7}$/,
          '+82': /^1[0-9]\d{7,8}$/,
          '+81': /^[789]0\d{8}$/
        };
        
        const pattern = phonePatterns[phoneCode];
        if (pattern && !pattern.test(phone)) {
          throw new Error('电话号码格式不正确，请检查国家代码和手机号。');
        }
        
        // 从数据库检查邮箱是否已存在
        const existingUser = await c.env.RENT.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
        if (existingUser) {
          throw new Error('该电子邮箱已被注册。');
        }

        // 保存用户信息到会话
        signSessions[token].userInfo = { ...body, fullPhone: `${phoneCode}${phone}` };
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
        
        // 处理推荐人关系 - 在合同签署时绑定，一旦绑定不可更改，不验证推荐码大小写
        let referrerId = null;
        if (userInfo.referrer) {
          // 将用户输入的推荐码转换为大写，与数据库中存储的大写推荐码匹配
          const normalizedReferrerCode = userInfo.referrer.toUpperCase();
          const referrerUser = await c.env.RENT.prepare('SELECT * FROM users WHERE UPPER(referralCode) = ?').bind(normalizedReferrerCode).first();
          if (referrerUser) {
            referrerId = referrerUser.id;
          }
        }
        
        // 只有当用户选择创建账户时才处理密码
        let password_hash = null;
        if (userInfo.createAccount && userInfo.password) {
          password_hash = await hashPassword(userInfo.password);
        }
        
        const newUser: User = {
          id: newUserId,
          name: userInfo.name,
          email: userInfo.email,
          password_hash: password_hash,
          role: 'CUSTOMER',
          phone: userInfo.fullPhone,
          balance: 0,
          commissionBalance: 0,
          pendingCommission: 0,
          withdrawnCommission: 0,
          referralCode: null,
          referrer_id: referrerId, // 绑定推荐人，一旦设置不可更改
          createdAt: new Date().toISOString(),
          registrationDate: new Date().toISOString(),
        };
        await insertUser(c, newUser);

        // 2. 更新订单信息
        const order = await updateOrderInDB(c, contract.rentalId, {
          userId: newUserId,
          paymentMethod: paymentMethod as Order['paymentMethod'],
          status: 'pending_payment', // 等待支付
          referrer_id: referrerId, // 在这里同步推荐人ID
        });

        // 3. 更新合同状态
        await updateContractStatusInDB(c, contract.id, 'signed');
        
        // 4. 如果有推荐人，计算并记录佣金
        if (referrerId) {
          // 获取租赁订单的总金额
          const rental = await c.env.RENT.prepare('SELECT total_amount FROM rentals WHERE id = ?').bind(contract.rentalId).first();
          if (rental) {
            // 获取推荐人的分成比例
            const referrer = await c.env.RENT.prepare('SELECT commission_rate FROM users WHERE id = ?').bind(referrerId).first();
            const commissionRate = referrer?.commission_rate || 25.0; // 默认25%
            const commissionAmount = (rental.total_amount * commissionRate) / 100;
            
            // 创建佣金记录
            const commissionId = `c-${nanoid(8)}`;
            await c.env.RENT.prepare(`
              INSERT INTO commission_records (id, referrer_id, rental_id, customer_id, amount, rate, status)
              VALUES (?, ?, ?, ?, ?, ?, 'pending')
            `).bind(commissionId, referrerId, contract.rentalId, newUserId, commissionAmount, commissionRate).run();
            
            // 更新推荐人的佣金余额
            await c.env.RENT.prepare(`
              UPDATE users SET commission_balance = commission_balance + ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).bind(commissionAmount, referrerId).run();
          }
        }
        
        // 5. 清理会话
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
    redirectUrl = `/contract/sign?token=${token}&step=${stepToRedirect}&error=${encodeURIComponent(errorMessage || '')}`;
  }

  return new Response(null, {
    status: 302,
    headers: {
      'Location': redirectUrl,
    },
  });
}