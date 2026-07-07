import { queryAI, getSavedApiKey, saveApiKey, getSavedModel, saveModel } from './ai.js';
import { authService, dbService } from './supabase.js';

// Application State
let chatHistory = [
  { role: 'system', text: 'Hello! I am your AI Employee Copilot. How can I assist you with your administrative tasks, emails, scheduling, or documentation today?' }
];

let kanbanCards = [];

let metricsState = {
  timeSaved: parseFloat(localStorage.getItem('metrics_timeSaved')) || 0,
  tasksExecuted: parseInt(localStorage.getItem('metrics_tasksExecuted')) || 0,
  activeAutomations: parseInt(localStorage.getItem('metrics_activeAutomations')) || 0
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initAuth();

  // Clear any stale metric values from previous sessions so counters start from 0
  localStorage.removeItem('metrics_timeSaved');
  localStorage.removeItem('metrics_tasksExecuted');
  localStorage.removeItem('metrics_activeAutomations');
  // Reset in-memory state to 0
  metricsState.timeSaved = 0;
  metricsState.tasksExecuted = 0;
  metricsState.activeAutomations = 0;

  initNavigation();
  initSettings();
  initChat();
  initDrafts();
  initDocGen();
  initKanban();
  initMoM();
  initGlobalSearch();
  initRealTimeClock();
  initCustomerSupport();
  initPersonalizationChips();
  initKnowledgeAssistant();
  updateDashboardMetrics();
  
  // Refresh UI badges & status
  updateSystemStatus();
  
  // Initialize Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

/**
 * 1. View Routing & Navigation
 */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  
  function switchTab(tabId) {
    navItems.forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    viewPanels.forEach(panel => {
      if (panel.id === `view-${tabId}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });
    
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Quick Action Buttons on Dashboard
  document.querySelectorAll('.quick-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      if (action === 'go-chat') switchTab('chat');
      if (action === 'go-drafts') switchTab('drafts');
      if (action === 'go-docgen') switchTab('docgen');
      if (action === 'go-mom') switchTab('mom');
    });
  });
}

/**
 * 2. Settings Modal Configuration
 */
function initSettings() {
  const modal = document.getElementById('settings-modal');
  const openBtn = document.getElementById('open-settings-btn');
  const closeBtn = document.getElementById('close-settings-btn');
  const cancelBtn = document.getElementById('cancel-settings-btn');
  const saveBtn = document.getElementById('save-settings-btn');
  
  const apiKeyInput = document.getElementById('settings-api-key');
  const modelSelect = document.getElementById('settings-model');
  const toggleVisibilityBtn = document.getElementById('toggle-key-visibility');

  const supabaseUrlInput = document.getElementById('settings-supabase-url');
  const supabaseAnonKeyInput = document.getElementById('settings-supabase-anon-key');
  const toggleSupabaseVisibilityBtn = document.getElementById('toggle-supabase-key-visibility');

  // Open
  openBtn.addEventListener('click', () => {
    apiKeyInput.value = getSavedApiKey();
    modelSelect.value = getSavedModel();

    const sbConfig = authService.getSupabaseConfig();
    supabaseUrlInput.value = sbConfig.url || '';
    supabaseAnonKeyInput.value = sbConfig.anonKey || '';

    modal.classList.add('active');
  });

  // Close Helpers
  const closeModal = () => modal.classList.remove('active');
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  
  // Toggle visibility
  toggleVisibilityBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    const iconName = isPassword ? 'eye-off' : 'eye';
    toggleVisibilityBtn.innerHTML = `<i data-lucide="${iconName}"></i>`;
    if (window.lucide) window.lucide.createIcons();
  });

  toggleSupabaseVisibilityBtn.addEventListener('click', () => {
    const isPassword = supabaseAnonKeyInput.type === 'password';
    supabaseAnonKeyInput.type = isPassword ? 'text' : 'password';
    const iconName = isPassword ? 'eye-off' : 'eye';
    toggleSupabaseVisibilityBtn.innerHTML = `<i data-lucide="${iconName}"></i>`;
    if (window.lucide) window.lucide.createIcons();
  });

  // Save Settings
  saveBtn.addEventListener('click', () => {
    saveApiKey(apiKeyInput.value.trim());
    saveModel(modelSelect.value);

    authService.saveSupabaseConfig({
      url: supabaseUrlInput.value.trim(),
      anonKey: supabaseAnonKeyInput.value.trim()
    });

    closeModal();
    updateSystemStatus();
    showToast('Settings Saved', 'System configuration updated successfully. Reloading page to apply database connections...', 'success');
    
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  });
}

function updateSystemStatus() {
  const apiKey = getSavedApiKey();
  const model = getSavedModel();
  
  const statusBadge = document.getElementById('api-status');
  const activeModelDisplay = document.getElementById('active-model-display');
  const activeModeDisplay = document.getElementById('active-mode-display');
  const setupTipBox = document.getElementById('setup-tip-box');
  
  activeModelDisplay.textContent = model;
  
  if (apiKey) {
    statusBadge.className = 'api-status-badge key-configured';
    statusBadge.querySelector('.status-text').textContent = 'Live Workspace AI';
    activeModeDisplay.textContent = 'Live Cloud Model';
    activeModeDisplay.className = 'info-val highlight-green';
    if (setupTipBox) {
      setupTipBox.style.display = 'none';
    }
  } else {
    statusBadge.className = 'api-status-badge key-missing';
    statusBadge.querySelector('.status-text').textContent = 'Simulated Mode';
    activeModeDisplay.textContent = 'Simulation (Keyless)';
    activeModeDisplay.className = 'info-val highlight-green';
    if (setupTipBox) {
      setupTipBox.style.display = 'flex';
    }
  }
}

/**
 * Helper: Markdown Renderer
 */
function parseMarkdown(text) {
  let html = text;
  
  // Escape html characters to prevent script injections
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Alert Blocks (GitHub Style)
  html = html.replace(/&gt;\s*\[!WARNING\]\s*\n([\s\S]*?)(?=\n\n|\n*$)/g, '<div class="md-output"><blockquote class="warning-alert" style="border-left:4px solid var(--color-red); background:rgba(255,23,68,0.06); padding:8px 16px;"><strong>Warning</strong><br>$1</blockquote></div>');
  html = html.replace(/&gt;\s*\[!NOTE\]\s*\n([\s\S]*?)(?=\n\n|\n*$)/g, '<div class="md-output"><blockquote class="note-alert" style="border-left:4px solid var(--color-blue); background:rgba(0,176,255,0.06); padding:8px 16px;"><strong>Note</strong><br>$1</blockquote></div>');

  // Headers
  html = html.replace(/^#\s+(.*?)$/gm, '<h1>$1</h1>');
  html = html.replace(/^##\s+(.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^###\s+(.*?)$/gm, '<h3>$1</h3>');

  // Bold / Strong
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Tables
  const lines = html.split('\n');
  let inTable = false;
  let tableHtml = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (!inTable) {
        inTable = true;
        tableHtml += '<table><thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
        // check next line for table separators (e.g. |---|---|)
        if (i + 1 < lines.length && lines[i + 1].includes('---') && lines[i + 1].trim().startsWith('|')) {
          i++; // skip
        }
      } else {
        tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
      }
    } else {
      if (inTable) {
        inTable = false;
        tableHtml += '</tbody></table>';
        lines[i] = tableHtml + '\n' + lines[i];
        tableHtml = '';
      }
    }
  }
  if (inTable) {
    tableHtml += '</tbody></table>';
    lines.push(tableHtml);
  }
  html = lines.join('\n');

  // Blockquotes
  html = html.replace(/^&gt;\s*(.*?)$/gm, '<blockquote>$1</blockquote>');

  // Unordered list items
  html = html.replace(/^\*\s+(.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, ''); // Clean consecutive ul groupings

  // Preformatted code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Paragraph wrapping for text rows that are not HTML structures
  html = html.split('\n').map(line => {
    const trimL = line.trim();
    if (!trimL) return '';
    if (trimL.startsWith('<h') || trimL.startsWith('<ul') || trimL.startsWith('<li') || trimL.startsWith('<table') || trimL.startsWith('<tr') || trimL.startsWith('<blockquote') || trimL.startsWith('<div') || trimL.startsWith('<pre') || trimL.startsWith('</')) {
      return line;
    }
    return `<p>${line}</p>`;
  }).join('');

  return `<div class="md-output">${html}</div>`;
}

/**
 * 3. AI Chat Assistant
 */
function initChat() {
  const chatHistoryBox = document.getElementById('chat-history-box');
  const chatInputText = document.getElementById('chat-input-text');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const templateChips = document.querySelectorAll('.template-chip');

  function renderChat() {
    chatHistoryBox.innerHTML = '';
    chatHistory.forEach(msg => {
      const msgDiv = document.createElement('div');
      msgDiv.className = `chat-msg ${msg.role === 'user' ? 'user' : 'system'}`;
      
      const avatarIcon = msg.role === 'user' ? 'user' : 'bot';
      msgDiv.innerHTML = `
        <div class="msg-avatar"><i data-lucide="${avatarIcon}"></i></div>
        <div class="msg-content">
          ${parseMarkdown(msg.text)}
        </div>
      `;
      chatHistoryBox.appendChild(msgDiv);
    });
    
    // Scroll to bottom
    chatHistoryBox.scrollTop = chatHistoryBox.scrollHeight;
    if (window.lucide) window.lucide.createIcons();
  }

  function updateQuickPrompts(lastQuery) {
    const templatesContainer = document.querySelector('.prompt-templates');
    if (!templatesContainer) return;

    const queryLower = lastQuery.toLowerCase();
    let newTemplates = [];

    // Analyze keywords in the query to provide contextual prompts
    if (queryLower.includes('education') || queryLower.includes('school') || queryLower.includes('student') || queryLower.includes('learn') || queryLower.includes('curriculum')) {
      newTemplates = [
        { name: 'AI Course Syllabus', prompt: 'Outline an introductory AI and ML curriculum layout for undergraduate students.' },
        { name: 'Lesson Plan Example', prompt: 'Create a lesson plan with real-world examples for teaching data structures.' },
        { name: 'Study Guide Draft', prompt: 'Draft a study guide for computer networks focusing on TCP/IP protocols.' }
      ];
    } else if (queryLower.includes('marketing') || queryLower.includes('sales') || queryLower.includes('social') || queryLower.includes('campaign') || queryLower.includes('brand')) {
      newTemplates = [
        { name: 'Product Launch Copy', prompt: 'Write an attention-grabbing social media copy structure for a product launch.' },
        { name: 'Email Campaign Outline', prompt: 'Create a series of 3 cold emails pitching workspace automation tools to SaaS startups.' },
        { name: 'Ad Campaign Copy', prompt: 'Draft Google Ad headlines and descriptions highlighting 40% time savings.' }
      ];
    } else if (queryLower.includes('invoice') || queryLower.includes('bill') || queryLower.includes('finance') || queryLower.includes('money') || queryLower.includes('cost')) {
      newTemplates = [
        { name: 'Late Payment Reminder', prompt: 'Draft a polite but firm formal email reminder for a payment overdue by 15 days.' },
        { name: 'Consulting Fee Sheet', prompt: 'Outline a standard billing sheet for operations and cloud consulting services.' },
        { name: 'Net-45 Policy Inquiry', prompt: 'Write an email requesting a client to align with our standard Net-45 billing terms.' }
      ];
    } else if (queryLower.includes('meeting') || queryLower.includes('mom') || queryLower.includes('minutes') || queryLower.includes('sync') || queryLower.includes('discuss')) {
      newTemplates = [
        { name: 'Action Items Email', prompt: 'Draft a follow-up email summarizing the meeting decisions and listing actions with owners.' },
        { name: 'Sprint Planning Agenda', prompt: 'Create a structured agenda for our upcoming 1-hour sprint planning meeting.' },
        { name: 'Daily Standup Format', prompt: 'Design an efficient daily standup reporting format for a remote engineering team.' }
      ];
    } else if (queryLower.includes('task') || queryLower.includes('kanban') || queryLower.includes('todo') || queryLower.includes('workflow') || queryLower.includes('prioritize')) {
      newTemplates = [
        { name: 'Task Board Strategy', prompt: 'Outline how to set up an autonomous task board with WIP limits for Operations.' },
        { name: 'Bottleneck Resolution', prompt: 'Write a workflow correction checklist to handle code review bottlenecks.' },
        { name: 'Prioritization Rules', prompt: 'Explain the difference between urgent and important tasks in weekly planning.' }
      ];
    } else if (queryLower.includes('ppt') || queryLower.includes('slide') || queryLower.includes('presentation') || queryLower.includes('deck')) {
      newTemplates = [
        { name: 'Investor Deck Outline', prompt: 'Outline a 10-slide investor pitch deck structure for our AI Copilot startup.' },
        { name: 'Product Demo Slide Outline', prompt: 'Create a slide copy layout for a 5-minute product demonstration.' },
        { name: 'Technical Slide Copy', prompt: 'Draft slides explaining how our API gateway secures tool executions.' }
      ];
    } else {
      // Default / General Assistant context
      newTemplates = [
        { name: 'Weekly Marketing Summary', prompt: 'Draft a weekly summary email for our marketing goals.' },
        { name: 'Invoice Net-30 Help', prompt: 'How do I set up a Net-30 payment term invoice?' },
        { name: 'Project Launch Checklist', prompt: 'Create a brief project checklist for launching our app.' }
      ];
    }

    // Render new chips
    templatesContainer.innerHTML = '';
    newTemplates.forEach(tpl => {
      const chipBtn = document.createElement('button');
      chipBtn.className = 'template-chip';
      chipBtn.setAttribute('data-prompt', tpl.prompt);
      chipBtn.textContent = tpl.name;
      chipBtn.addEventListener('click', () => {
        chatInputText.value = tpl.prompt;
        chatInputText.focus();
      });
      templatesContainer.appendChild(chipBtn);
    });
  }

  async function handleSend() {
    const query = chatInputText.value.trim();
    if (!query) return;
    
    // Add user message
    chatHistory.push({ role: 'user', text: query });
    chatInputText.value = '';
    renderChat();
    
    // Dynamically update prompt suggestions based on user context
    updateQuickPrompts(query);

    // Typing indicator placeholder
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-msg system typing';
    typingDiv.innerHTML = `
      <div class="msg-avatar"><i data-lucide="bot"></i></div>
      <div class="msg-content">
        <p>Nexus is preparing details...</p>
      </div>
    `;
    chatHistoryBox.appendChild(typingDiv);
    chatHistoryBox.scrollTop = chatHistoryBox.scrollHeight;
    if (window.lucide) window.lucide.createIcons();

    // Get Persona
    const personaInput = document.querySelector('input[name="chat-persona"]:checked');
    const persona = personaInput ? personaInput.value : 'general';

    // Query
    const responseText = await queryAI('chat', { message: query, persona: persona });
    
    // Remove typing, append response
    chatHistory.push({ role: 'system', text: responseText });
    renderChat();
    updateDashboardMetrics('chat');
  }

  chatSendBtn.addEventListener('click', handleSend);
  chatInputText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Bind initial chips
  templateChips.forEach(chip => {
    chip.addEventListener('click', () => {
      chatInputText.value = chip.getAttribute('data-prompt');
      chatInputText.focus();
    });
  });

  // Initial draw
  renderChat();
}

/**
 * 4. Smart Drafts
 */
function initDrafts() {
  const typeSelect = document.getElementById('draft-type');
  const toneSelect = document.getElementById('draft-tone');
  const detailsArea = document.getElementById('draft-details');
  const generateBtn = document.getElementById('generate-draft-btn');
  const outputBox = document.getElementById('draft-output-box');
  const copyBtn = document.getElementById('copy-draft-btn');

  let currentDraftText = "";

  generateBtn.addEventListener('click', async () => {
    const details = detailsArea.value.trim();
    if (!details) {
      outputBox.innerHTML = '<p class="placeholder-text" style="color:var(--color-red);">Please outline details in the context area before generating.</p>';
      return;
    }

    outputBox.innerHTML = '<p class="placeholder-text">AI is composing your correspondence draft...</p>';
    
    const type = typeSelect.value;
    const tone = toneSelect.value;
    
    const response = await queryAI('drafts', { type, tone, details });
    currentDraftText = response;
    outputBox.innerHTML = parseMarkdown(response);
    updateDashboardMetrics('draft');
  });

  copyBtn.addEventListener('click', () => {
    if (!currentDraftText) return;
    navigator.clipboard.writeText(currentDraftText);
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = `<i data-lucide="check"></i><span>Copied!</span>`;
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => {
      copyBtn.innerHTML = originalText;
      if (window.lucide) window.lucide.createIcons();
    }, 2000);
  });
}

/**
 * 5. Document Generator
 */
function initDocGen() {
  const docType = document.getElementById('doc-type');
  const docTitle = document.getElementById('doc-title');
  const docDetails = document.getElementById('doc-details');
  const generateBtn = document.getElementById('generate-doc-btn');
  const outputBox = document.getElementById('doc-output-box');
  const copyBtn = document.getElementById('copy-doc-btn');

  let currentDocText = "";

  generateBtn.addEventListener('click', async () => {
    const title = docTitle.value.trim();
    const details = docDetails.value.trim();
    if (!title || !details) {
      outputBox.innerHTML = '<p class="placeholder-text" style="color:var(--color-red);">Please provide both a Document Title and Specific Directives.</p>';
      return;
    }

    outputBox.innerHTML = '<p class="placeholder-text">Structuring document components...</p>';

    const type = docType.value;
    const response = await queryAI('docgen', { type, title, details });
    currentDocText = response;
    outputBox.innerHTML = parseMarkdown(response);
    updateDashboardMetrics('doc');
  });

  copyBtn.addEventListener('click', () => {
    if (!currentDocText) return;
    navigator.clipboard.writeText(currentDocText);
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = `<i data-lucide="check"></i><span>Copied!</span>`;
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => {
      copyBtn.innerHTML = originalText;
      if (window.lucide) window.lucide.createIcons();
    }, 2000);
  });
}

/**
 * 6. Autonomous Task Board (Kanban)
 */
function initKanban() {
  const colTodo = document.getElementById('cards-todo');
  const colInProgress = document.getElementById('cards-inprogress');
  const colApproval = document.getElementById('cards-approval');
  const colDone = document.getElementById('cards-done');
  
  const countTodo = document.getElementById('count-todo');
  const countInProgress = document.getElementById('count-inprogress');
  const countApproval = document.getElementById('count-approval');
  const countDone = document.getElementById('count-done');
  
  const aiInput = document.getElementById('kanban-ai-input');
  const aiAddBtn = document.getElementById('kanban-ai-add-btn');
  const prioritizeBtn = document.getElementById('kanban-prioritize-btn');
  const clearBtn = document.getElementById('kanban-clear-btn');

  // Load cards asynchronously
  const loadCards = async () => {
    const user = authService.getCurrentUser();
    if (user) {
      kanbanCards = await dbService.loadKanban(user.uid);
    } else {
      const storedCards = localStorage.getItem('nexus_copilot_kanban_cards');
      if (storedCards) {
        kanbanCards = JSON.parse(storedCards);
      } else {
        kanbanCards = [
          { id: 1, title: 'Draft newsletter update on workspace tools', column: 'todo', priority: 'medium', dueDate: 'Tuesday' },
          { id: 2, title: 'Extract minutes from marketing align sync', column: 'in-progress', priority: 'high', dueDate: 'Wednesday' },
          { id: 3, title: 'Generate service invoice for Acme review', column: 'done', priority: 'low', dueDate: 'Completed' }
        ];
        await saveKanbanCards();
      }
    }
    renderKanban();
  };

  async function saveKanbanCards() {
    const user = authService.getCurrentUser();
    if (user) {
      await dbService.saveKanban(user.uid, kanbanCards);
    } else {
      localStorage.setItem('nexus_copilot_kanban_cards', JSON.stringify(kanbanCards));
    }
  }

  window.refreshKanban = async () => {
    await loadCards();
  };

  loadCards();

  function renderKanban() {
    if (colTodo) colTodo.innerHTML = '';
    if (colInProgress) colInProgress.innerHTML = '';
    if (colApproval) colApproval.innerHTML = '';
    if (colDone) colDone.innerHTML = '';
    
    let todoC = 0, progressC = 0, approvalC = 0, doneC = 0;
    
    kanbanCards.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'kanban-card';
      cardEl.setAttribute('draggable', 'true');
      cardEl.setAttribute('data-id', card.id);
      
      cardEl.innerHTML = `
        <div class="kanban-card-title">${card.title}</div>
        <div class="kanban-card-meta">
          <span class="task-tag priority-${card.priority}">${card.priority}</span>
          <span class="task-date">
            <i data-lucide="calendar"></i>
            <span>${card.dueDate}</span>
          </span>
        </div>
      `;
      
      // Drag Events
      cardEl.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.id);
        cardEl.style.opacity = '0.5';
      });
      cardEl.addEventListener('dragend', () => {
        cardEl.style.opacity = '1';
      });

      if (card.column === 'todo') {
        if (colTodo) colTodo.appendChild(cardEl);
        todoC++;
      } else if (card.column === 'in-progress') {
        if (colInProgress) colInProgress.appendChild(cardEl);
        progressC++;
      } else if (card.column === 'approval') {
        // Add Approve / Reject buttons for approval column
        const approvalActions = document.createElement('div');
        approvalActions.className = 'approval-actions';
        approvalActions.innerHTML = `
          <button class="approval-btn approve">✅ Approve</button>
          <button class="approval-btn reject">❌ Reject</button>
        `;
        cardEl.appendChild(approvalActions);

        approvalActions.querySelector('.approve').addEventListener('click', (e) => {
          e.stopPropagation();
          card.column = 'done';
          card.dueDate = 'Completed';
          saveKanbanCards();
          renderKanban();
          updateDashboardMetrics('task_done');
        });
        approvalActions.querySelector('.reject').addEventListener('click', (e) => {
          e.stopPropagation();
          card.column = 'todo';
          saveKanbanCards();
          renderKanban();
        });

        if (colApproval) colApproval.appendChild(cardEl);
        approvalC++;
      } else {
        if (colDone) colDone.appendChild(cardEl);
        doneC++;
      }
    });

    if (countTodo) countTodo.textContent = todoC;
    if (countInProgress) countInProgress.textContent = progressC;
    if (countApproval) countApproval.textContent = approvalC;
    if (countDone) countDone.textContent = doneC;
    
    if (window.lucide) window.lucide.createIcons();
  }

  // Setup Column Drag Over & Drops
  [colTodo, colInProgress, colApproval, colDone].filter(Boolean).forEach(col => {
    const colName = col.id.replace('cards-', '');
    
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      const cardId = parseInt(e.dataTransfer.getData('text/plain'));
      const cardIndex = kanbanCards.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        let targetColName = colName;
        if (targetColName === 'inprogress') targetColName = 'in-progress';
        const previousCol = kanbanCards[cardIndex].column;
        kanbanCards[cardIndex].column = targetColName;
        if (targetColName === 'done') {
          kanbanCards[cardIndex].dueDate = 'Completed';
          if (previousCol !== 'done') updateDashboardMetrics('task_done');
        } else if (targetColName === 'approval') {
          // Moved to approval — mark as pending
          kanbanCards[cardIndex].dueDate = 'Pending Review';
        } else {
          if (previousCol === 'done') updateDashboardMetrics('task_undone');
        }
        saveKanbanCards();
        renderKanban();
      }
    });
  });

  // Parse & Add via AI Parser input
  async function handleAIAddTask() {
    const prompt = aiInput.value.trim();
    if (!prompt) return;

    aiInput.value = 'Parsing task parameters...';
    aiInput.disabled = true;

    try {
      const parsedTask = await queryAI('kanban', { prompt: prompt });
      
      // Create card
      const newCard = {
        id: Date.now(),
        title: parsedTask.title,
        column: parsedTask.column || 'todo',
        priority: parsedTask.priority || 'medium',
        dueDate: parsedTask.dueDate || 'Asap'
      };

      kanbanCards.push(newCard);
      saveKanbanCards();
      renderKanban();
      updateDashboardMetrics('task_add');
      
      aiInput.value = '';
    } catch (e) {
      console.error(e);
      aiInput.value = 'Error parsing instruction. Try again.';
    } finally {
      aiInput.disabled = false;
    }
  }

  aiAddBtn.addEventListener('click', handleAIAddTask);
  aiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAIAddTask();
  });

  // AI Auto-Prioritize
  prioritizeBtn.addEventListener('click', () => {
    // Sort logic: High priority, then medium, then low
    const order = { high: 1, medium: 2, low: 3 };
    
    // Sort in-place
    kanbanCards.sort((a, b) => {
      return (order[a.priority] || 4) - (order[b.priority] || 4);
    });

    saveKanbanCards();
    
    // Play sorting visual animation (briefly shake all cards)
    const cards = document.querySelectorAll('.kanban-card');
    cards.forEach(card => {
      card.style.transform = 'scale(0.95)';
      card.style.transition = 'transform 0.15s ease';
    });
    
    setTimeout(() => {
      renderKanban();
    }, 200);
  });

  // Clear Done Cards
  clearBtn.addEventListener('click', () => {
    kanbanCards = kanbanCards.filter(c => c.column !== 'done');
    saveKanbanCards();
    renderKanban();
  });

  // Draw board
  renderKanban();
}

/**
 * 7. Minutes of Meeting (MoM) Extractor
 */
function initMoM() {
  const transcriptArea = document.getElementById('mom-transcript');
  const generateBtn = document.getElementById('generate-mom-btn');
  const outputBox = document.getElementById('mom-output-box');
  const copyBtn = document.getElementById('copy-mom-btn');

  let currentMoMText = "";

  generateBtn.addEventListener('click', async () => {
    const transcript = transcriptArea.value.trim();
    if (!transcript) {
      outputBox.innerHTML = '<p class="placeholder-text" style="color:var(--color-red);">Please paste transcript or discussion notes before generating minutes.</p>';
      return;
    }

    outputBox.innerHTML = '<p class="placeholder-text">AI is reading discussion loops & mapping tasks...</p>';

    const response = await queryAI('mom', { transcript: transcript });
    currentMoMText = response;
    outputBox.innerHTML = parseMarkdown(response);
    updateDashboardMetrics('mom');
  });

  copyBtn.addEventListener('click', () => {
    if (!currentMoMText) return;
    navigator.clipboard.writeText(currentMoMText);
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = `<i data-lucide="check"></i><span>Copied!</span>`;
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => {
      copyBtn.innerHTML = originalText;
      if (window.lucide) window.lucide.createIcons();
    }, 2000);
  });
}

/**
 * 8. Working Global Search Experience
 */
function initGlobalSearch() {
  const searchInput = document.getElementById('global-search');
  const resultsDropdown = document.getElementById('search-results');
  
  if (!searchInput || !resultsDropdown) return;

  const tabs = [
    { name: 'Dashboard', id: 'dashboard', icon: 'layout-dashboard', keywords: 'home main metrics overview' },
    { name: 'AI Chat Assistant', id: 'chat', icon: 'message-square', keywords: 'ask persona general general assistant prompt templates writer admin analyst' },
    { name: 'Smart Drafts', id: 'drafts', icon: 'mail-warning', keywords: 'email announcement memo tone correspondence' },
    { name: 'Document Generator', id: 'docgen', icon: 'file-text', keywords: 'proposal invoice report ppt slides presentation' },
    { name: 'Task Board (Kanban)', id: 'kanban', icon: 'kanban-square', keywords: 'nlp parse priority todo progress' },
    { name: 'Minutes Extractor (MoM)', id: 'mom', icon: 'mic', keywords: 'meeting transcript discussion owner' }
  ];

  function performSwitchTab(tabId) {
    const btn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (btn) {
      btn.click();
    }
  }

  searchInput.addEventListener('input', () => {
    const val = searchInput.value.toLowerCase().trim();
    if (!val) {
      resultsDropdown.classList.remove('active');
      resultsDropdown.innerHTML = '';
      return;
    }

    resultsDropdown.innerHTML = '';
    let matches = [];

    // 1. Search Tabs/Views
    tabs.forEach(tab => {
      if (tab.name.toLowerCase().includes(val) || tab.keywords.includes(val)) {
        matches.push({
          type: 'tab',
          title: `Go to ${tab.name}`,
          icon: tab.icon,
          meta: 'Navigation',
          action: () => performSwitchTab(tab.id)
        });
      }
    });

    // 2. Search Kanban Tasks
    if (typeof kanbanCards !== 'undefined' && Array.isArray(kanbanCards)) {
      kanbanCards.forEach(card => {
        if (card.title.toLowerCase().includes(val)) {
          matches.push({
            type: 'task',
            title: `Task: ${card.title}`,
            icon: 'check-square',
            meta: `Kanban (${card.column})`,
            action: () => {
              performSwitchTab('kanban');
              setTimeout(() => {
                const cardEl = document.querySelector(`.kanban-card[data-id="${card.id}"]`);
                if (cardEl) {
                  cardEl.style.boxShadow = '0 0 15px var(--accent-primary)';
                  setTimeout(() => cardEl.style.boxShadow = '', 2000);
                }
              }, 100);
            }
          });
        }
      });
    }

    // 3. Search Chat preset template prompts
    const templates = [
      { name: 'Weekly Marketing Summary', prompt: 'Draft a weekly summary email for our marketing goals.' },
      { name: 'Invoice Net-30 Help', prompt: 'How do I set up aNet-30 payment term invoice?' },
      { name: 'Project Launch Checklist', prompt: 'Create a brief project checklist for launching our app.' }
    ];
    templates.forEach(tpl => {
      if (tpl.name.toLowerCase().includes(val) || tpl.prompt.toLowerCase().includes(val)) {
        matches.push({
          type: 'template',
          title: `Prompt: ${tpl.name}`,
          icon: 'sparkles',
          meta: 'Chat Template',
          action: () => {
            performSwitchTab('chat');
            const chatInputText = document.getElementById('chat-input-text');
            if (chatInputText) {
              chatInputText.value = tpl.prompt;
              chatInputText.focus();
            }
          }
        });
      }
    });

    if (matches.length === 0) {
      resultsDropdown.innerHTML = `<div class="search-no-results">No matches found for "${val}"</div>`;
    } else {
      matches.slice(0, 6).forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'search-result-item';
        itemEl.innerHTML = `
          <i data-lucide="${item.icon}"></i>
          <span>${item.title}</span>
          <span class="result-meta">${item.meta}</span>
        `;
        itemEl.addEventListener('click', () => {
          item.action();
          searchInput.value = '';
          resultsDropdown.classList.remove('active');
        });
        resultsDropdown.appendChild(itemEl);
      });
      
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }

    resultsDropdown.classList.add('active');
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !resultsDropdown.contains(e.target)) {
      resultsDropdown.classList.remove('active');
    }
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) {
      resultsDropdown.classList.add('active');
    }
  });
}

/**
 * 9. Real-Time Clock & Date Widget
 */
function initRealTimeClock() {
  const clockTime = document.getElementById('clock-time');
  const clockDate = document.getElementById('clock-date');
  
  if (!clockTime || !clockDate) return;

  function updateClock() {
    const now = new Date();
    
    // Time format: HH:MM:SS AM/PM
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const hoursStr = String(hours).padStart(2, '0');
    
    clockTime.textContent = `${hoursStr}:${minutes}:${seconds} ${ampm}`;
    
    // Date format: DayName, MonthName Day
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    clockDate.textContent = now.toLocaleDateString('en-US', options);
  }

  // Initial call
  updateClock();
  
  // Update every 1 second
  setInterval(updateClock, 1000);
}

/**
 * 10. Dynamic Dashboard Metrics Updater
 */
function updateDashboardMetrics(type = null) {
  // Only update metrics when the user actually performs a task
  if (type === 'chat') {
    metricsState.tasksExecuted += 1;
    metricsState.timeSaved += 0.2;        // ~12 mins saved per AI chat query
  } else if (type === 'draft') {
    metricsState.tasksExecuted += 1;
    metricsState.timeSaved += 0.5;        // ~30 mins saved per drafted email
  } else if (type === 'doc') {
    metricsState.tasksExecuted += 1;
    metricsState.timeSaved += 0.8;        // ~48 mins saved per generated document
  } else if (type === 'mom') {
    metricsState.tasksExecuted += 1;
    metricsState.timeSaved += 1.2;        // ~1.2 hrs saved per MoM extraction
  } else if (type === 'task_add') {
    metricsState.tasksExecuted += 1;
    metricsState.activeAutomations += 1;  // new automation scheduled
    metricsState.timeSaved += 0.3;        // ~18 mins saved per Kanban task
  } else if (type === 'task_done') {
    metricsState.activeAutomations = Math.max(0, metricsState.activeAutomations - 1);
    metricsState.timeSaved += 0.5;        // ~30 mins saved per completed task
  }
  // type === null means called on init — just render current state, no changes

  // Persist to localStorage
  localStorage.setItem('metrics_timeSaved', metricsState.timeSaved.toFixed(4));
  localStorage.setItem('metrics_tasksExecuted', metricsState.tasksExecuted);
  localStorage.setItem('metrics_activeAutomations', metricsState.activeAutomations);

  // Update DOM
  const timeSavedEl      = document.getElementById('metric-time-saved');
  const tasksExecutedEl  = document.getElementById('metric-tasks-executed');
  const automationsEl    = document.getElementById('metric-automations');
  const timeSavedSub     = document.getElementById('metric-time-saved-sub');

  if (timeSavedEl) {
    timeSavedEl.textContent = `${metricsState.timeSaved.toFixed(2)} hrs`;
    if (type) pulseElement(timeSavedEl);
  }
  if (tasksExecutedEl) {
    tasksExecutedEl.textContent = metricsState.tasksExecuted;
    if (type) pulseElement(tasksExecutedEl);
  }
  if (automationsEl) {
    automationsEl.textContent = metricsState.activeAutomations;
    if (type === 'task_add' || type === 'task_done') pulseElement(automationsEl);
  }
  if (timeSavedSub) {
    timeSavedSub.textContent = `+${metricsState.timeSaved.toFixed(2)} hrs this week`;
  }
}

// Pulse highlight animation for metric values on real user actions
function pulseElement(el) {
  el.style.transform = 'scale(1.18)';
  el.style.color = 'var(--accent-primary)';
  setTimeout(() => {
    el.style.transform = 'scale(1)';
    el.style.color = '';
  }, 350);
}

/**
 * 11. Customer Support Agent
 */
function initCustomerSupport() {
  const sendBtn = document.getElementById('support-send-btn');
  const inputEl = document.getElementById('support-input');
  const historyEl = document.getElementById('support-chat-history');
  const industryEl = document.getElementById('support-industry');
  const toneEl = document.getElementById('support-tone');
  const faqChips = document.querySelectorAll('[data-support-faq]');

  if (!sendBtn || !inputEl || !historyEl) return;

  // FAQ chip click prefills the input
  faqChips.forEach(chip => {
    chip.addEventListener('click', () => {
      inputEl.value = chip.getAttribute('data-support-faq');
      inputEl.focus();
    });
  });

  // Update FAQ chips when industry changes
  if (industryEl) {
    industryEl.addEventListener('change', () => updateSupportFaqChips(industryEl.value));
  }

  async function sendSupportMessage() {
    const query = inputEl.value.trim();
    if (!query) return;

    const industry = industryEl ? industryEl.value : 'general';
    const tone = toneEl ? toneEl.value : 'professional';
    inputEl.value = '';

    // Add user message
    appendSupportMsg('user', query, historyEl);

    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-msg system';
    typingDiv.id = 'support-typing';
    typingDiv.innerHTML = `
      <div class="msg-avatar"><i data-lucide="headphones"></i></div>
      <div class="ai-typing-indicator"><span></span><span></span><span></span></div>
    `;
    historyEl.appendChild(typingDiv);
    historyEl.scrollTop = historyEl.scrollHeight;
    if (window.lucide) window.lucide.createIcons();

    // Build prompt
    const industryNames = {
      general: 'General Business', education: 'Education', healthcare: 'Healthcare',
      hr: 'Human Resources', legal: 'Legal', manufacturing: 'Manufacturing',
      sales: 'Sales', retail: 'Retail'
    };
    const systemPrompt = `You are a professional AI Customer Support Agent specializing in ${industryNames[industry] || 'General Business'}. 
Respond in a ${tone} tone. Provide clear, helpful, and empathetic responses to customer queries. 
Keep responses concise (under 150 words). Include actionable next steps where relevant.
If it's a complaint, acknowledge it first before providing a solution.`;

    try {
      const response = await queryAI([
        { role: 'system', text: systemPrompt },
        { role: 'user', text: `Customer Query: ${query}` }
      ]);
      typingDiv.remove();
      appendSupportMsg('system', response, historyEl);
      updateDashboardMetrics('chat');
    } catch (e) {
      typingDiv.remove();
      const fallback = getSupportFallback(query, industry, tone);
      appendSupportMsg('system', fallback, historyEl);
      updateDashboardMetrics('chat');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  sendBtn.addEventListener('click', sendSupportMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendSupportMessage(); }
  });
}

function appendSupportMsg(role, text, container) {
  const div = document.createElement('div');
  div.className = `chat-msg ${role === 'user' ? 'user' : 'system'}`;
  const icon = role === 'user' ? 'user' : 'headphones';
  div.innerHTML = `
    <div class="msg-avatar"><i data-lucide="${icon}"></i></div>
    <div class="msg-content">${text.replace(/\n/g, '<br>')}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function getSupportFallback(query, industry, tone) {
  const q = query.toLowerCase();
  
  if (q.includes('refund') || q.includes('return')) {
    return tone === 'empathetic'
      ? "I completely understand your frustration, and I sincerely apologize for the inconvenience. I've initiated a refund request on your behalf. You should see the amount credited within 5–7 business days. Is there anything else I can assist you with?"
      : "Your refund request has been received. Processing takes 5–7 business days. You'll receive a confirmation email shortly. Reference your order number for tracking.";
  }
  if (q.includes('login') || q.includes('account') || q.includes('password')) {
    return "I can help with that! Please try: 1) Clearing browser cache & cookies, 2) Using 'Forgot Password' to reset credentials, 3) Checking if Caps Lock is on. If the issue persists, I'll escalate to our technical team immediately.";
  }
  if (q.includes('track') || q.includes('order') || q.includes('delivery')) {
    return "You can track your order in real-time via your account dashboard → 'My Orders'. Alternatively, share your order ID and I'll pull up the status right away. Estimated delivery updates are sent automatically via SMS and email.";
  }
  if (q.includes('billing') || q.includes('invoice') || q.includes('charge')) {
    return "I've flagged this billing discrepancy for review. Our billing team will send you a corrected invoice within 24 hours. You will NOT be charged the disputed amount until resolved. Thank you for bringing this to our attention.";
  }
  if (q.includes('hour') || q.includes('open') || q.includes('available')) {
    return `Our support team is available:\n• **Chat & Email**: 24/7\n• **Phone Support**: Mon–Sat, 9AM–6PM IST\n• **Priority Support** (Business plans): 24/7 with <2hr response SLA`;
  }
  if (q.includes('escalate') || q.includes('manager') || q.includes('supervisor')) {
    return "Absolutely — I'm escalating this to a Senior Support Manager right now. You'll receive a direct callback within 2 hours. Your case ID is #CSP-" + Math.floor(10000 + Math.random() * 90000) + ". Is there anything specific you'd like me to note for the manager?";
  }

  const industryResponses = {
    education: "Thank you for reaching out! Our education support specialists are available to assist with admissions, course access, grade queries, and technical issues. Please provide your student ID or enrollment number for faster assistance.",
    healthcare: "Your health concern is our top priority. I'm connecting you with a certified healthcare coordinator. Please note, for medical emergencies, call emergency services immediately. For non-urgent queries, our medical staff will respond within 4 hours.",
    hr: "Thank you for contacting HR Support. We're committed to addressing your query promptly. For payroll, leave, or policy questions, please provide your Employee ID. Our HR team aims to resolve all queries within 1 business day.",
    legal: "Thank you for your query. Our legal support team will review your case with full confidentiality. Please note that this is informational support only and not legal advice. A qualified attorney will contact you within 24 hours.",
    sales: "Great to hear from you! Our sales team is eager to assist. Whether it's pricing, demos, or customized plans — we've got you covered. A dedicated account executive will reach out to you within 2 hours.",
    retail: "Thank you for shopping with us! Our retail support team is happy to help with sizing, availability, exchanges, or store queries. Can you please share your order number or preferred store location?",
    manufacturing: "Thank you for contacting manufacturing support. For equipment issues, warranty claims, or bulk order inquiries, our technical specialists are ready to assist. Please provide your product serial number for faster service."
  };

  return industryResponses[industry] || "Thank you for reaching out to our support team. I've logged your query and a specialist will assist you shortly. Your reference number is #CSP-" + Math.floor(10000 + Math.random() * 90000) + ". We aim to resolve all queries within 24 hours.";
}

function updateSupportFaqChips(industry) {
  const container = document.getElementById('support-faq-chips');
  if (!container) return;

  const faqSets = {
    education: ['How do I access my course materials?', 'When are results published?', 'How do I apply for a fee waiver?', 'I missed an exam, what are my options?', 'How do I update my personal details?'],
    healthcare: ['How do I book an appointment?', 'Are my prescriptions ready?', 'I need to request medical records.', 'What insurance plans do you accept?', 'How do I reach the emergency department?'],
    hr: ['How do I apply for leave?', 'When is the next payroll date?', 'I need an experience letter.', 'What is the work from home policy?', 'How do I update my bank details?'],
    legal: ['I need a consultation appointment.', 'What documents do I need for my case?', 'What are your service charges?', 'How long will my case take?', 'I need an NDA drafted.'],
    sales: ['I want to request a product demo.', 'What are your enterprise pricing plans?', 'Can I get a trial extension?', 'Who is my account manager?', 'I want to upgrade my plan.'],
    retail: ['What is your return policy?', 'Do you offer size exchanges?', 'How do I apply a promo code?', 'Is this item available in store?', 'I received a damaged product.'],
    manufacturing: ['I need a warranty claim processed.', 'Can I order replacement parts?', 'What is the lead time for bulk orders?', 'I need a product specification sheet.', 'How do I report a safety issue?'],
    general: ['What are your business hours?', 'I want to request a refund for my order.', 'I cannot login to my account. Please help.', 'How can I track my order status?', 'I have a billing discrepancy on my invoice.', 'Can you escalate this to a manager?']
  };

  const faqs = faqSets[industry] || faqSets.general;
  container.innerHTML = faqs.map(faq =>
    `<button class="template-chip" data-support-faq="${faq}">${faq}</button>`
  ).join('');

  container.querySelectorAll('[data-support-faq]').forEach(chip => {
    chip.addEventListener('click', () => {
      const input = document.getElementById('support-input');
      if (input) { input.value = chip.getAttribute('data-support-faq'); input.focus(); }
    });
  });
  if (window.lucide) window.lucide.createIcons();
}

/**
 * 12. Personalization Engine Dashboard Chips
 */
function initPersonalizationChips() {
  const chips = document.querySelectorAll('.p-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const action = chip.getAttribute('data-action');
      const prefill = chip.getAttribute('data-prefill');

      // Navigate to the right tab
      const tabMap = {
        'go-chat': 'chat', 'go-docgen': 'docgen', 'go-drafts': 'drafts',
        'go-support': 'support', 'go-mom': 'mom', 'go-kanban': 'kanban'
      };
      const tabId = tabMap[action];
      if (tabId) {
        document.querySelector(`[data-tab="${tabId}"]`)?.click();
      }

      // Prefill chat input if prefill text exists
      if (prefill && (tabId === 'chat')) {
        setTimeout(() => {
          const chatInput = document.getElementById('chat-input-text');
          if (chatInput) {
            chatInput.value = prefill;
            chatInput.focus();
          }
        }, 200);
      }

      // Chip visual feedback
      chip.style.transform = 'scale(0.96)';
      setTimeout(() => { chip.style.transform = ''; }, 200);
    });
  });
}

/**
 * Kanban Approval Column helpers
 * (renderKanbanCards already handles all 4 columns via the column map in initKanban)
 * These helpers add approve/reject buttons to approval-column cards
 */
function addApprovalButtons(cardEl, cardId) {
  if (cardEl.querySelector('.approval-actions')) return;
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'approval-actions';
  actionsDiv.innerHTML = `
    <button class="approval-btn approve" data-card-id="${cardId}">✅ Approve</button>
    <button class="approval-btn reject" data-card-id="${cardId}">❌ Reject</button>
  `;
  cardEl.appendChild(actionsDiv);

  actionsDiv.querySelector('.approve').addEventListener('click', (e) => {
    e.stopPropagation();
    const card = kanbanCards.find(c => c.id === cardId);
    if (card) {
      card.column = 'done';
      saveKanbanCards();
      renderKanbanCards();
      updateDashboardMetrics('task_done');
    }
  });

  actionsDiv.querySelector('.reject').addEventListener('click', (e) => {
    e.stopPropagation();
    const card = kanbanCards.find(c => c.id === cardId);
    if (card) {
      card.column = 'todo';
      saveKanbanCards();
      renderKanbanCards();
    }
  });
}


/**
 * 13. AI Knowledge Assistant
 */
function initKnowledgeAssistant() {
  const titleInput  = document.getElementById('kb-entry-title');
  const categorySel = document.getElementById('kb-entry-category');
  const contentArea = document.getElementById('kb-entry-content');
  const addBtn      = document.getElementById('kb-add-btn');
  const entriesCont = document.getElementById('kb-entries-container');
  const queryInput  = document.getElementById('kb-query-input');
  const askBtn      = document.getElementById('kb-ask-btn');
  const answerArea  = document.getElementById('kb-answer-area');
  const topicChips  = document.querySelectorAll('.kb-chip');

  if (!addBtn || !askBtn) return;

  let knowledgeBase = [];

  const loadKnowledge = async () => {
    const user = authService.getCurrentUser();
    if (user) {
      knowledgeBase = await dbService.loadKnowledge(user.uid);
    } else {
      knowledgeBase = JSON.parse(localStorage.getItem('nexus_knowledge_base') || '[]');
      if (knowledgeBase.length === 0) {
        knowledgeBase = [
          { id: Date.now()+1, title: 'Annual Leave Policy', category: 'hr', content: 'Employees are entitled to 21 days of annual leave per calendar year. Leave must be applied at least 7 days in advance via the HR portal. Unused leave up to 10 days can be carried forward. Emergency leave (up to 3 days) can be taken without prior notice with manager approval. Maternity leave is 26 weeks and paternity leave is 2 weeks, both fully paid.' },
          { id: Date.now()+2, title: 'Refund & Returns Process', category: 'product', content: 'Customers can request a refund within 30 days of purchase. Steps: 1) Log in to the customer portal, 2) Go to My Orders, 3) Click Request Refund, 4) Choose a reason and submit. Refunds are processed within 5-7 business days. For physical products, a return shipment label will be emailed within 24 hours.' },
          { id: Date.now()+3, title: 'New Employee Onboarding Checklist', category: 'training', content: 'Week 1: Complete HR paperwork, set up workstation, attend orientation. Week 2: Shadow team lead, access credentials, complete compliance training. Week 3: Begin assigned project tasks, set 90-day goals with manager. Key contacts: IT Helpdesk ext 101, HR Manager ext 202. All new hires must complete cybersecurity training within 5 days.' }
        ];
        await saveKB();
      }
    }
    renderEntries();
  };

  async function saveKB() {
    const user = authService.getCurrentUser();
    if (user) {
      await dbService.saveKnowledge(user.uid, knowledgeBase);
    } else {
      localStorage.setItem('nexus_knowledge_base', JSON.stringify(knowledgeBase));
    }
  }

  window.refreshKnowledge = async () => {
    await loadKnowledge();
  };


  const catLabels = { hr:'HR Policy', product:'Product FAQ', training:'Training', legal:'Legal', finance:'Finance', it:'IT & Tech', general:'General' };
  const catColors = { hr:'#8b5cf6', product:'#06b6d4', training:'#34d399', legal:'#f87171', finance:'#fbbf24', it:'#38bdf8', general:'#9b94c0' };

  function renderEntries() {
    if (!entriesCont) return;
    if (knowledgeBase.length === 0) { entriesCont.innerHTML = '<p class="placeholder-text" style="margin-top:20px;font-size:13px">No entries yet.</p>'; return; }
    entriesCont.innerHTML = knowledgeBase.map(e => `
      <div class="kb-entry-card">
        <div class="kb-entry-header"><span class="kb-entry-title">${e.title}</span><button class="kb-entry-delete" data-id="${e.id}">?</button></div>
        <span class="kb-category-badge" style="background:${catColors[e.category]||'#8b5cf6'}22;color:${catColors[e.category]||'#8b5cf6'};border:1px solid ${catColors[e.category]||'#8b5cf6'}44">${catLabels[e.category]||'General'}</span>
        <p class="kb-entry-preview">${e.content.substring(0,90)}${e.content.length>90?'...':''}</p>
      </div>`).join('');
    entriesCont.querySelectorAll('.kb-entry-delete').forEach(btn => {
      btn.addEventListener('click', (ev) => { ev.stopPropagation(); knowledgeBase = knowledgeBase.filter(e => e.id !== parseInt(btn.dataset.id)); saveKB(); renderEntries(); });
    });
    if (window.lucide) window.lucide.createIcons();
  }

  addBtn.addEventListener('click', () => {
    const title = titleInput?.value.trim(), content = contentArea?.value.trim(), cat = categorySel?.value||'general';
    if (!title || !content) { if(titleInput) titleInput.style.borderColor=!title?'#f87171':''; if(contentArea) contentArea.style.borderColor=!content?'#f87171':''; return; }
    if(titleInput) titleInput.style.borderColor=''; if(contentArea) contentArea.style.borderColor='';
    knowledgeBase.push({ id: Date.now(), title, category: cat, content });
    saveKB(); renderEntries(); updateDashboardMetrics('chat');
    if(titleInput) titleInput.value=''; if(contentArea) contentArea.value='';
    addBtn.innerHTML = '? Saved!'; addBtn.style.background='linear-gradient(135deg,#34d399,#059669)';
    setTimeout(() => { addBtn.innerHTML='<i data-lucide="database"></i><span>Save to Knowledge Base</span>'; addBtn.style.background=''; if(window.lucide) window.lucide.createIcons(); }, 1500);
  });

  function findRelevant(query) {
    const words = query.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    return knowledgeBase.map(e => ({ e, s: words.reduce((acc,w) => acc + (((e.title+' '+e.content).toLowerCase().match(new RegExp(w,'g'))||[]).length), 0) }))
      .filter(x => x.s > 0).sort((a,b) => b.s-a.s).slice(0,3).map(x => x.e);
  }

  async function ask(query) {
    if (!query.trim()) return;
    if (queryInput) queryInput.value = '';
    answerArea.innerHTML = '<div class="kb-loading"><div class="ai-typing-indicator"><span></span><span></span><span></span></div><span style="color:var(--text-muted);font-size:13px">Searching knowledge base...</span></div>';
    const rel = findRelevant(query);
    const ctx = (rel.length > 0 ? rel : knowledgeBase).map((e,i) => `[Source ${i+1}: ${e.title}]\n${e.content}`).join('\n\n');
    const sys = knowledgeBase.length > 0
      ? `You are a precise AI Knowledge Assistant. Answer ONLY from the knowledge base below. Always cite sources. Use bullets for multi-step answers.\n\nKNOWLEDGE BASE:\n${ctx}`
      : 'You are an AI Knowledge Assistant. Tell the user to add entries first using the form on the left.';
    try {
      const answer = await queryAI([{ role:'system', text:sys }, { role:'user', text:query }]);
      renderAnswer(query, answer, rel);
      updateDashboardMetrics('chat');
    } catch(err) {
      const fb = rel.length > 0 ? `Based on **${rel[0].title}**: ${rel[0].content.substring(0,400)}...` : 'No matching knowledge found. Please add entries using the form on the left.';
      renderAnswer(query, fb, rel);
    }
  }

  function renderAnswer(query, answer, sources) {
    const tags = sources.map(s => `<span class="kb-source-tag" style="background:${catColors[s.category]||'#8b5cf6'}22;color:${catColors[s.category]||'#8b5cf6'}">${s.title}</span>`).join('');
    answerArea.innerHTML = `
      <div class="kb-answer-card">
        <div class="kb-answer-query"><i data-lucide="message-circle" style="width:14px;height:14px;color:var(--accent-primary)"></i><span>${query}</span></div>
        <div class="kb-answer-body">${answer.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}</div>
        ${sources.length>0?`<div class="kb-sources-row"><span class="kb-sources-label">Sources used:</span>${tags}</div>`:''}
      </div>
      <div class="kb-ask-again-row">
        <input type="text" id="kb-inline-input" class="custom-input" placeholder="Ask another question..." style="flex:1">
        <button class="btn btn-primary" id="kb-ask-again-btn">Ask Again</button>
      </div>`;
    document.getElementById('kb-ask-again-btn')?.addEventListener('click', () => { const q=document.getElementById('kb-inline-input')?.value.trim(); if(q) ask(q); });
    document.getElementById('kb-inline-input')?.addEventListener('keydown', e => { if(e.key==='Enter'){ const q=e.target.value.trim(); if(q) ask(q); }});
    if (window.lucide) window.lucide.createIcons();
  }

  topicChips.forEach(chip => { chip.addEventListener('click', () => { const q=chip.getAttribute('data-query'); if(q) ask(q); }); });
  askBtn.addEventListener('click', () => { if(queryInput?.value.trim()) ask(queryInput.value.trim()); });
  queryInput?.addEventListener('keydown', e => { if(e.key==='Enter' && queryInput.value.trim()) ask(queryInput.value.trim()); });
  loadKnowledge();
}

/**
 * ==========================================================================
 * AUTHENTICATION SYSTEM MANAGEMENT (FIREBASE & SIMULATED)
 * ==========================================================================
 */

function initAuth() {
  const loginContainer = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');
  const signinForm = document.getElementById('signin-form');
  const signupForm = document.getElementById('signup-form');
  const btnShowSignin = document.getElementById('btn-show-signin');
  const btnShowSignup = document.getElementById('btn-show-signup');
  const btnForgotPassword = document.getElementById('btn-forgot-password');
  const btnGoogleAuth = document.getElementById('btn-google-auth');
  
  const signinEmail = document.getElementById('signin-email');
  const signinPassword = document.getElementById('signin-password');
  const signupName = document.getElementById('signup-name');
  const signupEmail = document.getElementById('signup-email');
  const signupPassword = document.getElementById('signup-password');
  
  const signinSpinner = document.getElementById('signin-spinner');
  const signupSpinner = document.getElementById('signup-spinner');
  


  // Toggle Forms
  btnShowSignin.addEventListener('click', () => {
    btnShowSignin.classList.add('active');
    btnShowSignup.classList.remove('active');
    signinForm.classList.add('active');
    signupForm.classList.remove('active');
  });

  btnShowSignup.addEventListener('click', () => {
    btnShowSignup.classList.add('active');
    btnShowSignin.classList.remove('active');
    signupForm.classList.add('active');
    signinForm.classList.remove('active');
  });

  // Handle Sign In Submit
  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = signinEmail.value.trim();
    const password = signinPassword.value;
    
    signinSpinner.style.display = 'inline-block';
    const submitBtn = document.getElementById('btn-signin-submit');
    submitBtn.disabled = true;
    
    try {
      await authService.signIn(email, password);
      showToast('Welcome Back!', 'Login successful.', 'success');
    } catch (error) {
      console.error(error);
      const userMessage = getAuthErrorMessage(error.message);
      showToast('Login Failed', userMessage, 'error');
    } finally {
      signinSpinner.style.display = 'none';
      submitBtn.disabled = false;
    }
  });

  // Handle Sign Up Submit
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = signupName.value.trim();
    const email = signupEmail.value.trim();
    const password = signupPassword.value;
    
    signupSpinner.style.display = 'inline-block';
    const submitBtn = document.getElementById('btn-signup-submit');
    submitBtn.disabled = true;
    
    try {
      await authService.signUp(email, password, name);
      showToast('Account Created!', `Welcome to Nexus Copilot, ${name}.`, 'success');
    } catch (error) {
      console.error(error);
      const userMessage = getAuthErrorMessage(error.message);
      showToast('Registration Failed', userMessage, 'error');
    } finally {
      signupSpinner.style.display = 'none';
      submitBtn.disabled = false;
    }
  });

  // Handle Forgot Password
  btnForgotPassword.addEventListener('click', async () => {
    const email = signinEmail.value.trim();
    if (!email) {
      showToast('Email Required', 'Please enter your email address in the Sign In form first.', 'error');
      signinEmail.focus();
      return;
    }
    
    try {
      await authService.resetPassword(email);
      showToast('Reset Link Sent', 'Check your inbox for password reset instructions.', 'success');
    } catch (error) {
      console.error(error);
      const userMessage = getAuthErrorMessage(error.message);
      showToast('Reset Failed', userMessage, 'error');
    }
  });

  // Handle Google Auth Sign In
  btnGoogleAuth.addEventListener('click', async () => {
    btnGoogleAuth.disabled = true;
    const span = btnGoogleAuth.querySelector('span');
    const originalText = span.textContent;
    span.textContent = 'Connecting...';
    
    try {
      await authService.signInWithGoogle();
      showToast('Welcome!', 'Google Sign In successful.', 'success');
    } catch (error) {
      console.error(error);
      const userMessage = getAuthErrorMessage(error.message);
      showToast('Google Sign In Failed', userMessage, 'error');
    } finally {
      span.textContent = originalText;
      btnGoogleAuth.disabled = false;
    }
  });

  // Profile Dropdown Actions
  const profileMenu = document.getElementById('user-profile-menu');
  const profileDropdown = document.getElementById('profile-dropdown');
  const logoutBtn = document.getElementById('logout-btn');
  
  profileMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    profileMenu.classList.toggle('active');
    profileDropdown.classList.toggle('active');
  });

  document.addEventListener('click', () => {
    profileMenu.classList.remove('active');
    profileDropdown.classList.remove('active');
  });

  logoutBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await authService.signOut();
      showToast('Signed Out', 'You have been logged out successfully.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Sign Out Failed', 'An error occurred during logout.', 'error');
    }
  });



  // Subscribe to Auth State
  authService.onAuthStateChanged((user) => {
    if (user) {
      // Logged In
      loginContainer.style.display = 'none';
      appContainer.style.display = 'grid';
      
      // Update UI with user info
      const displayName = user.displayName || user.email.split('@')[0];
      const email = user.email;
      
      document.getElementById('user-display-name').textContent = displayName;
      document.getElementById('dropdown-user-name').textContent = displayName;
      document.getElementById('dropdown-user-email').textContent = email;
      
      // Initials for avatar
      const initials = displayName
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'US';
      document.getElementById('user-avatar').textContent = initials;
      
      // Adjust dashboard welcome message
      const highlight = document.querySelector('.welcome-banner .highlight');
      if (highlight) {
        highlight.textContent = displayName;
      }
      
    } else {
      // Logged Out
      loginContainer.style.display = 'flex';
      appContainer.style.display = 'none';
    }
    
    // Refresh user data (Kanban & Knowledge base) whenever auth state resolves/changes
    if (typeof window.refreshKanban === 'function') {
      window.refreshKanban();
    }
    if (typeof window.refreshKnowledge === 'function') {
      window.refreshKnowledge();
    }
    
    if (window.lucide) {
      window.lucide.createIcons();
    }
  });
}

function getAuthErrorMessage(msg) {
  if (msg.includes('auth/user-not-found')) return 'No account found with this email.';
  if (msg.includes('auth/wrong-password')) return 'The password you entered is incorrect.';
  if (msg.includes('auth/invalid-email')) return 'Please enter a valid email address.';
  if (msg.includes('auth/email-already-in-use')) return 'This email address is already in use.';
  if (msg.includes('auth/weak-password')) return 'Password should be at least 6 characters.';
  if (msg.includes('auth/popup-closed-by-user')) return 'The login popup was closed before completing.';
  return msg.split(': ').pop() || 'An error occurred during authentication.';
}

/**
 * Toast Notifications
 */
function showToast(title, message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast-notification ${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'alert-triangle';
  
  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <div class="toast-content">
      <h5>${title}</h5>
      <p>${message}</p>
    </div>
  `;
  
  container.appendChild(toast);
  
  if (window.lucide) {
    window.lucide.createIcons({
      attrs: { class: 'toast-icon' }
    });
  }
  
  setTimeout(() => {
    toast.classList.add('active');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}
