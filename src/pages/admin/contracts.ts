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
              <label for="templateContentEditor">模板内容</label>
              <div id="templateContentEditor" class="quill-editor" style="min-height: 320px; background: #fff; border: 1px solid #d1d5db; border-radius: 8px;">${currentTemplate.content}</div>
              <input type="hidden" id="templateContent" name="templateContent" value="${currentTemplate.content.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;')}">
              <small class="form-text text-muted">已集成 Quill 富文本编辑器，可直接格式化合同文本。</small>
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