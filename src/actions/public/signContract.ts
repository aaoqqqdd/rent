/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { Context } from 'hono';
import { 
  getContractBySignToken, insertUser, updateOrderInDB, Order, User,
  updateContractStatusInDB, hashPassword, logError, getOrCreateSignSession, 
  updateSignSession, deleteSignSession, getUserById, getSystemSettings, getOrderById, getDeviceById,
  getContractVariableData, renderContractVariables, ensureOrderNumber, issueInvoice
} from '../../site';
import { nanoid } from 'nanoid';
import { createStripeCheckout } from '../stripePayments';
import { getStripeRuntimeConfig } from '../../stripe';

export async function handleSignContractStep(c: Context, identifier: string, step: number, body: Record<string, string>): Promise<Response> {
  const token = identifier; // 明确定义 token

  // 记录进入签约流程的日志
  await logError(c, 'DEBUG', `Entering contract signing process`, undefined, { 
    identifier: token, // 使用明确定义的 token
    step, 
    requestBody: Object.keys(body) 
  });

  let contract = await getContractBySignToken(c, token); // 使用明确定义的 token
  if (!contract) {
    await logError(c, 'WARNING', `Contract not found for signing identifier`, undefined, { identifier: token }); // 使用明确定义的 token
    return new Response('合同链接无效或已过期', { status: 404 });
  }

  // 检查合同是否已过期
  const signExpiresAt = contract.signExpiresAt || contract.sign_expires_at;
  if (signExpiresAt && contract.status === 'pending_sign') {
    const now = new Date();
    const expiryDate = new Date(signExpiresAt);
    if (now > expiryDate) {
      await logError(c, 'WARNING', `Contract signing link has expired`, undefined, { 
        token, 
        contractId: contract.id,
        expiresAt: signExpiresAt,
        currentTime: now.toISOString()
      });
      // 将过期合同状态更新为已取消
      await updateContractStatusInDB(c, contract.id, 'cancelled');
      return new Response('合同链接已过期，请联系工作人员重新生成签约链接', { status: 400 });
    }
  }

  // 获取或创建数据库持久化的签约会话
  let signSession: Record<string, any>;
  try {
    signSession = await getOrCreateSignSession(c, token, contract.signToken || token);
  } catch (error) {
    await logError(c, 'ERROR', `Failed to initialize sign session`, error as Error, { token });
    const redirectUrl = `/contract/sign?token=${token}&step=1&error=${encodeURIComponent('系统错误，请稍后重试')}`;
    return new Response(null, {
      status: 302,
      headers: { 'Location': redirectUrl },
    });
  }

  let redirectUrl = '';
  let errorMessage: string | undefined = undefined;

  try {
    switch (step) {
      case 1:
        // Step 1: 同意协议
        await logError(c, 'DEBUG', `Processing step 1: Agreement acceptance`, undefined, { token, body });
        
        if (!body.agreeTerms) {
          await logError(c, 'INFO', `User did not agree to terms`, undefined, { token });
          throw new Error('您必须同意租赁协议才能继续。');
        }
        
        // 更新会话数据
        await updateSignSession(c, token, { agreedToTerms: true });
        await logError(c, 'INFO', `User agreed to terms, proceeding to step 2`, undefined, { token });
        
        redirectUrl = `/contract/sign?token=${token}&step=2`;
        break;

      case 2:
        // Step 2: 填写用户信息并创建账户
        await logError(c, 'DEBUG', `Processing step 2: User information submission`, undefined, { token });
        
        if (!signSession.agreedToTerms) {
          await logError(c, 'WARNING', `User attempted to access step 2 without agreeing to terms`, undefined, { token });
          throw new Error('请先同意租赁协议。');
        }

        const { name, email, password, passwordConfirm, phoneCode, phone, createAccount, referrer, esignSignature } = body;
        
        // 验证必填字段
        if (!name || !email || !phoneCode || !phone || esignSignature?.trim() !== name.trim()) {
          await logError(c, 'INFO', `Missing required fields in step 2`, undefined, { 
            token, 
            hasName: !!name, 
            hasEmail: !!email, 
            hasPhoneCode: !!phoneCode, 
            hasPhone: !!phone 
          });
          throw new Error('请完整填写姓名、邮箱和联系电话；电子签名必须与姓名一致。');
        }
        
        // 如果选择创建账户，密码是必填的
        if (createAccount && (!password || !passwordConfirm)) {
          await logError(c, 'INFO', `Missing password for account creation`, undefined, { token });
          throw new Error('创建账户时密码和确认密码是必填项。');
        }
        
        if (createAccount && password !== passwordConfirm) {
          await logError(c, 'INFO', `Password mismatch in account creation`, undefined, { token });
          throw new Error('两次输入的密码不一致。');
        }
        
        // 验证电话号码格式 - 先清理空格、连字符和国际前缀，再按各国规则校验
        const normalizedPhone = String(phone || '').replace(/\D/g, '');
        let phoneToValidate = normalizedPhone;

        if (phoneCode === '+86') {
          if (normalizedPhone.startsWith('86') && normalizedPhone.length === 13) {
            phoneToValidate = normalizedPhone.slice(2);
          } else if (normalizedPhone.length === 11) {
            phoneToValidate = normalizedPhone;
          } else {
            phoneToValidate = '';
          }
        }
        const phonePatterns: Record<string, RegExp> = {
          '+86': /^1[3-9]\d{9}$/, // 中国：11位，必须以13-19开头
          '+61': /^0\d{9}$/, // 澳大利亚：手机以0开头，共10位
          '+1': /^\d{10}$/, // 美国/加拿大：10位手机号
          '+44': /^7\d{9}$/, // 英国：手机以7开头，共10位
          '+852': /^[5689]\d{7}$/, // 香港：手机以5/6/8/9开头，共8位
          '+853': /^6\d{7}$/, // 澳门：手机以6开头，共8位
          '+886': /^9\d{8}$/, // 台湾：手机以9开头，共9位
          '+65': /^[89]\d{7}$/, // 新加坡：手机以8/9开头，共8位
          '+82': /^1[0-9]\d{7,8}$/, // 韩国：手机以1开头，共9-10位
          '+81': /^[789]0\d{8}$/ // 日本：手机以70/80/90开头，共10位
        };
        
        const pattern = phonePatterns[phoneCode];
        if (pattern && !pattern.test(phoneToValidate)) {
          // 详细的错误提示信息
          const errorMessages: Record<string, string> = {
            '+86': '中国手机号需要11位，必须以13-19开头',
            '+61': '澳大利亚手机号需要10位，必须以0开头',
            '+1': '美国/加拿大手机号需要10位数字',
            '+44': '英国手机号需要10位，必须以7开头',
            '+852': '香港手机号需要8位，必须以5、6、8或9开头',
            '+853': '澳门手机号需要8位，必须以6开头',
            '+886': '台湾手机号需要9位，必须以9开头',
            '+65': '新加坡手机号需要8位，必须以8/9开头',
            '+82': '韩国手机号需要9-10位，必须以1开头',
            '+81': '日本手机号需要10位，必须以70/80/90开头'
          };
          
          await logError(c, 'INFO', `Invalid phone number format`, undefined, { token, phoneCode, phone });
          throw new Error(errorMessages[phoneCode] || '电话号码格式不正确，请检查国家代码和手机号。');
        }
        
        // 从数据库检查邮箱是否已存在
        const existingUser = await c.env.RENT.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
        if (existingUser) {
          await logError(c, 'INFO', `Existing user found with email, will link account`, undefined, { token, email, existingUserId: existingUser.id });
          // 如果邮箱已存在，我们不会立即报错，而是将现有用户的ID存入会话
          // 在步骤3中，我们会用这个ID来关联合同，而不是创建新用户
          await updateSignSession(c, token, { userIdToLink: existingUser.id });
        } else {
          // 仅当用户不存在时，才处理创建账户的逻辑
          if (createAccount && (!password || !passwordConfirm)) {
            await logError(c, 'INFO', `Missing password for new user creation`, undefined, { token });
            throw new Error('创建账户时密码和确认密码是必填项。');
          }
          if (createAccount && password !== passwordConfirm) {
            await logError(c, 'INFO', `Password mismatch for new user creation`, undefined, { token });
            throw new Error('两次输入的密码不一致。');
          }
        }

        // 检查邮箱是否存在，并抛出特定错误以便前端处理
        if (existingUser && !body.force_continue) {
          await logError(c, 'INFO', `Email exists and user not forced to continue, returning EMAIL_EXISTS`, undefined, { token, email });
          throw new Error('该邮箱已注册，请直接登录或使用其他邮箱。');
        }

        // 保存用户信息到会话
        await updateSignSession(c, token, { 
          userInfo: { ...body, phone: phoneToValidate, fullPhone: `${phoneCode}${phoneToValidate}` } 
        });
        await logError(c, 'INFO', `User information saved, proceeding to step 3`, undefined, { token, email });
        
        redirectUrl = `/contract/sign?token=${token}&step=3`;
        break;

      case 3:
        // Step 3: 选择支付方式并完成签约
        await logError(c, 'DEBUG', `Processing step 3: Payment method selection and contract finalization`, undefined, { token });
        
        if (!signSession.userInfo) {
          await logError(c, 'WARNING', `User attempted to access step 3 without providing user info`, undefined, { token });
          throw new Error('请先填写您的个人信息。');
        }
        
        const { paymentMethod } = body;
        const refundMethod = body.refundMethod === 'original' ? 'original' : 'balance'
        const refundBsb = String(body.refundBsb || '').trim()
        const refundAccountNumber = String(body.refundAccountNumber || '').replace(/\s/g, '')
        const refundAccountName = String(body.refundAccountName || '').trim()
        if (!paymentMethod) {
          await logError(c, 'INFO', `No payment method selected in step 3`, undefined, { token });
          throw new Error('请选择一种支付方式。');
        }
        const enabledMethods = [
          ...(getSystemSettings().paymentMethods.stripe ? ['stripe'] : []),
          ...(getSystemSettings().paymentMethods.bankTransfer ? ['bank_transfer'] : []),
          ...(getSystemSettings().paymentMethods.balancePayment ? ['balance'] : []),
        ]
        if (!enabledMethods.includes(paymentMethod)) throw new Error('所选支付方式当前不可用')
        if (paymentMethod === 'stripe') await getStripeRuntimeConfig(c)
        if (paymentMethod === 'bank_transfer' && refundMethod === 'original') {
          if (!/^\d{3}-?\d{3}$/.test(refundBsb) || !/^\d{4,10}$/.test(refundAccountNumber) || !refundAccountName) {
            throw new Error('选择银行原路退款时，请填写正确的账户名、BSB 和银行账号')
          }
        }

        // **核心签约逻辑**
        const userInfo = signSession.userInfo;
        const userIdToLink = signSession.userIdToLink;
        let userId = userIdToLink; // 默认使用已存在的用户ID

        // 1. 如果没有已存在的用户ID，则创建新用户
        if (!userId) {
          const newUserId = `u-${nanoid(8)}`;
          userId = newUserId;
          await logError(c, 'INFO', `Creating new user for contract`, undefined, { token, newUserId, email: userInfo.email });
          
          // 处理推荐人关系
          let referrerId = null;
          if (userInfo.referrer) {
            const normalizedReferrerCode = userInfo.referrer.toUpperCase();
            const referrerUser = await c.env.RENT.prepare('SELECT * FROM users WHERE UPPER(referral_code) = ?').bind(normalizedReferrerCode).first();
            if (referrerUser) {
              referrerId = referrerUser.id;
              await logError(c, 'INFO', `Valid referrer found`, undefined, { token, referrerId, referrerCode: normalizedReferrerCode });
            } else {
              await logError(c, 'INFO', `Invalid referral code provided`, undefined, { token, referrerCode: normalizedReferrerCode });
            }
          }
          
          // 将referrerId保存到会话中，以便后续处理佣金
          await updateSignSession(c, token, { referrerId });
          
          // 仅当用户选择创建账户时才处理密码
          // let password_hash = null;
          // if (userInfo.createAccount && userInfo.password) {
          //   password_hash = await hashPassword(userInfo.password);
          // }
          
          const newUser: User = {
            id: newUserId,
            name: userInfo.name,
            email: userInfo.email,
            password: userInfo.createAccount ? userInfo.password : undefined, // 直接传递 password
            // password_hash: password_hash ?? undefined,
            role: 'CUSTOMER',
            phone: userInfo.fullPhone,
            balance: 0,
            commissionBalance: 0,
            pendingCommission: 0,
            withdrawnCommission: 0,
            referralCode: undefined,
            referrerId: referrerId ?? undefined,
            createdAt: new Date().toISOString(),
            registrationDate: new Date().toISOString(),
          };
          await insertUser(c, newUser);
          await logError(c, 'INFO', `New user created successfully`, undefined, { token, newUserId });
        } else {
          await logError(c, 'INFO', `Linking existing user to contract`, undefined, { token, userId });
        }

        // 2. 更新订单信息
        // 处理余额支付
        let orderStatus: Order['status'] = 'pending_payment';
        if (paymentMethod === 'balance') {
          // 获取用户当前余额
          const user = await c.env.RENT.prepare('SELECT balance FROM users WHERE id = ?').bind(userId).first() as any;
          const currentBalance = user?.balance || 0;
          // 获取订单总金额
          const rental = await c.env.RENT.prepare('SELECT total_amount FROM orders WHERE id = ?').bind(contract.rentalId).first() as any;
          const totalAmount = rental?.total_amount || 0;
          
          if (currentBalance >= totalAmount) {
            // 扣除余额
            await c.env.RENT.prepare(`
              UPDATE users SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).bind(totalAmount, userId).run();
            orderStatus = 'paid'; // 余额支付成功，直接标记为已支付
            await logError(c, 'INFO', `Balance payment processed successfully`, undefined, { token, userId, amount: totalAmount, remainingBalance: currentBalance - totalAmount });
          } else {
            await logError(c, 'WARNING', `Insufficient balance for payment`, undefined, { token, userId, balance: currentBalance, required: totalAmount });
            throw new Error('账户余额不足，无法使用余额支付');
          }
        }

        await updateOrderInDB(c, contract.rentalId, {
          userId: userId,
          paymentMethod: (paymentMethod === 'stripe' ? 'card' : paymentMethod) as Order['paymentMethod'],
          status: orderStatus,
        });
        await c.env.RENT.prepare(`UPDATE orders SET refundMethod = ?, refundBsb = ?, refundAccountNumber = ?, refundAccountName = ? WHERE id = ?`)
          .bind(refundMethod, refundMethod === 'original' ? refundBsb || null : null, refundMethod === 'original' ? refundAccountNumber || null : null, refundMethod === 'original' ? refundAccountName || null : null, contract.rentalId).run()

        if (paymentMethod === 'balance' || paymentMethod === 'bank_transfer') {
          const paymentOrder = await c.env.RENT.prepare('SELECT totalAmount, depositAmount FROM orders WHERE id = ?').bind(contract.rentalId).first() as any
          const paymentTotal = Number(paymentOrder?.totalAmount || 0)
          const paymentDeposit = Number(paymentOrder?.depositAmount || 0)
          await c.env.RENT.prepare(`
            INSERT INTO payments (id, rental_id, customer_id, payment_method, amount, deposit_amount, rental_amount, currency, status, paid_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'AUD', ?, ?)
          `).bind(
            `p-${nanoid(12)}`, contract.rentalId, userId, paymentMethod,
            paymentTotal, paymentDeposit, paymentTotal - paymentDeposit,
            paymentMethod === 'balance' ? 'paid' : 'pending', paymentMethod === 'balance' ? new Date().toISOString() : null
          ).run()
        }
        if (paymentMethod === 'balance') {
          await ensureOrderNumber(c, contract.rentalId)
          await issueInvoice(c, contract.rentalId)
        }
        await logError(c, 'INFO', `Order updated with user and payment method`, undefined, { 
          token, 
          orderId: contract.rentalId, 
          userId, 
          paymentMethod,
          status: orderStatus
        });

        // 3. 更新合同状态
        const esignIp = (c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0] || '').trim().slice(0, 64)
        const esignDevice = (c.req.header('User-Agent') || '').trim().slice(0, 500)
        const browser = /Edg\//.test(esignDevice) ? 'Edge' : /Chrome\//.test(esignDevice) ? 'Chrome' : /Firefox\//.test(esignDevice) ? 'Firefox' : /Safari\//.test(esignDevice) ? 'Safari' : 'Other'
        const os = /Windows/.test(esignDevice) ? 'Windows' : /Mac OS|Macintosh/.test(esignDevice) ? 'macOS' : /Android/.test(esignDevice) ? 'Android' : /iPhone|iPad/.test(esignDevice) ? 'iOS' : /Linux/.test(esignDevice) ? 'Linux' : 'Other'
        const existingData = typeof contract.contract_data === 'string' ? JSON.parse(contract.contract_data || '{}') : (contract.contract_data || {})
        const signerName = String(userInfo.esignSignature || userInfo.name || '').trim()
        const customerInitials = signerName.split(/\s+/).filter(Boolean).map((part: string) => part[0]).join('').toUpperCase().slice(0, 8)
        const signedData = {
          ...existingData,
          signer_name: signerName,
          customer_initials: existingData.customer_initials || customerInitials,
          esign_signature: userInfo.esignSignature,
          esign_browser: browser,
          esign_os: os,
          agreement_version: existingData.agreement_version || '1.0'
        }
        await c.env.RENT.prepare(`UPDATE contracts SET esign_ip = ?, esign_device = ?, contract_data = ? WHERE id = ?`)
          .bind(esignIp || null, esignDevice || null, JSON.stringify(signedData), contract.id).run()
        const signedAt = new Date().toISOString()
        const signedOrder = await getOrderById(c, contract.rentalId)
        const signedDevice = signedOrder ? await getDeviceById(c, signedOrder.deviceId) : null
        const signedCustomer = await getUserById(c, userId)
        const signedContract = { ...contract, contract_data: signedData, esign_ip: esignIp, esign_device: esignDevice, signedAt }
        const signedContent = renderContractVariables(contract.content, signedContract, signedOrder, signedDevice, signedCustomer, signedOrder ? await getContractVariableData(c, signedContract, signedOrder) : {})
        const contentHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signedContent))), byte => byte.toString(16).padStart(2, '0')).join('')
        await c.env.RENT.prepare('UPDATE contracts SET signed_content = ?, content_hash = ? WHERE id = ?').bind(signedContent, contentHash, contract.id).run()
        await updateContractStatusInDB(c, contract.id, 'signed', signedAt);
        await logError(c, 'INFO', `Contract signed successfully`, undefined, { token, contractId: contract.id });

        
        // 4. 如果有推荐人，计算并记录佣金
        const referrerId = signSession.referrerId as string | null;
        const newUserId = userId;

        if (referrerId) {
          await logError(c, 'DEBUG', `Processing referral commission`, undefined, { token, referrerId, newUserId });
          // 获取租赁订单的总金额
          const rental = await c.env.RENT.prepare('SELECT total_amount FROM orders WHERE id = ?').bind(contract.rentalId).first() as any;
          if (rental) {
            // 获取推荐人的分成比例
            const referrer = await c.env.RENT.prepare('SELECT commission_rate FROM users WHERE id = ?').bind(referrerId).first() as any;
            const commissionRate = referrer?.commission_rate || 25.0; // 默认25%
            const commissionAmount = (rental.total_amount * commissionRate) / 100;

            await logError(c, 'INFO', `Calculated commission for referrer`, undefined, { 
              token, 
              referrerId, 
              commissionAmount, 
              commissionRate,
              rentalTotal: rental.total_amount
            });

            // 创建佣金记录 - 使用snake_case列名匹配数据库schema
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
            
            await logError(c, 'INFO', `Commission recorded and referrer balance updated`, undefined, { 
              token, 
              commissionId, 
              referrerId, 
              commissionAmount 
            });
          }
        }
        
        // 5. 清理会话
        await deleteSignSession(c, token);
        await logError(c, 'INFO', `Sign session deleted after successful completion`, undefined, { token });

        if (paymentMethod === 'stripe') {
          const stripeUser = await getUserById(c, userId)
          if (!stripeUser) throw new Error('无法读取付款用户信息')
          return createStripeCheckout(c, stripeUser, contract.rentalId)
        }
        redirectUrl = `/payment/result?orderId=${contract.rentalId}`;
        await logError(c, 'INFO', `Contract signing process completed successfully`, undefined, { 
          token, 
          contractId: contract.id, 
          orderId: contract.rentalId,
          redirectUrl
        });
        break;

      default:
        await logError(c, 'WARNING', `Invalid step encountered`, undefined, { token, step });
        throw new Error('无效的步骤。');
    }
  } catch (e: any) {
    errorMessage = e.message;
    await logError(c, 'ERROR', `Error in contract signing process`, e as Error, { 
      token, 
      step, 
      errorMessage 
    });
    
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
