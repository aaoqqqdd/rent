import { buildLayout, getContractTemplate } from '../../site';

export function renderAdminContracts(user: any) {
  const currentTemplate = getContractTemplate();

  const body = `
    <div class="panel">
      <div class="section-title"><h2>合同管理</h2><span class="section-note">管理租赁合同模板、签署状态和归档。</span></div>

      <div class="admin-contract-sections">
        <div class="section">
          <h4>合同模板编辑</h4>
          <p>在这里编辑租赁合同的默认模板。支持富文本编辑（前端需集成编辑器）。</p>
          <form id="contractTemplateForm">
            <div class="form-group">
              <label for="templateName">模板名称</label>
              <input type="text" id="templateName" name="templateName" class="form-control" value="${currentTemplate.name}">
            </div>
            <div class="form-group">
              <div style="background: var(--info-light); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--info);">
                <strong style="color: #155e75; display: block; margin-bottom: 12px;">📋 合同模板可用变量（点击变量可复制）：</strong>
                <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden;">
                  <thead>
                    <tr style="background: var(--primary-light);">
                      <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border);">变量名</th>
                      <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border);">数据来源</th>
                      <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border);">说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${contract_number}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统生成</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">合同编号，如 CT20260715001</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${company_address}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">公司地址</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${company_phone}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">公司电话</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${company_contact}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">公司联系人</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${customer_name}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">客户填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">承租方姓名</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${customer_id}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">客户填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">身份证号或统一社会信用代码</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${customer_address}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">客户填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">联系地址</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${customer_phone}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">客户填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">联系电话</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${customer_email}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">客户填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">电子邮箱</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${device_name}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备表</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备名称</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${device_model}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备表</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备型号</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${device_sn}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备表</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">序列号</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${device_description}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备表</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备配置描述</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${start_date}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">员工填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">租赁起始日</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${end_date}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">员工填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">租赁结束日</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${rental_days}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统计算</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">租赁天数</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${daily_rate}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备表</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">日租金</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${total_rent}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统计算</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">租金总额</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${total_rent_cn}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统计算</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">租金总额大写</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${deposit_amount}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">员工填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">押金金额</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${deposit_amount_cn}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统计算</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">押金金额大写</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${payment_method_desc}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">客户选择</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">支付方式描述</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${payment_deadline}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">付款期限（默认3日）</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${bank_bsb}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">银行BSB</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${bank_account}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">银行Account</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${overdue_rate}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">逾期费率（默认2倍）</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${early_return_penalty}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">提前归还违约金比例</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${penalty_amount}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">违约金金额（默认500）</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace;">\${signer_name}</td><td style="padding: 6px 12px;">客户填写</td><td style="padding: 6px 12px;">签署人姓名</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace;">\${sign_time}</td><td style="padding: 6px 12px;">系统记录</td><td style="padding: 6px 12px;">签署时间</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace;">\${sign_ip}</td><td style="padding: 6px 12px;">系统记录</td><td style="padding: 6px 12px;">签署时IP地址</td></tr>
                  </tbody>
                </table>
              </div>
              <label for="templateContentEditor">模板内容</label>
              <div id="templateContentEditor" class="quill-editor" style="min-height: 320px; background: #fff; border: 1px solid #d1d5db; border-radius: 8px;">${currentTemplate.content}</div>
              <input type="hidden" id="templateContent" name="templateContent" value="${currentTemplate.content.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;')}">
              <small class="form-text text-muted">已集成 Quill 富文本编辑器，可直接格式化合同文本。您可以在模板中使用上面列出的变量，系统会在生成合同时自动替换它们。</small>
            </div>
            <button type="submit" class="button button-primary">保存模板</button>
          </form>
        </div>

        <div class="section">
          <h4>合同签署状态</h4>
          <p>查看所有合同的签署进度和状态。</p>
          <a href="/admin/contracts/signing-status" class="button button-secondary">查看签署状态</a>
        </div>

        <div class="section">
          <h4>合同归档管理</h4>
          <p>管理已完成或已取消的合同归档。</p>
          <a href="/admin/contracts/archive" class="button button-secondary">管理归档</a>
        </div>
      </div>
    </div>

    <script>
      const quill = new Quill('#templateContentEditor', {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['blockquote', 'code-block'],
            [{ color: [] }, { background: [] }],
            ['link', 'clean']
          ]
        }
      });

      const updateContractTemplate = async (template) => {
        const response = await fetch('/admin/contracts/template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(template),
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        return response.json();
      };

      document.getElementById('contractTemplateForm').addEventListener('submit', function(event) {
        event.preventDefault();
        const contentHtml = quill.root.innerHTML;
        document.getElementById('templateContent').value = contentHtml;

        const formData = new FormData(this);
        const newTemplate = {
          id: '${currentTemplate.id}',
          name: formData.get('templateName'),
          content: formData.get('templateContent'),
        };

        updateContractTemplate(newTemplate).then(() => {
          alert('合同模板已保存成功！');
          window.location.reload();
        }).catch(error => {
          alert('保存失败: ' + error.message);
        });
      });
    </script>
  `;

  return buildLayout('合同管理 - 电脑租赁管理系统', body, user);
}