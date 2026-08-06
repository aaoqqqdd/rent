/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getContractTemplate, CONTRACT_VARIABLE_GROUPS } from '../../site';
import { Context } from 'hono';

export function renderAdminContractManagement(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title"><div><h2>合同管理</h2><p class="section-note">查看合同签署状态和已归档合同。</p></div><a href="/admin/templates" class="button button-secondary">协议与模板</a></div>
      <div class="admin-contract-sections">
        <div class="section"><h4>合同签署状态</h4><p>查看所有进行中合同的签署进度和状态。</p><a href="/admin/contracts/signing-status" class="button button-secondary">查看签署状态</a></div>
        <div class="section"><h4>合同归档管理</h4><p>管理已完成或已取消的合同归档。</p><a href="/admin/contracts/archive" class="button button-secondary">管理归档</a></div>
      </div>
    </div>`
  return buildLayout('合同管理 - 电脑租赁管理系统', body, user)
}

export async function renderAdminContracts(c: Context, user: any) {
  const currentTemplate = await getContractTemplate(c);
  const safeTemplateName = String(currentTemplate?.name ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeTemplateContent = String(currentTemplate?.content ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const completeVariableIndex = CONTRACT_VARIABLE_GROUPS.map(([group, names]) => `<section class="contract-variable-group"><h5>${group}</h5><div class="variable-chip-list">${names.map(name => `<code>\${${name}}</code>`).join('')}</div></section>`).join('')

  const body = `
    <div class="panel">
      <div class="section-title"><div><a class="breadcrumb-link" href="/admin/templates">← 返回协议与模板</a><h2>编辑正式合同模板</h2><span class="section-note">维护签署完成后生成正式合同所使用的正文。</span></div></div>

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
              <details class="variable-index" open><summary>完整合同变量索引（${CONTRACT_VARIABLE_GROUPS.reduce((total, [, names]) => total + names.length, 0)} 项）</summary>${completeVariableIndex}</details>
              <label for="templateContentEditor">模板内容</label>
              <div id="templateContentEditor" class="quill-editor" style="min-height: 320px; background: #fff; border: 1px solid #d1d5db; border-radius: 8px;"></div>
              <input type="hidden" id="templateContent" name="templateContent" value="${safeTemplateContent}">
              <small class="form-text text-muted">已集成 Quill 富文本编辑器，可直接格式化合同文本。您可以在模板中使用上面列出的变量，系统会在生成合同时自动替换它们。</small>
            </div>
            <button type="submit" class="button button-primary">保存模板</button>
          </form>
        </div>

      </div>
    </div>

    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const quill = window.createRichTextEditor('#templateContentEditor', {
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
          const contentType = response.headers.get('content-type') || '';
          const result = contentType.includes('application/json')
            ? await response.json()
            : { error: '服务器返回了无法识别的响应（HTTP ' + response.status + '）' };
          if (!response.ok) {
            throw new Error(result.error || '合同模板保存失败');
          }
          if (!result.success) throw new Error(result.error || '合同模板保存失败');
          return result.template;
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
        document.querySelectorAll('.variable-chip-list code').forEach(item => {
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
