import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

/**
 * AI Connection and Simulation Core
 */

// Local storage keys
const KEY_STORAGE_NAME = 'nexus_copilot_api_key';
const MODEL_STORAGE_NAME = 'nexus_copilot_model';

export function getSavedApiKey() {
  return localStorage.getItem(KEY_STORAGE_NAME) || import.meta.env.VITE_GEMINI_API_KEY || '';
}

export function saveApiKey(key) {
  localStorage.setItem(KEY_STORAGE_NAME, key);
}

export function getSavedModel() {
  return localStorage.getItem(MODEL_STORAGE_NAME) || 'gemini-2.5-flash';
}

export function saveModel(model) {
  localStorage.setItem(MODEL_STORAGE_NAME, model);
}

/**
 * Call the live Gemini API using LangChain
 */
async function callGeminiAPI(apiKey, model, systemInstruction, prompt) {
  const chat = new ChatGoogleGenerativeAI({
    model: model || "gemini-2.5-flash",
    apiKey: apiKey,
  });

  const messages = [];
  if (systemInstruction) {
    messages.push(new SystemMessage(systemInstruction));
  }
  messages.push(new HumanMessage(prompt));

  const response = await chat.invoke(messages);
  return response.content;
}

/**
 * Call the Agentic Control Plane proxy endpoint
 */
