import { buildLayout } from '../../site';

export function renderAdminContracts(user: any) {
  const contractTemplates = [
    { id: 'tmpl-1', name: '标准租赁合同模板', content: '这是默认合同模板内容，包含租赁条款、押金及租期信息。' },
  ];
  const currentTemplate = contractTemplates.length > 0 ? contractTemplates[0] : { id: 'new', name: '默认模板', content: '' };

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
              <label for="templateContent">模板内容</label>
              <textarea id="templateContent" name="templateContent" rows="20" class="form-control">${currentTemplate.content}</textarea>
              <small class="form-text text-muted">在实际前端中，此区域可集成富文本编辑器（如 TinyMCE, CKEditor）。</small>
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
      document.getElementById('contractTemplateForm').addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const newTemplate = {
          id: '${currentTemplate.id}', // 假设是编辑现有模板或创建新模板
          name: formData.get('templateName'),
          content: formData.get('templateContent'),
        };
        // 假设 updateContractTemplate 是一个异步函数，通过 API 调用更新后端模板
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