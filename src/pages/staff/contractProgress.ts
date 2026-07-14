import { buildLayout, getContractById, getOrderById, getUserById } from '../../site';

export function renderStaffContractProgress(user: any, contractId: string) {
  const contract = getContractById(contractId);
  if (!contract) {
    return buildLayout('合同签署进度 - 电脑租赁管理系统', `<div class="panel"><h2>合同未找到</h2><p>指定的合同不存在。</p></div>`, user);
  }

  const order = getOrderById(contract.rentalId);
  const customer = order ? getUserById(order.userId) : null;

  // 客户信息脱敏处理
  const maskedCustomerName = customer ? `${customer.name.charAt(0)}**` : '未知';
  const maskedCustomerEmail = customer ? `${customer.email.substring(0, 3)}***@***.com` : '未知';

  const body = `
    <div class="panel">
      <div class="section-title"><h2>合同签署进度</h2><span class="section-note">合同编号: ${contract.contractNumber}</span></div>

      <div class="contract-progress-header">
        <h3>合同状态: ${
          contract.status === 'signed' ? '已签署' : 
          contract.status === 'cancelled' ? '已取消' :
          contract.status === 'draft' ? '草稿中' :
          '未查看' // pending_sign 状态下显示为未查看
        }</h3>
        <p>创建日期: ${contract.createdAt ? new Date(contract.createdAt).toLocaleString() : '未知'}</p>
        ${contract.signedAt ? `<p>签署日期: ${new Date(contract.signedAt).toLocaleString()}</p>` : ''}
      </div>

      <div class="contract-section">
        <h4>客户信息 (脱敏)</h4>
        <p>姓名: ${maskedCustomerName}</p>
        <p>邮箱: ${maskedCustomerEmail}</p>
      </div>

      <div class="contract-section">
        <h4>签署链接</h4>
        <p>请将以下链接发送给客户进行签署:</p>
        <div class="input-group">
          <input type="text" id="signLink" value="\${window.location.origin}/contract/sign?token=${contract.signToken}" readonly class="form-control">
          <button class="button button-secondary" onclick="copyToClipboard('signLink')">复制链接</button>
        </div>
      </div>

      <div class="contract-actions">
        <a class="button button-primary" href="/staff/contract/view?orderId=${contract.rentalId}">查看合同内容</a>
        <button class="button button-secondary" onclick="window.print()">下载PDF</button>
        <a class="button button-info" href="/staff/contracts">返回合同管理</a>
      </div>
    </div>

    <script>
      function copyToClipboard(elementId) {
        const copyText = document.getElementById(elementId);
        copyText.select();
        copyText.setSelectionRange(0, 99999); // For mobile devices
        document.execCommand("copy");
        alert("签署链接已复制到剪贴板!");
      }
    </script>
  `;

  return buildLayout('合同签署进度 - 电脑租赁管理系统', body, user);
}