async function callACPProxy(apiKey, model, systemInstruction, prompt) {
  const url = `/acp-api/v1/chat/completions`;
  
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'x-acp-agent-name': 'NexusCopilot'
    },
    body: JSON.stringify({
      model: model || 'gemini-2.5-flash',
      messages: messages
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || errorData.message || `Proxy error! status: ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  const textResponse = data.choices?.[0]?.message?.content;
  if (!textResponse) {
    throw new Error('Invalid response structure received from ACP Proxy.');
  }

  return textResponse;
}

/**
 * Generate high-quality mock responses tailored to the active tool for keyless usage
 */
function getSimulatedResponse(tool, inputs) {
  switch (tool) {
    case 'chat':
      return getSimulatedChatResponse(inputs.message, inputs.persona);
    case 'drafts':
      return getSimulatedDraftResponse(inputs.type, inputs.tone, inputs.details);
    case 'docgen':
      return getSimulatedDocResponse(inputs.type, inputs.title, inputs.details);
    case 'mom':
      return getSimulatedMoMResponse(inputs.transcript);
    case 'kanban':
      return getSimulatedKanbanResponse(inputs.prompt);
    default:
      return "Hello! I am your AI Copilot. How can I help you automate your workspace tasks today?";
  }
}

function getSimulatedChatResponse(message, persona) {
  const msg = message.toLowerCase();
  
  let role = "General AI Assistant";
  if (persona === 'admin') role = "Executive Administrative Assistant";
  if (persona === 'writer') role = "Senior Communications & Technical Writer";
  if (persona === 'analyst') role = "Operations & Data Analyst";

  if (msg.includes('hello') || msg.includes('hi')) {
    return `**[${role}]** Hello there! I am ready to assist you. As your AI Copilot, I can help you draft emails, structure meeting minutes, organize task workflows, or analyze workspace data. What would you like to automate next?`;
  }
  if (msg.includes('task') || msg.includes('kanban') || msg.includes('todo')) {
    return `**[${role}]** Managing tasks is easy! You can switch to the **Task Board** tab in the sidebar. There you can use natural language prompts to add cards dynamically or let the AI prioritize your workspace workload automatically.`;
  }
  if (msg.includes('email') || msg.includes('draft') || msg.includes('write')) {
    return `**[${role}]** Absolutely. I can draft emails, memos, or announcements. For tailored results, please head over to the **Smart Drafts** tab where you can customize the tone, recipient context, and length.`;
  }
  if (msg.includes('meeting') || msg.includes('mom') || msg.includes('transcript')) {
    return `**[${role}]** If you have meeting transcripts or messy brainstorming notes, I can convert them into structured Meeting Minutes. Try pasting them in the **Minutes Extractor** tab to generate action items with designated owners immediately.`;
  }

  return `**[${role}]** I've analyzed your query regarding *"${message}"*. 

Here is how we can address this efficiently:
1. **Identify the Core Objective:** Align the work items with your weekly milestone goals.
2. **Automate the Process:** Generate templates using the **Doc Generator** to cut down manual formatting times.
3. **Log & Delegate:** Create matching cards in our Kanban board and set up reminders.

Let me know if you would like me to draft an email notification or generate a spreadsheet outline for this project!`;
}

function getSimulatedDraftResponse(type, tone, details) {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  let toneStyle = "";
  if (tone === 'professional') toneStyle = "formal, structured, and precise";
  if (tone === 'empathetic') toneStyle = "warm, understanding, and supportive";
  if (tone === 'direct') toneStyle = "concise, bulleted, and action-oriented";
  if (tone === 'urgent') toneStyle = "assertive, time-sensitive, and clear on deadlines";

  return `Subject: [Draft] Update regarding: ${details.slice(0, 40)}${details.length > 40 ? '...' : ''}
Date: ${dateStr}
Tone: ${tone.toUpperCase()} (${toneStyle})
Type: ${type.toUpperCase()}

Dear Team / Recipient,

I am writing to provide an update regarding ${details || '[insert brief details here]'}. 

As we move forward, we want to ensure all alignment parameters are met and outstanding actions are executed smoothly. Please review the key aspects outlined below:

*   **Milestone Status:** Standard benchmarks are progressing as scheduled.
*   **Immediate Deliverables:** Team members should review documentation and report inconsistencies by end of day tomorrow.
*   **Next Steps:** We will conduct a short checkpoint call early next week to address any blockers.

${tone === 'urgent' ? '**CRITICAL: Please treat this request with high priority and ensure replies are sent within the next 24 hours.**' : ''}
${tone === 'empathetic' ? 'Thank you all so much for your hard work, dedication, and flexibility as we navigate these project updates together.' : ''}

Should you have any questions or require additional support, please do not hesitate to reach out directly.

Best regards,

[Your Name]  
Nexus Copilot Auto-Draft Engine`;
}

function getSimulatedDocResponse(type, title, details) {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const docId = 'NEX-' + Math.floor(100000 + Math.random() * 900000);

  if (type === 'ppt') {
    return `# Presentation Outline: ${title || 'Project Alignment Pitch'}
**Document ID:** ${docId} | **Date:** ${dateStr}
**Format:** PPT Outline & Slide Copy

---

## Slide 1: Title Slide
*   **Slide Title:** ${title || 'Workspace Digital Transformation'}
*   **Sub-title:** Automated Operations & Intelligent Workflows
*   **Presenter:** B Karthik, Nexus Copilot

---

## Slide 2: The Core Problem
*   **Bullet 1:** Employees spend up to 4+ hours daily on manual reports, invoices, and scheduling.
*   **Bullet 2:** Missing alignment on meeting deliverables and unstructured action items.
*   **Bullet 3:** Fragmented communication and email backlogs slowing down execution.

---

## Slide 3: Proposed Solution
*   **Bullet 1:** Deploy **Nexus Copilot** to handle automatic invoice drafting and weekly reporting.
*   **Bullet 2:** Use **NLP Kanban boards** to parse and schedule tasks directly from conversation logs.
*   **Bullet 3:** Implement **AI Minutes Extractor** to transcribe raw transcripts into actionable tasks.

---

## Slide 4: Key Directives & Context
*   **Directives:** ${details || 'Define integration of document templates and task workflow automations.'}
*   **Focus:** Deliver state-of-the-art dark glassmorphic portals.

---

## Slide 5: Next Steps & Timeline
*   **Bullet 1:** Initialize sandbox & config API keys (Weeks 1-2).
*   **Bullet 2:** Launch internal pilot for customer support & HR (Weeks 3-4).
*   **Bullet 3:** Final wrap-up, metrics audit, and enterprise scale (Week 5).`;
  }

  if (type === 'invoice') {
    return `# INVOICE: ${title || 'Workspace Services'}
**Invoice ID:** ${docId} | **Date:** ${dateStr}
**Status:** DRAFT / PENDING REVIEW

---

### Bill To:
*   **Client Name:** [Client Reference]
*   **Billing Address:** [Client Address Info]

### Description of Services:
*   ${details || 'General professional consulting, administrative workflow setup, and AI solution deployment.'}

| Item Description | Qty | Rate | Amount |
| :--- | :---: | :---: | :---: |
| Technical Support & Copilot Setup | 1 | $1,250.00 | $1,250.00 |
| AI Prompt Engineering & Automation | 5 hrs | $150.00 | $750.00 |
| Operations Consultation | 2 hrs | $200.00 | $400.00 |
| **Total Due** | | | **$2,400.00** |

---
**Payment Terms:** Net 30. Payment via bank transfer or online deposit.
Generated by Nexus Copilot Document Engine.`;
  }

  if (type === 'proposal') {
    return `# Project Proposal: ${title || 'Workspace Digital Transformation'}
**Proposal ID:** ${docId} | **Date:** ${dateStr}
**Prepared For:** Executive Team & stakeholders

---

## 1. Executive Summary
This proposal outlines the strategy to integrate AI agents and intelligent workspace automation to alleviate repetitive administrative tasks, reduce employee burnout, and optimize cross-department productivity.

## 2. Objective & Scope
*   **Objective:** Automate up to 40% of administrative paper trails, status emails, and document summaries.
*   **Scope:** Implements automated email response drafting, natural language Kanban boards, and structured MoM generation.
*   **Context:** Based on requirements: *"${details || 'Need standard automation templates for human resources, document filing, and customer support coordination.'}"*

## 3. Milestones & Timeline
*   **Phase 1 (Week 1-2):** Needs Assessment & Initial Prototype scaffolding.
*   **Phase 2 (Week 3-4):** Integration of API services & custom prompts.
*   **Phase 3 (Week 5):** User Acceptance Testing (UAT) and deployment.

## 4. Resource Allocation & Estimates
*   **Total Project Duration:** 5 Weeks
*   **Estimated Cost:** $8,500.00 (Inclusive of setup, customization, and training)

---
*Authorized Sign-off:*  
_________________________  
[Stakeholder Signature]`;
  }

  // Weekly summary default
  return `# Weekly Progress Report: ${title || 'Operations Summary'}
**Report ID:** ${docId} | **Week Ending:** ${dateStr}

---

## 1. Summary of Accomplishments
This week focused on key deliverables, standardizing customer support workflows, and integrating AI automations.
*   **Project Kickoff:** Finalized architectural layouts and data flows.
*   **Features Completed:** Implemented local state syncing, AI-backed mockup modes, and UI glassmorphism interfaces.
*   **Target Scope Progress:** ${details || 'Progressing steadily on educational portal integrations and employee support copilot components.'}

## 2. Blockers & Risks
*   **API Limits:** Live API response times could fluctuate during high-traffic intervals.
*   **Action:** Local caching and fallback simulation engines have been deployed to safeguard core functionality.

## 3. Goals for Next Week
*   Implement custom themes and color configurations.
*   Deploy unit tests for markdown extraction.
*   Integrate full-scale user feedback collection.`;
}

function getSimulatedMoMResponse(transcript) {
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const attendees = transcript.match(/(?:[A-Z][a-z]+)+/g) || ['Sarah (PM)', 'James (Engineering)', 'Maya (Marketing)'];
  const uniqueAttendees = [...new Set(attendees)].slice(0, 4);

  return `# MINUTES OF MEETING (MoM)
**Date:** ${dateStr}
**Generated By:** Nexus Copilot MoM Parser

---

### Meeting Objective
Review current operational blocks, align task priorities for the sprint, and automate repetitive administrative document creation.

### Attendees
*   ${uniqueAttendees.join('\n*   ')}

---

### 1. Key Discussions & Notes
*   **Administrative Overhead:** The team discussed spending too much time creating manual invoices and drafting weekly reports. 
*   **AI Integrations:** Prototyping an intelligent agent workspace (Nexus Copilot) to handle task creation and email drafts automatically.
*   **Timeline Check:** Target MVP release is set for next Friday.

### 2. Action Items
| Action Item | Assigned To | Deadline | Status |
| :--- | :--- | :--- | :---: |
| Configure API proxy and fallback local models | Engineering Team | Tuesday | **IN PROGRESS** |
| Write marketing copy and email newsletters | Marketing Team | Wednesday | **PENDING** |
| Create weekly reports template layouts | Operations / PM | Thursday | **PENDING** |

### 3. Key Decisions
*   **Decision 1:** Approved the use of Gemini 2.5 Flash as the primary LLM model due to fast speeds and high context limit.
*   **Decision 2:** Standardized all dashboard elements to a glassmorphic dark interface to optimize readability.`;
}

function getSimulatedKanbanResponse(prompt) {
  // Parse task from prompt
  const taskText = prompt.replace(/(?:add|create|schedule|make|task|todo)/gi, '').trim();
  const cleanedTask = taskText.charAt(0).toUpperCase() + taskText.slice(1);
  
  // Decide column
  let column = 'todo';
  if (prompt.toLowerCase().includes('doing') || prompt.toLowerCase().includes('progress')) {
    column = 'in-progress';
  } else if (prompt.toLowerCase().includes('done') || prompt.toLowerCase().includes('complete')) {
    column = 'done';
  }

  // Extract a date if any
  let dueDate = 'Asap';
  const dateMatch = prompt.match(/(?:by|on|next)\s+([A-Za-z0-9\/\-]+)/i);
  if (dateMatch) {
    dueDate = dateMatch[1].charAt(0).toUpperCase() + dateMatch[1].slice(1);
  }

  return {
    title: cleanedTask || 'Collaborative Task Review',
    column: column,
    priority: prompt.length % 3 === 0 ? 'high' : (prompt.length % 2 === 0 ? 'medium' : 'low'),
    dueDate: dueDate
  };
}

/**
 * Main function invoked by frontend to query AI
 */
export async function queryAI(tool, inputs) {
  const apiKey = getSavedApiKey();
  const model = getSavedModel();

  if (!apiKey) {
    if (Array.isArray(tool)) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error('Simulated Mode: API key not set.'));
        }, 500);
      });
    }
    // Return simulated response with a small delay for realistic UX
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(getSimulatedResponse(tool, inputs));
      }, 700);
    });
  }

  try {
    let systemInstruction = '';
    let prompt = '';

    if (Array.isArray(tool)) {
      const systemMsg = tool.find(m => m.role === 'system');
      const userMsg = tool.find(m => m.role === 'user');
      systemInstruction = systemMsg ? (systemMsg.text || systemMsg.content || '') : '';
      prompt = userMsg ? (userMsg.text || userMsg.content || '') : '';
    } else if (tool === 'chat') {
      let role = "helpful assistant";
      if (inputs.persona === 'admin') role = "professional executive administrative assistant";
      if (inputs.persona === 'writer') role = "highly-skilled communications and copywriter";
      if (inputs.persona === 'analyst') role = "methodical business operations and data analyst";

      systemInstruction = `You are Nexus Copilot, acting as a ${role}. Analyze the user's implicit intent, mindset, and workspace context from their queries. Always provide highly effective, deep, and structured answers enriched with concrete real-world examples, actionable ideas, and operational best practices. Format beautifully in Markdown with sections.`;
      prompt = inputs.message;
    } else if (tool === 'drafts') {
      systemInstruction = `You are a professional email and communication writer. Write a message corresponding to the input details, utilizing the tone specified: "${inputs.tone}". Ensure proper subject and signature formats, using Markdown.`;
      prompt = `Write a ${inputs.type} about: ${inputs.details}`;
    } else if (tool === 'docgen') {
      systemInstruction = `You are an automated corporate document builder. Generate a highly detailed and professionally structured document of type: ${inputs.type} using Markdown headers, lists, and tables.`;
      prompt = `Title: ${inputs.title}\nDetails: ${inputs.details}`;
    } else if (tool === 'mom') {
      systemInstruction = `You are an expert meeting minutes generator. Extract key topics discussed, structured action items in a Markdown table, and major decisions from the provided raw transcript. Format professionally.`;
      prompt = `Here is the meeting transcript to summarize:\n${inputs.transcript}`;
    } else if (tool === 'kanban') {
      // For Kanban AI parsing, return JSON
      systemInstruction = `You are a natural language task parser. Convert the user prompt into a task card object. Output ONLY a valid JSON object matching this schema: {"title": "Task Title", "column": "todo"|"in-progress"|"done", "priority": "low"|"medium"|"high", "dueDate": "Date/Time string"}. Do not output any markdown formatting or extra text.`;
      prompt = `Parse this instruction into a task: "${inputs.prompt}"`;
    }

    let response;
    if (apiKey.startsWith('acp_')) {
      response = await callACPProxy(apiKey, model, systemInstruction, prompt);
    } else {
      response = await callGeminiAPI(apiKey, model, systemInstruction, prompt);
    }
    
    if (tool === 'kanban') {
      // Clean JSON formatting if the API returned it with code fences
      const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    }
    
    return response;
  } catch (error) {
    console.error('API Error:', error);
    if (Array.isArray(tool)) {
      throw error;
    }
    // Fall back to simulation and append error warning
    const simulated = getSimulatedResponse(tool, inputs);
    if (tool === 'kanban') {
      return simulated;
    }
    return `> [!WARNING]
> **API Error:** ${error.message}. Showing simulated draft response below:
 
${simulated}`;
  }
}
