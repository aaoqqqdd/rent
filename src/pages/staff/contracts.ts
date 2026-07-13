import { buildLayout, getAllContracts, getOrderById, getUserById } from '../../site';

export function renderStaffContracts(user: any) {
  const allContracts = getAllContracts(); // 假设有一个函数获取所有合同

  const body = `
    <div class="panel">
      <div class="section-title"><h2>合同管理</h2><span class="section-note">管理所有租赁合同的签署状态和文件。</span></div>

      ${allContracts.length > 0 ? `
        <table class="table">
          <thead>
            <tr>
              <th>合同编号</th>
              <th>订单编号</th>
              <th>客户</th>
              <th>状态</th>
              <th>签署日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${allContracts.map(contract => {
              const order = getOrderById(contract.rentalId);
              const customer = order ? getUserById(order.userId) : null;
              return `
                <tr>
                  <td>${contract.contractNumber}</td>
                  <td>${order?.orderNo ?? 'N/A'}</td>
                  <td>${customer?.name ?? '未知客户'}</td>
                  <td>${contract.status}</td>
                  <td>${contract.signedAt ?? '未签署'}</td>
                  <td>
                    <a class="button button-sm button-secondary" href="/staff/contract/view/${contract.id}">查看</a>
                    ${contract.status === 'pending_sign' ? `<a class="button button-sm button-primary" href="/staff/contract/${contract.id}/remind">提醒签署</a>` : ''}
                    <a class="button button-sm button-info" href="/staff/contract/${contract.id}/upload">上传/更新文件</a>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : '<p>目前没有合同记录。</p>'}
    </div>
  `;

  return buildLayout('合同管理 - 电脑租赁管理系统', body, user);
}