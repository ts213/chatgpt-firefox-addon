'use strict';
document.getElementById('form').addEventListener('submit', onSubmit);
document.getElementById('tArea').addEventListener('input', onTextareaInput);
document.getElementById('tArea').addEventListener('keydown',
  ev => ev.key === 'Enter' && (ev.preventDefault(), ev.target.form.requestSubmit())
);

const chatContainer = document.getElementById('chatContainer');
const errorDiv = document.getElementById('error');
const decoder = new TextDecoder();
browser.storage.local.get('chatGptKey').then(storage => window.APIKey = storage.chatGptKey);

const messagesHistory = [];
messagesHistory.limit = 20;

async function onSubmit(e) {
  e.preventDefault();
  if (renderReply.rendering) return;
  if (!window.APIKey) if (!await promptForAPIKey()) return;

  const textContent = e.target.text.value.trim();
  if (!textContent.length) return;

  updateChatHistory({ role: 'user', textContent });
  await renderReply().catch(handleError);
  updateChatHistory({ role: 'assistant' });
}

function promptForAPIKey() {
  if (document.getElementById('modal')) return;

  let resolve;
  const promise = new Promise(res => resolve = res);

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
  document.getElementById('modalSubmitBtn').addEventListener('click', function() {
    window.APIKey = document.getElementById('apiKeyInput').value?.trim();
    if (!window.APIKey) return;
    browser.storage.local.set({ 'chatGptKey': window.APIKey });

    resolve(true);
    this.closest('#modal').remove();
  });

  return promise;
}

async function renderReply() {
  renderReply.rendering = true;
  const response = await fetchAPI()
    .catch(handleError).finally(() => renderReply.rendering = false);
  const reader = response.body.getReader();
  const responseContainer = createContainer();
  document.getElementById('tArea').value = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    const parsedString = parseResponse(value);
    for (const char of parsedString) {
      responseContainer.innerText += char ?? '';
      chatContainer.scrollTop = chatContainer.scrollHeight;
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

function updateChatHistory({ role, textContent = undefined }) {
  if (messagesHistory.length > messagesHistory.limit) {
    messagesHistory.shift();
  }

  switch (role) {
    case 'user':
      chatContainer.append(textContent);
      messagesHistory.push({ role, content: textContent, });
      break;
    case 'assistant':
      const lastQuestion = Array.from(document.querySelectorAll('.responseWrap')).pop().innerText;
      messagesHistory.push({ role, content: lastQuestion ?? '', },);
      break;
  }
}

async function fetchAPI() {
  return fetch('https://api.openai.com/v1/chat/completions', {
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${window.APIKey}`,
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

function handleError(e) {
  let errorText = 'An error occured';
  switch (e.message) {
    case '401':
      errorText = 'Invalid API key';
      browser.storage.local.remove('chatGptKey');
      window.APIKey = '';
      break;
    case '400':
      errorText = 'Server error';
      break;
    // case MNOGO
  }
  errorDiv.innerText = errorText;
  setTimeout(() => errorDiv.innerText = '', 6000);
  throw e;
}

function createContainer() {
  const responseWrap = document.createElement('div');
  responseWrap.className = 'responseWrap';
  chatContainer.append(responseWrap);
  return responseWrap;
}

function onTextareaInput() {
  this.style.height = '';
  this.style.height = this.scrollHeight + 'px';
}
