'use strict';

let apiKey;
let autoScroll = true;
const decoder = new TextDecoder();
const messagesHistory = []; messagesHistory.limit = 30;
const [errorDiv, chatContainer, chatForm, chatInput] = getElementsById(['error', 'chatContainer', 'chatForm', 'chatInput']);
browser.storage.local.get('chatGptKey').then(storage => apiKey = storage.chatGptKey);

chatContainer.addEventListener('scroll', function autoScrollWhenFullyBottomScrolled() {
  autoScroll = (this.scrollHeight - this.scrollTop) === this.clientHeight;
});
chatForm.addEventListener('submit', submitForm);
chatInput.addEventListener('input', changeInputHeight);
chatInput.addEventListener('keydown',
  ev => ev.key === 'Enter' && (ev.preventDefault(), ev.target.form.requestSubmit())
);

async function submitForm(e) {
  e.preventDefault();
  if (renderReply.rendering) return;
  if (!apiKey) if (!await promptForKey()) return;

  const textContent = e.target.text.value.trim();
  if (!textContent.length) return;

  updateChatHistory({ role: 'user', textContent });
  await renderReply().catch(handleError);
  updateChatHistory({ role: 'assistant' });
}

function promptForKey() {
  if (document.getElementById('modal')) {
    return false;
  }
  return new Promise(resolve => waitModalConfirmation(resolve));
}

async function renderReply() {
  renderReply.rendering = true;
  const response = await fetchAPI()
    .catch(handleError).finally(() => renderReply.rendering = false);
  const reader = response.body.getReader();
  const responseMsg = CreateChatMessage('assistant');
  chatInput.value = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const parsedString = parseResponse(value);
    for (const char of parsedString) {
      responseMsg.innerText += char ?? '';
      if (autoScroll) scrollChatDown();
    }
  }
}

function parseResponse(value) {
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  return lines.reduce((acc, curr) => {
    curr = curr.replace(/^data: /, '').trim();
    if (!curr) return acc;

    try {
      const line = JSON.parse(curr);
      const textContent = line.choices[0].delta.content;
      if (!textContent) return acc;

      acc += textContent;
    } catch {} finally { return acc;}

  }, '');
}

function waitModalConfirmation(resolve) {
  document.body.insertAdjacentHTML('afterbegin',
    `<div id='modal'>
        <div>
        You need API
          <a style='font-weight: bolder' target='_blank' href='https://platform.openai.com/account/api-keys'>key</a>
        to make requests to ChatGPT API  
        </div>
        <input id='apiKeyInput' placeholder='API key' autofocus />
        <button id='modalSubmitBtn'>Save</button>
      </div>`
  );
  document.getElementById('modalSubmitBtn').addEventListener('click', function () {
    apiKey = document.getElementById('apiKeyInput').value?.trim();
    if (!apiKey) return;

    browser.storage.local.set({ 'chatGptKey': apiKey });
    resolve(true);
    this.closest('#modal').remove();
  });
}

function updateChatHistory({ role, textContent = undefined }) {
  if (messagesHistory.length > messagesHistory.limit) {
    messagesHistory.shift();
  }

  switch (role) {
    case 'user':
      const questionMsg = CreateChatMessage('user');
      questionMsg.innerText = textContent + '\n';
      messagesHistory.push({ role, content: textContent, });
      break;
    case 'assistant':
      const lastQuestion = Array.from(document.querySelectorAll('.response')).pop().innerText;
      messagesHistory.push({ role, content: lastQuestion ?? '', },);
      break;
  }
}

async function fetchAPI() {
  return fetch('https://api.openai.com/v1/chat/completions', {
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    'body': JSON.stringify({
      'model': 'gpt-3.5-turbo',
      'messages': messagesHistory,
      'stream': true
    }),
    'method': 'POST',
  }).then(r => {
    if (!r.ok) throw new Error(r.status.toString());
    return r;
  });
}

function handleError(err) {
  let errorText = 'An error occured';
  switch (err.message) {
    case '401':
      errorText = 'Invalid API key';
      browser.storage.local.remove('chatGptKey');
      apiKey = null;
      break;
    case '400':
      errorText = 'Server error';
      break;
    case '429':
      errorText = 'Too many requests or quota exceeded';
  }
  errorDiv.innerText = errorText;
  messagesHistory.pop();
  setTimeout(() => errorDiv.innerText = '', 6000);
  throw err;
}

function CreateChatMessage(type) {
  const element = document.createElement('div');
  element.className = type === 'user'
    ? 'question'
    : 'response';
  chatContainer.append(element);
  return element;
}

function changeInputHeight() {
  this.style.height = '';
  this.style.height = this.scrollHeight + 'px';
  scrollChatDown();
}

function getElementsById(idList = []) {
  return idList.reduce((acc, id) =>
      [...acc, document.getElementById(id)],
    []).filter(Boolean);
}

function scrollChatDown() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}
