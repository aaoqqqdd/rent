/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getContractTemplate, CONTRACT_OPERATIONAL_FIELDS, CONTRACT_COMPUTED_FIELDS } from '../../site';
import { Context } from 'hono';

export async function renderAdminContracts(c: Context, user: any) {
  const currentTemplate = await getContractTemplate(c);
  const safeTemplateName = String(currentTemplate?.name ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeTemplateContent = String(currentTemplate?.content ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
              <input type="text" id="templateName" name="templateName" class="form-control" value="${safeTemplateName}">
            </div>
            <div class="form-group">
              <div style="background: var(--info-light); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--info);">
                <strong style="color: #155e75; display: block; margin-bottom: 12px;">📋 合同模板可用变量（点击变量可复制）：</strong>
                <div style="max-height: 200px; overflow-y: auto;">
                  <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px;">
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
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${company_email}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">公司邮箱</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${customer_name}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">客户填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">承租方姓名</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${customer_phone}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">客户填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">联系电话</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${customer_email}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">客户填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">电子邮箱</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${device_name}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备表</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备名称</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${device_model}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备表</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备型号</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${device_sn}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备表</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">序列号</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${start_date}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">员工填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">租赁起始日</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${end_date}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">员工填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">租赁结束日</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${rental_days}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统计算</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">租赁天数</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${daily_rate}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备表</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">日租金</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${total_rent}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统计算</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">租金总额</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${deposit_amount}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">员工填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">押金金额</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${payment_method}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">客户选择</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">支付方式</td></tr>
                    <tr><td style="padding:6px 12px;font-family:monospace;">\${device_condition}</td><td>员工填写</td><td>出租时设备状况</td></tr>
                    <tr><td style="padding:6px 12px;font-family:monospace;">\${device_accessories}</td><td>员工填写</td><td>配件列表</td></tr>
                    <tr><td style="padding:6px 12px;font-family:monospace;">\${late_fee_per_day}</td><td>员工填写</td><td>每日逾期费用</td></tr>
                    <tr><td style="padding:6px 12px;font-family:monospace;">\${repair_cost}</td><td>员工后续填写</td><td>损坏维修金额</td></tr>
                    <tr><td style="padding:6px 12px;font-family:monospace;">\${pickup_location}</td><td>员工填写</td><td>取货地点</td></tr>
                    <tr><td style="padding:6px 12px;font-family:monospace;">\${return_location}</td><td>员工填写</td><td>归还地点</td></tr>
                    <tr><td style="padding:6px 12px;font-family:monospace;">\${company_abn}</td><td>系统设置</td><td>公司 ABN</td></tr>
                    <tr><td style="padding:6px 12px;font-family:monospace;">\${gst_included}</td><td>系统设置</td><td>是否含 GST</td></tr>
                    <tr><td style="padding:6px 12px;font-family:monospace;">\${esign_ip}</td><td>系统记录</td><td>电子签约 IP</td></tr>
                    <tr><td style="padding:6px 12px;font-family:monospace;">\${esign_device}</td><td>系统记录</td><td>签约设备</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${bank_bsb}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">银行BSB</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${bank_account}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">银行账号</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${account_name}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">账户名</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace;">\${signer_name}</td><td style="padding: 6px 12px;">客户填写</td><td style="padding: 6px 12px;">签署人姓名</td></tr>
                    <tr><td style="padding: 6px 12px; font-family: monospace;">\${sign_time}</td><td style="padding: 6px 12px;">系统记录</td><td style="padding: 6px 12px;">签署时间</td></tr>
                    ${CONTRACT_COMPUTED_FIELDS.map(([name, description]) => `<tr><td style="padding:6px 12px;font-family:monospace;">\${${name}}</td><td>系统自动</td><td>${description}</td></tr>`).join('')}
                    ${CONTRACT_OPERATIONAL_FIELDS.map(([name, description]) => `<tr><td style="padding:6px 12px;font-family:monospace;">\${${name}}</td><td>合同资料</td><td>${description}</td></tr>`).join('')}
                  </tbody>
                </table>
              </div>
              <label for="templateContentEditor">模板内容</label>
              <div id="templateContentEditor" class="quill-editor" style="min-height: 320px; background: #fff; border: 1px solid #d1d5db; border-radius: 8px;">${currentTemplate?.content ?? ''}</div>
              <input type="hidden" id="templateContent" name="templateContent" value="${safeTemplateContent}">
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
      document.addEventListener('DOMContentLoaded', function() {
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

        // 初始化编辑器内容
        const initialContent = document.getElementById('templateContent').value;
        if (initialContent) {
          quill.root.innerHTML = initialContent;
        }

        document.getElementById('contractTemplateForm').addEventListener('submit', function(event) {
          event.preventDefault();
          const contentHtml = quill.root.innerHTML;
          document.getElementById('templateContent').value = contentHtml;

          const formData = new FormData(this);
          const newTemplate = {
            id: '${currentTemplate?.id ?? 'default'}',
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

        // 添加变量复制功能
        document.querySelectorAll('td[style*="font-family: monospace"]').forEach(item => {
          item.style.cursor = 'pointer'; // 添加手型光标
          item.title = '点击复制'; // 添加提示
          item.addEventListener('click', function() {
            const variableName = this.innerText;
            navigator.clipboard.writeText(variableName).then(() => {
              // 简单的视觉反馈
              this.style.backgroundColor = 'var(--primary-light)';
              setTimeout(() => {
                this.style.backgroundColor = '';
              }, 300);
            }).catch(err => {
              console.error('复制失败:', err);
              alert('复制失败，请手动复制。');
            });
          });
        });
      });
    </script>
  `;

  return buildLayout('合同管理 - 电脑租赁管理系统', body, user);
}
